/* Burnaby DashCam Pros — authenticated, all-page visual content studio. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const CFG=window.DASHCAM_SUPABASE||{};
const ROOT='../';
const MAX_UPLOAD=5*1024*1024;
let client=null,manifest=[],payload=null,revision='',draft={},lastSaved='',dirty=false,selectedPage='index.html',selected=null,frameDoc=null,saving=false;
const originals=new Map();
function toast(message,error){let node=$('toast');node.textContent=message;node.classList.toggle('error',!!error);node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,7000);}
function status(message){$('status').textContent=message;}
function display(id,yes){$(id).hidden=!yes;}
function record(page){if(!draft[page])draft[page]={text:{},images:{},links:{},placeholders:{},frames:{},meta:{}};
 let r=draft[page];['text','images','links','placeholders','frames','meta'].forEach(k=>{if(!r[k]||typeof r[k]!=='object')r[k]={};});return r;}
function markDirty(){dirty=true;$('publish').disabled=false;status('Unpublished changes');}
function clean(){dirty=false;$('publish').disabled=true;status('All changes published');lastSaved=JSON.stringify(draft);}
function initialData(){if(!payload)throw Error('Content record not loaded');draft=structuredClone(payload.pageOverrides||{});clean();}
function safePage(page){return manifest.some(x=>x.path===page)?page:'index.html';}
function navigate(page){if(!manifest.length)return;selectedPage=safePage(page);selected=null;frameDoc=null;
 const item=manifest.find(x=>x.path===selectedPage);$('pageSelect').value=selectedPage;$('pageHeading').textContent=item.label;
 $('openPage').href=ROOT+selectedPage;
 document.querySelectorAll('#pageNavigation button').forEach(b=>b.classList.toggle('active',b.dataset.page===selectedPage));
 $('preview').src=ROOT+selectedPage+'?visual-preview=1';
 $('selectedTitle').textContent='Select an element';$('selectedHint').textContent='Click an item in the preview to edit it.';
 $('editingPanel').innerHTML='<p class="muted">Choose any headline, paragraph, navigation link or image on this page. Your edits appear immediately in the preview.</p>';
 const meta=record(selectedPage).meta;$('seoTitle').value=meta.title===undefined?item.title:meta.title;
 $('seoDescription').value=meta.description===undefined?item.description:meta.description;
}
function addOption(select,record){const opt=document.createElement('option');opt.value=record.path;opt.textContent=record.label+' — '+record.path;select.appendChild(opt);}
async function loadFromSupabase(){const r=await client.from('cms_content').select('payload,updated_at').eq('id','main').single();
 if(r.error)throw r.error;if(!r.data||!r.data.payload)throw Error('The Supabase content row was not found.');
 payload=r.data.payload;revision=r.data.updated_at;initialData();}
async function openEditor(user){if(!user){display('loginScreen',true);display('studio',false);return;}
 const membership=await client.from('cms_editors').select('user_id').eq('user_id',user.id).maybeSingle();
 if(membership.error||!membership.data){await client.auth.signOut();throw Error('This account is not approved as a website editor.');}
 await loadFromSupabase();display('loginScreen',false);display('studio',true);navigate(selectedPage);
}
async function signIn(event){event.preventDefault();$('loginButton').disabled=true;$('loginError').hidden=true;
 try{const r=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error)throw r.error;
 await openEditor(r.data.user);}catch(error){$('loginError').textContent=error.message;$('loginError').hidden=false;}
 finally{$('loginButton').disabled=false;}}
function closest(el,attr){return el&&el.closest?el.closest('['+attr+']'):null;}
function beginSelection(el){if(!frameDoc)return;
 frameDoc.querySelectorAll('.cms-selected').forEach(e=>e.classList.remove('cms-selected'));
 let image=closest(el,'data-cms-img'),text=closest(el,'data-cms-text'),link=closest(el,'data-cms-href'),placeholder=closest(el,'data-cms-placeholder'),frame=closest(el,'data-cms-frame');
 if(image)selected={kind:'image',id:image.dataset.cmsImg,el:image};
 else if(text)selected={kind:'text',id:text.dataset.cmsText,el:text,link:link||closest(text,'data-cms-href')};
 else if(placeholder)selected={kind:'placeholder',id:placeholder.dataset.cmsPlaceholder,el:placeholder};
 else if(frame)selected={kind:'frame',id:frame.dataset.cmsFrame,el:frame};
 else if(link)selected={kind:'link',id:link.dataset.cmsHref,el:link};
 else selected=null;
 if(!selected){return;}
 selected.el.classList.add('cms-selected');renderInspector();}
function heading(title,hint){$('selectedTitle').textContent=title;$('selectedHint').textContent=hint;}
function field(label,value,fn,multiline){const wrap=document.createElement('div');const caption=document.createElement('label');caption.textContent=label;
 const input=document.createElement(multiline?'textarea':'input');if(multiline)input.rows=5;else input.type='text';input.value=value==null?'':String(value);
 input.addEventListener('input',()=>fn(input.value));wrap.append(caption,input);return wrap;}
function refreshSelection(){if(!frameDoc)return;const r=record(selectedPage);if(!r) return;
 if(selected && selected.kind==='text'){const val=r.text[selected.id];if(typeof val==='string')selected.el.textContent=val;}
}
function store(kind,id,val){const r=record(selectedPage);r[kind][id]=val;markDirty();if(frameDoc&&frameDoc.defaultView.DashcamPageCMS)frameDoc.defaultView.DashcamPageCMS.apply(r);}
function originalFor(kind,id,selector,attr){const key=selectedPage+'::'+kind+'::'+id;
 if(originals.has(key))return originals.get(key);
 const dom=frameDoc&&frameDoc.querySelector(selector);let v=dom?(attr?dom.getAttribute(attr):dom.textContent):'';
 originals.set(key,v||'');return v||'';}
function renderInspector(){let panel=$('editingPanel');panel.replaceChildren();if(!selected)return;
 const s=selected,r=record(selectedPage);
 if(s.kind==='text'){
  heading('Edit website text','Editing '+selectedPage+' · Text '+s.id);
  const initial=originalFor('text',s.id,'[data-cms-text="'+s.id+'"]');
  const current=r.text[s.id]===undefined?initial:r.text[s.id];
  const lead=(initial.match(/^\s*/)||[''])[0],tail=(initial.match(/\s*$/)||[''])[0];
  panel.appendChild(field('Visible text',String(current).trim(),val=>store('text',s.id,lead+val+tail),true));
  if(s.link){const lid=s.link.dataset.cmsHref;const url=r.links[lid]===undefined?s.link.getAttribute('href'):r.links[lid];
   panel.appendChild(field('Link destination',url,val=>store('links',lid,val),false));}
 }else if(s.kind==='image'){
  heading('Edit image','Replace the selected photo and its alternative text.');
  const v=r.images[s.id]||{};
  const src=v.src===undefined?s.el.getAttribute('src'):v.src;
  const alt=v.alt===undefined?s.el.getAttribute('alt')||'':v.alt;
  panel.appendChild(field('Image URL or path',src,val=>store('images',s.id,{...r.images[s.id],src:val,alt:r.images[s.id]?.alt??alt}),false));
  panel.appendChild(field('Image alt text',alt,val=>store('images',s.id,{...r.images[s.id],src:r.images[s.id]?.src??src,alt:val}),true));
  const label=document.createElement('label');label.className='upload';label.textContent='Upload replacement image (JPG, PNG or WebP, max 5MB)';
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
  input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file)return;
   try{input.disabled=true;toast('Uploading image…');const url=await uploadImage(file);store('images',s.id,{...r.images[s.id],src:url,alt:r.images[s.id]?.alt??alt});renderInspector();toast('Image uploaded. Publish changes to update the website.');}
   catch(e){toast('Image upload failed: '+e.message,true);input.disabled=false;}});label.append(input);panel.append(label);
 }else if(s.kind==='link'){
  heading('Edit link','Update the destination without changing layout.');
  panel.appendChild(field('Link URL',r.links[s.id]===undefined?s.el.getAttribute('href'):r.links[s.id],val=>store('links',s.id,val),false));
 }else if(s.kind==='placeholder'){
  heading('Edit form placeholder','Text displayed in this input before someone types.');
  panel.appendChild(field('Placeholder text',r.placeholders[s.id]===undefined?s.el.placeholder:r.placeholders[s.id],val=>store('placeholders',s.id,val),false));
 }else if(s.kind==='frame'){
  heading('Edit embedded map','Only HTTPS frame URLs are permitted.');
  panel.appendChild(field('Embed URL',r.frames[s.id]===undefined?s.el.src:r.frames[s.id],val=>store('frames',s.id,val),true));
 }
}
function onPreviewReady(){try{frameDoc=$('preview').contentDocument;if(!frameDoc||!frameDoc.body)return;
 const doc=frameDoc;const style=doc.createElement('style');style.textContent='[data-cms-text],[data-cms-img],[data-cms-href],[data-cms-placeholder],[data-cms-frame]{cursor:pointer!important}[data-cms-text]:hover,[data-cms-img]:hover,[data-cms-href]:hover,[data-cms-placeholder]:hover,[data-cms-frame]:hover{outline:2px dashed #ed4050!important;outline-offset:3px!important}.cms-selected{outline:3px solid #e8293b!important;outline-offset:4px!important;box-shadow:0 0 0 5px #ed405026!important}';
 doc.head.appendChild(style);
 doc.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();beginSelection(ev.target);},true);
 doc.addEventListener('submit',ev=>ev.preventDefault(),true);
 const current=record(selectedPage);const bridge=doc.defaultView.DashcamPageCMS;if(bridge)bridge.apply(current);
 const row=manifest.find(x=>x.path===selectedPage);
 $('seoTitle').value=current.meta.title===undefined?row.title:current.meta.title;
 $('seoDescription').value=current.meta.description===undefined?row.description:current.meta.description;
 }catch(e){toast('The preview could not load from the website origin: '+e.message,true);}}
