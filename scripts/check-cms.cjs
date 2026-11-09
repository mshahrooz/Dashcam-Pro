const fs=require('node:fs');
(async()=>{
  const cfg={url:'https://uoftclniarkxyqsdudcf.supabase.co',key:'sb_publishable_zFMtpGG906SLquW1hyN44Q_aM_EMJKW'};
  const res=await fetch(cfg.url+'/rest/v1/cms_content?id=eq.main&select=payload',{
    headers:{apikey:cfg.key,Accept:'application/json'},signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)throw Error('Supabase read error '+res.status);
  const rows=await res.json(),data=rows?.[0]?.payload;
  if(!data||!data.siteContent||data.ok!==true)throw Error('Invalid content');
  let previous=null;
  try{previous=JSON.parse(fs.readFileSync('cms-data.json','utf8'));}catch{}
  const changed=JSON.stringify(data)!==JSON.stringify(previous);
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed='+changed+'\n');
  console.log(changed?'CMS changed — rebuild required.':'CMS matches committed HTML snapshot.');
})().catch(e=>{console.error(e);process.exitCode=1;});
