const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
(async () => {
  const root = process.cwd(), out = path.join(root, '_site');
  const config = { url: 'https://uoftclniarkxyqsdudcf.supabase.co', key: 'sb_publishable_zFMtpGG906SLquW1hyN44Q_aM_EMJKW' };
  const response = await fetch(config.url + '/rest/v1/cms_content?id=eq.main&select=payload', {
    headers: { apikey: config.key, Accept: 'application/json' }, signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('CMS read failed: HTTP ' + response.status);
  const rows = await response.json(), data = rows?.[0]?.payload;
  if (!data || data.ok !== true || !data.siteContent || !Array.isArray(data.products)) throw new Error('Invalid CMS content: deployment stopped');
  await fs.mkdir(out, {recursive:true});
  await Promise.all(['generated','admin'].map(n => fs.cp(path.join(root,n),path.join(out,n),{recursive:true})));
  await Promise.all(['index.html','supabase-config.js','.nojekyll'].map(n => fs.copyFile(path.join(root,n),path.join(out,n))));
  await fs.writeFile(path.join(out,'cms-data.json'),JSON.stringify(data));
  const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
  const server=http.createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const target=path.resolve(out,'.'+pathname);
      if (!target.startsWith(out+path.sep) && target!==out) return res.writeHead(403).end();
      const stat=await fs.stat(target), file=stat.isDirectory()?path.join(target,'index.html'):target;
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?visual-preview=1',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>typeof window.__dashcamApplyVisualDraft==='function' && !!document.querySelector('[data-cms="hero_title_before"]'));
    await page.evaluate(data=>{
      window.__dashcamApplyVisualDraft(data);
      document.documentElement.setAttribute('data-static-cms','published');
      const hero=document.querySelector('[data-cms-image="hero_background_image"]');
      if(hero) hero.setAttribute('src','generated/hero-premium.jpg');
    },data);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const html=await page.content();
    if(!html.includes('data-static-cms="published"') || !html.includes('data-cms="meta_title"')) throw new Error('Rendered HTML validation failed');
    await fs.writeFile(path.join(out,'index.html'),'<!DOCTYPE html>\n'+html.replace(/^<!DOCTYPE html>\s*/i,''));
    await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://mshahrooz.github.io/Dashcam-Pro/sitemap.xml\n');
    await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://mshahrooz.github.io/Dashcam-Pro/</loc></url></urlset>\n');
    console.log('Published Supabase content rendered into static SEO HTML.');
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