async function uploadImage(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP image.');
 if(file.size>MAX_UPLOAD)throw Error('File must be below 5 MB.');
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
 const path='uploads/'+Date.now()+'-'+Math.random().toString(36).slice(2,11)+'.'+ext;
 const r=await client.storage.from('site-media').upload(path,file,{contentType:file.type,upsert:false});if(r.error)throw r.error;
 return client.storage.from('site-media').getPublicUrl(path).data.publicUrl;}
async function requestPublish(){const s=await client.auth.getSession();if(s.error)throw s.error;
 const token=s.data?.session?.access_token;if(!token)throw Error('Sign in again.');
 const response=await fetch(CFG.url.replace(/\/$/,'')+'/functions/v1/publish-html',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:CFG.anonKey,'Content-Type':'application/json'},body:JSON.stringify({published_at:revision})});
 const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw Error(data.error||('HTTP '+response.status));return data;}
async function publish(){if(!dirty||saving)return;
 saving=true;$('publish').disabled=true;status('Saving content to Supabase…');
 try{const patch={...payload,pageOverrides:draft};const result=await client.from('cms_content').update({payload:patch}).eq('id','main').eq('updated_at',revision).select('updated_at').maybeSingle();
  if(result.error)throw result.error;if(!result.data)throw Error('Another editor saved changes. Reload the dashboard to avoid overwriting them.');
  payload=patch;revision=result.data.updated_at;clean();status('Saved · requesting static HTML deployment…');
  try{await requestPublish();status('Saved · GitHub HTML deployment requested');toast('Supabase saved and GitHub accepted the HTML deployment request.');}
  catch(e){status('Saved · HTML publishing needs attention');toast('Saved to Supabase, but HTML was NOT deployed: '+e.message,true);}
 }catch(e){status('Save failed: '+e.message);toast('Publish failed: '+e.message,true);$('publish').disabled=false;}
 finally{saving=false;}}
