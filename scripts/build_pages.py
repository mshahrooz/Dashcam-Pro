#!/usr/bin/env python3
"""Build fourteen SEO-readable HTML pages from Supabase's authenticated CMS draft.

Site templates are immutable inputs. The script never executes CMS-controlled HTML.
"""
import json, os, re, shutil, urllib.request, pathlib, sys
from bs4 import BeautifulSoup

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'_site'
BASE=os.environ.get('PUBLIC_SITE_URL','https://mshahrooz.github.io/Dashcam-Pro/').rstrip('/')+'/'


def get_payload():
    if os.environ.get('CMS_OFFLINE') == '1':
        return {'pageOverrides':json.loads((ROOT/'cms-pages.json').read_text(encoding='utf8'))}
    cfg=(ROOT/'supabase-config.js').read_text(encoding='utf8')
    url=re.search(r'url:\s*["\'](https://[^"\']+)["\']',cfg)
    key=re.search(r'anonKey:\s*["\']([^"\']+)["\']',cfg)
    if not url or not key: raise RuntimeError('Supabase publishable configuration missing')
    endpoint=url.group(1).rstrip('/')+'/rest/v1/cms_content?id=eq.main&select=payload'
    request=urllib.request.Request(endpoint,headers={'apikey':key.group(1),'Accept':'application/json','User-Agent':'dashcam-static-site-builder'})
    with urllib.request.urlopen(request,timeout=30) as response:
        records=json.load(response)
    if not isinstance(records,list) or not records or not isinstance(records[0].get('payload'),dict):
        raise RuntimeError('Supabase record missing — not publishing out-of-date HTML')
    return records[0]['payload']


def valid_href(s):
    return isinstance(s,str) and (bool(re.match(r'^(?:https?://|mailto:|tel:|\.?\.?/|#|/)',s,re.I)) or bool(re.fullmatch(r'[a-z0-9][a-z0-9/.#?=&_%+-]*',s,re.I)))


def valid_image(s):
    return isinstance(s,str) and (bool(re.match(r'^(?:https?://|\.?\.?/|/|assets/|generated/)',s,re.I)) or bool(re.match(r'^data:image/(?:jpeg|png|gif|webp);base64,',s,re.I)))


def apply(soup,record):
    if not isinstance(record,dict):return
    for kind,attr in [('text','data-cms-text'),('links','data-cms-href'),('placeholders','data-cms-placeholder'),('frames','data-cms-frame')]:
        data=record.get(kind,{})
        if not isinstance(data,dict): continue
        for key,val in data.items():
            if not isinstance(val,str) or not re.fullmatch(r'[tlfp]\d{3,4}',key):continue
            element=soup.find(attrs={attr:key})
            if not element:continue
            if kind=='text':element.clear();element.append(val)
            elif kind=='links' and valid_href(val):element['href']=val
            elif kind=='placeholders':element['placeholder']=val
            elif kind=='frames' and re.match(r'^https://',val,re.I):element['src']=val
    images=record.get('images',{})
    if isinstance(images,dict):
        for key,val in images.items():
            if not isinstance(val,dict) or not re.fullmatch(r'i\d{3,4}',key):continue
            element=soup.find(attrs={'data-cms-img':key})
            if not element:continue
            if valid_image(val.get('src')):element['src']=val['src']
            if isinstance(val.get('alt'),str):element['alt']=val['alt']
    meta=record.get('meta',{})
    if isinstance(meta,dict):
        if isinstance(meta.get('title'),str) and soup.title:
            soup.title.string=meta['title']
            og=soup.find('meta',attrs={'property':'og:title'})
            if og:og['content']=meta['title']
        if isinstance(meta.get('description'),str):
            el=soup.find('meta',attrs={'name':'description'})
            if el:el['content']=meta['description']
            og=soup.find('meta',attrs={'property':'og:description'})
            if og:og['content']=meta['description']


def build():
    payload=get_payload()
    overrides=payload.get('pageOverrides') or {}
    if not isinstance(overrides,dict):raise RuntimeError('Supabase page overrides must be an object')
    manifest=json.loads((ROOT/'assets/js/pages-manifest.json').read_text(encoding='utf8'))
    OUTPUT.mkdir(exist_ok=True)
    for name in ['assets','generated','admin']:
        source=ROOT/name;target=OUTPUT/name
        if target.exists():shutil.rmtree(target)
        shutil.copytree(source,target)
    for name in ['supabase-config.js','.nojekyll']:
        shutil.copy2(ROOT/name,OUTPUT/name)
    for info in manifest:
        page=info['path']
        template=ROOT/'site-templates'/page
        if not template.is_file():raise RuntimeError('Missing page template: '+page)
        soup=BeautifulSoup(template.read_text(encoding='utf8'),'html.parser')
        apply(soup,overrides.get(page,{}))
        url=BASE+('' if page=='index.html' else page)
        tag=soup.find('link',rel='canonical')
        if tag:tag['href']=url
        if page!='404.html':
            meta=soup.find('meta',attrs={'property':'og:url'})
            if not meta:
                meta=soup.new_tag('meta');meta['property']='og:url';soup.head.append(meta)
            meta['content']=url
        dest=OUTPUT/page;dest.parent.mkdir(exist_ok=True,parents=True)
        dest.write_text('<!DOCTYPE html>\n'+str(soup).replace('<!DOCTYPE html>','',1).lstrip(),encoding='utf8')
    (OUTPUT/'cms-pages.json').write_text(json.dumps(overrides,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf8')
    urls=['  <url><loc>'+BASE+('' if obj['path']=='index.html' else obj['path'])+'</loc></url>' for obj in manifest if obj['path']!='404.html']
    (OUTPUT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+'\n'.join(urls)+'\n</urlset>\n',encoding='utf8')
    (OUTPUT/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+BASE+'sitemap.xml\n',encoding='utf8')
    print('Built',len(manifest),'static pages with',sum(len((overrides.get(x['path']) or {}).get('text',{})) for x in manifest),'edited text fields.')

if __name__=='__main__':
    try:build()
    except Exception as exc:
        print('Static build failed:',exc,file=sys.stderr)
        sys.exit(1)