async function sync(){if(dirty)return toast('Publish unsaved edits before requesting HTML sync.',true);
 $('syncHtml').disabled=true;status('Requesting HTML rebuild…');
 try{await requestPublish();status('GitHub HTML deployment requested');toast('GitHub HTML deployment requested. Check Actions for completion.');}
 catch(e){status('HTML deployment request failed');toast(e.message,true);}
 finally{$('syncHtml').disabled=false;}}
async function signOut(){if(dirty&&!confirm('Discard unpublished changes and sign out?'))return;
 await client.auth.signOut();payload=null;draft={};display('studio',false);display('loginScreen',true);$('password').value='';}
async function init(){try{
 if(!window.supabase||!CFG.url||!CFG.anonKey)throw Error('Supabase client configuration was not loaded.');
 client=window.supabase.createClient(CFG.url,CFG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const rs=await fetch(ROOT+'assets/js/pages-manifest.json',{cache:'no-store'});if(!rs.ok)throw Error('Could not load the pages manifest.');manifest=await rs.json();if(!Array.isArray(manifest)||manifest.length<2)throw Error('No editable pages found.');
 manifest.forEach(x=>{addOption($('pageSelect'),x);const b=document.createElement('button');b.type='button';b.dataset.page=x.path;b.textContent=x.label;b.addEventListener('click',()=>navigate(x.path));$('pageNavigation').appendChild(b);});
 const session=await client.auth.getSession();if(session.error)throw session.error;
 if(session.data.session)await openEditor(session.data.session.user);else{display('loginScreen',true);display('studio',false);}
 }catch(e){display('loginScreen',true);display('studio',false);$('loginError').textContent=e.message;$('loginError').hidden=false;}}
$('loginForm').addEventListener('submit',signIn);$('signOut').addEventListener('click',signOut);
$('pageSelect').addEventListener('change',e=>navigate(e.target.value));$('preview').addEventListener('load',onPreviewReady);
$('publish').addEventListener('click',publish);$('publishInspector').addEventListener('click',publish);
$('syncHtml').addEventListener('click',sync);
$('discardPage').addEventListener('click',()=>{if(!confirm('Discard unpublished edits to this page?'))return;
 const prev=JSON.parse(lastSaved||'{}');if(Object.prototype.hasOwnProperty.call(prev,selectedPage))draft[selectedPage]=prev[selectedPage];else delete draft[selectedPage];
 dirty=JSON.stringify(draft)!==(lastSaved||'{}');$('publish').disabled=!dirty;status(dirty?'Unpublished changes':'All changes saved');navigate(selectedPage);});
document.querySelectorAll('[data-device]').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('[data-device]').forEach(x=>x.classList.toggle('active',x===b));$('viewport').dataset.size=b.dataset.device;
}));
for(const id of ['seoTitle','seoDescription'])$(id).addEventListener('input',e=>{
 if(!payload)return;const field=id==='seoTitle'?'title':'description';record(selectedPage).meta[field]=e.target.value;markDirty();
 if(frameDoc&&frameDoc.defaultView.DashcamPageCMS)frameDoc.defaultView.DashcamPageCMS.apply(record(selectedPage));});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
init();
})();
