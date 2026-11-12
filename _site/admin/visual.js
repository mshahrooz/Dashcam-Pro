(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const MEDIA_KEYS = {
    hero_background_image:"Homepage hero background",
    rideshare_image:"Rideshare image",
    install_image:"Installation image",
    tesla_image:"Tesla section image"
  };
  const FIELDS = {
    products:[
      ["Product name","name","text"],["Brand","brand","text"],
      ["Category","category","text"],["Price","price","number"],
      ["Previous price","oldPrice","number"],["Description","blurb","textarea"],
      ["Product image","image","image"],["Feature tags","tags","csv"],
      ["Badges","badges","csv"],["Product tabs (top, best, new)","list","csv"],
      ["Star rating","rating","number"],["Number of reviews","reviews","number"],
      ["Show on website","published","checkbox"]
    ],
    services:[
      ["Service title","title","text"],["Service description","description","textarea"],
      ["Button text","linkText","text"],["Button link","linkUrl","text"],
      ["Show on website","published","checkbox"]
    ],
    reviews:[
      ["Customer name","name","text"],["Customer detail","role","text"],
      ["Customer review","quote","textarea"],["Star rating","rating","number"],
      ["Show on website","published","checkbox"]
    ],
    articles:[
      ["Article headline","title","text"],["Article summary","summary","textarea"],
      ["Article image","imagePath","image"],["Link text","linkText","text"],
      ["Link destination","linkUrl","text"],["Show on website","published","checkbox"]
    ]
  };

  let bridge = null;
  let frame = null;
  let previewDoc = null;
  let selected = null;
  let device = "desktop";
  let busyUploading = false;
  let mounted = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g,function(ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }
  function words(key) {
    return String(key).replace(/_/g," ").replace(/\b\w/g,function(x){return x.toUpperCase();})
      .replace(/\bCta\b/g,"CTA").replace(/\bSeo\b/g,"SEO");
  }
  function model() {
    return bridge && bridge.getModel();
  }
  function findPath(path) {
    const m = model();
    return m && path.split(".").reduce(function(x,k){return x == null ? undefined : x[k];},m);
  }
  function html() {
    return '<div class="v-studio" id="vStudio">' +
      '<div class="v-toolbar">' +
      '<div class="v-tools-left"><button type="button" class="v-button v-back" data-go="overview">← Dashboard</button>' +
      '<div class="v-divider"></div><span class="v-caption">Preview size</span>' +
      '<div class="v-devices" role="group" aria-label="Preview screen size">' +
      '<button type="button" data-v-device="desktop" class="v-device active" aria-pressed="true" title="Desktop preview">▣ <span>Desktop</span></button>' +
      '<button type="button" data-v-device="tablet" class="v-device" aria-pressed="false" title="Tablet preview">▯ <span>Tablet</span></button>' +
      '<button type="button" data-v-device="mobile" class="v-device" aria-pressed="false" title="Mobile preview">▯ <span>Mobile</span></button>' +
      '</div></div>' +
      '<div class="v-tools-right"><span class="v-live"><i></i> Live draft</span>' +
      '<button class="v-button" type="button" id="vDiscard" title="Revert all unpublished changes">↶ Discard edits</button>' +
      '<button class="v-button" type="button" id="vReloadPreview" title="Reload the preview">⟳ Refresh</button></div></div>' +
      '<div class="v-jump"><label for="vJump">Jump to</label><select id="vJump">' +
      '<option value="home">Homepage hero</option><option value="services">Services</option>' +
      '<option value="products">Products</option><option value="about">About</option>' +
      '<option value="tesla">Tesla</option><option value="brands">Vehicle brands</option>' +
      '<option value="showcase">Showcase</option><option value="reviews">Reviews</option>' +
      '<option value="blog">Articles</option><option value="contact">Contact</option>' +
      '</select><div class="v-help-inline"><span class="v-indicator"></span> Click a headline, image or card to edit it.</div></div>' +
      '<div class="v-stage">' +
      '<div class="v-canvas" id="vCanvas"><div class="v-device-frame" id="vDeviceFrame" data-device="desktop">' +
      '<iframe id="vWebsiteFrame" src="../?visual-preview=1" title="Interactive preview of the live Burnaby DashCam Pros homepage" loading="eager"></iframe></div>' +
      '<div class="v-preview-help" id="vPreviewHelp">✦ &nbsp; You are viewing the actual homepage. Click any highlighted content to change it.</div></div>' +
      '<aside class="v-inspector" id="vInspector" aria-label="Selected website content editor" hidden>' +
      '<div class="v-inspector-header"><div class="v-inspector-overline">EDIT SELECTED CONTENT</div>' +
      '<button id="vCloseInspector" class="v-icon-button" type="button" aria-label="Close editor">✕</button>' +
      '<h2 id="vInspectorTitle">Edit content</h2><p id="vInspectorSubtitle">Changes appear instantly in the preview.</p></div>' +
      '<div class="v-inspector-fields" id="vInspectorFields"></div>' +
      '<div class="v-inspector-bottom"><div>◉ <strong>Preview only</strong> until you click <b>Publish changes</b> above.</div>' +
      '<button id="vInspectorPublish" class="v-inspector-publish" type="button">Publish changes ↗</button></div>' +
      '</aside></div>' +
      '<div class="v-bottomline"><span><strong>Visual editing:</strong> select any text, image or product in the page to edit it here.</span>' +
      '<span class="v-shortcut">Original dashboard tools remain available via Dashboard.</span></div>' +
      '</div>';
  }

  function mount(inputBridge) {
    unmount();
    bridge = inputBridge;
    frame = $("vWebsiteFrame");
    if (!frame || !bridge || !model()) return;
    mounted = true;
    selected = null;
    const root = $("vStudio");
    root.addEventListener("click",clickControls);
    root.addEventListener("input",inputField);
    root.addEventListener("change",changeField);
    frame.addEventListener("load",onFrameLoad);
    $("vJump").addEventListener("change",jumpToSection);
    setDevice("desktop");
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") onFrameLoad();
  }

  function unmount() {
    if (previewDoc) {
      previewDoc.removeEventListener("click",previewClick,true);
      previewDoc.removeEventListener("submit",preventSubmit,true);
      previewDoc.removeEventListener("keydown",previewKeyDown,true);
    }
    if (frame) frame.removeEventListener("load",onFrameLoad);
    previewDoc = null;
    frame = null;
    selected = null;
    bridge = null;
    mounted = false;
  }

  function setDevice(next) {
    device = next;
    const shell = $("vDeviceFrame");
    if (!shell) return;
    shell.dataset.device = next;
    document.querySelectorAll("[data-v-device]").forEach(function(b){
      const active = b.dataset.vDevice === next;
      b.classList.toggle("active",active);
      b.setAttribute("aria-pressed",String(active));
    });
  }

  function onFrameLoad() {
    if (!mounted || !frame) return;
    let doc;
    try { doc = frame.contentDocument; } catch (_) {
      bridge.notify("The preview must load from the same website domain.",true);
      return;
    }
    if (!doc || !doc.body) return;
    if (previewDoc) {
      previewDoc.removeEventListener("click",previewClick,true);
      previewDoc.removeEventListener("submit",preventSubmit,true);
      previewDoc.removeEventListener("keydown",previewKeyDown,true);
    }
    previewDoc = doc;
    doc.addEventListener("click",previewClick,true);
    doc.addEventListener("submit",preventSubmit,true);
    doc.addEventListener("keydown",previewKeyDown,true);
    const style = doc.createElement("style");
    style.id = "dashcam-visual-edit-style";
    style.textContent = [
      "[data-cms],[data-cms-image],[data-visual-product-id],[data-visual-brand-index]",
      "{cursor:pointer!important}",
      "[data-cms]:hover,[data-cms-image]:hover,[data-visual-product-id]:hover,",
      "[data-visual-brand-index]:hover",
      "{outline:2px dashed #f1525a!important;outline-offset:3px!important}",
      ".dashcam-visual-selected",
      "{outline:3px solid #ef414b!important;outline-offset:3px!important;",
      "box-shadow:0 0 0 5px rgba(239,65,75,.12)!important}",
      "a:not([href^='#']){cursor:default}"
    ].join("");
    const older = doc.getElementById(style.id);
    if(older) older.remove();
    doc.head.appendChild(style);
    applyDraft();
  }

  function preventSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (bridge) bridge.notify("Forms are disabled in the editing preview. Use the real site to test them.");
  }

  function previewKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target || event.target.nodeType !== 1) return;
    const selection = recognize(event.target);
    if (selection) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pick(selection);
    }
  }

  function previewClick(event) {
    if (!bridge || !event.target || event.target.nodeType !== 1) return;
    // Let native product-tab controls switch their product lists.
    if (event.target.closest(".tab-btn")) return;
    const found = recognize(event.target);
    if (found) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pick(found);
      return;
    }
    const link = event.target.closest("a");
    if (link) {
      const href = link.getAttribute("href") || "";
      if (/^#[-a-z0-9_]+$/i.test(href)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      bridge.notify("Links are paused in edit mode. Choose View live site to open them.");
      return;
    }
    const button = event.target.closest("button");
    if (button && button.type === "submit") {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function recognize(el) {
    let node = el.closest("[data-cms-image]");
    if (node) {
      const key = node.getAttribute("data-cms-image");
      const article = /^article_(\d+)_image_path$/.exec(key);
      if (article && model().articles[Number(article[1])-1]) {
        return {kind:"record",type:"articles",index:Number(article[1])-1,
          title:"Article image",focus:"imagePath"};
      }
      return {kind:"path",path:"siteContent."+key,title:MEDIA_KEYS[key] || words(key),
        control:"image",fallback:node.getAttribute("src") || "",key:key};
    }
    node = el.closest("[data-visual-product-id]");
    if(node) {
      const id=node.getAttribute("data-visual-product-id");
      const index=model().products.findIndex(function(p){return String(p.id)===id;});
      if(index>=0) return {kind:"record",type:"products",index:index,
        title:model().products[index].name || "Product"};
    }
    node = el.closest("[data-visual-brand-index]");
    if(node){
      const index=Number(node.getAttribute("data-visual-brand-index"));
      if(Number.isInteger(index) && index>=0 && index<model().showcaseCars.length)
        return {kind:"path",path:"showcaseCars."+index,
          title:"Vehicle brand: "+model().showcaseCars[index],control:"text",
          key:"showcase-brand",fallback:""};
    }
    node = el.closest("[data-cms]");
    if(node) {
      const key=node.getAttribute("data-cms");
      if(Object.prototype.hasOwnProperty.call(model().siteContent,key))
        return {kind:"path",path:"siteContent."+key,title:words(key),
          control:isLong(key,model().siteContent[key])?"textarea":"text",key:key,fallback:""};
      const linked = recognizeCollectionKey(key);
      if(linked) return linked;
    }
    node = el.closest("[data-cms-href]");
    if(node) {
      const key=node.getAttribute("data-cms-href");
      const linked=recognizeCollectionKey(key);
      if(linked)return linked;
      if(Object.prototype.hasOwnProperty.call(model().siteContent,key))
        return {kind:"path",path:"siteContent."+key,title:words(key),
          control:"text",key:key,fallback:""};
    }
    for (const [type,attrib] of [
      ["services","data-cms-service-container"],
      ["reviews","data-cms-review-container"],
      ["articles","data-cms-article-container"]
    ]) {
      node=el.closest("["+attrib+"]");
      if(node) {
        const index=Number(node.getAttribute(attrib))-1;
        if(model()[type][index])
          return {kind:"record",type:type,index:index,title:recordTitle(type,index)};
      }
    }
    if(el.closest("#home"))return {kind:"path",path:"siteContent.hero_background_image",
      title:"Homepage hero background",control:"image",
      key:"hero_background_image",fallback:"generated/hero-premium.jpg"};
    return null;
  }

  function recognizeCollectionKey(key) {
    const m=/^(service|review|article)_(\d+)_(.+)$/.exec(key || "");
    if (!m) return null;
    const type={service:"services",review:"reviews",article:"articles"}[m[1]];
    const index=Number(m[2])-1;
    if(!model()[type] || !model()[type][index])return null;
    return {kind:"record",type:type,index:index,title:recordTitle(type,index)};
  }

  function recordTitle(type,index){
    const item=(model()[type] || [])[index] || {};
    return item.name || item.title || ("Item "+(index+1));
  }
  function isLong(key,value) {
    return String(value || "").length > 80 ||
      /description|summary|quote|privacy|blurb/.test(key);
  }

  function pick(selection) {
    selected=selection;
    const panel=$("vInspector");
    panel.hidden=false;
    panel.classList.add("open");
    $("vPreviewHelp").hidden=true;
    renderInspector();
    highlight();
  }
  function closeInspector(){
    const panel=$("vInspector");
    if(panel) {
      panel.classList.remove("open");
      panel.hidden=true;
    }
    if(previewDoc)previewDoc.querySelectorAll(".dashcam-visual-selected").forEach(function(el){
      el.classList.remove("dashcam-visual-selected");
    });
    selected=null;
  }

  function renderInspector() {
    if(!selected || !bridge)return;
    const title=selected.title || "Edit selected content";
    $("vInspectorTitle").textContent=title;
    $("vInspectorSubtitle").textContent =
      selected.kind==="record" ? "Edit this card and preview every change instantly." :
        selected.control==="image" ? "Upload or replace this image. The layout stays the same." :
          "Update the field below to see the result immediately.";

    let fields="";
    if(selected.kind==="record"){
      const row=model()[selected.type][selected.index];
      fields += '<div class="v-selected-category">EDIT '+esc(selected.type.toUpperCase())+
        ' · ITEM '+(selected.index+1)+'</div>';
      fields += FIELDS[selected.type].map(function(def){
        const title=def[0],key=def[1],kind=def[2];
        const val=row[key]===undefined?"":row[key];
        return renderField(title,selected.type+"."+selected.index+"."+key,
          val,kind,key);
      }).join("");
      fields += '<div class="v-inspector-links"><button type="button" data-v-goto="' +
        esc(selected.type) + '">View all '+esc(selected.type)+' in list editor ↗</button></div>';
    } else {
      const path=selected.path;
      const value=findPath(path);
      fields=renderField(selected.title,path,value === undefined ? selected.fallback : value,
        selected.control,selected.key);
      if(selected.control!=="image")fields +=
        '<p class="v-edit-hint">This change updates the same text wherever it appears on the website.</p>';
    }
    $("vInspectorFields").innerHTML=fields;
  }

  function renderField(title,path,raw,kind,key) {
    const array=Array.isArray(raw);
    const value=array ? raw.join(", ") : (raw==null?"":String(raw));
    const id="vField_"+path.replace(/[^a-z0-9]/gi,"_");
    let control="";
    if(kind==="checkbox"){
      // A missing published property means "published", as in the original site.
      const checked=raw!==false;
      control='<label class="v-toggle"><input type="checkbox" data-v-path="'+esc(path)+'" data-v-format="checkbox" '+
        (checked?"checked":"")+'> Visible on website</label>';
    } else if(kind==="textarea") {
      control='<textarea class="v-input v-textarea" id="'+esc(id)+'" rows="5" data-v-path="'+esc(path)+
        '" data-v-format="text">'+esc(value)+'</textarea>';
    } else if(kind==="number") {
      control='<input class="v-input" id="'+esc(id)+'" type="number" step="any" data-v-path="'+esc(path)+
        '" data-v-format="number" value="'+esc(value)+'">';
    } else {
      control='<input class="v-input" id="'+esc(id)+'" type="text" data-v-path="'+esc(path)+
        '" data-v-format="'+esc(kind==="csv"?"csv":"text")+'" value="'+esc(value)+'">';
    }
    const isImage=kind==="image", imageUrl=isImage?resolveImage(value):"";
    return '<div class="v-field">'+
      (kind==="checkbox" ? "" : '<label for="'+esc(id)+'">'+esc(title)+'</label>')+
      (isImage ? '<img class="v-image-preview" src="'+esc(imageUrl)+'" alt="'+esc(title)+'" loading="lazy">' : '')+
      control +
      (isImage ? '<label class="v-file-button" for="vUpload_'+esc(id)+'">↑ &nbsp; Upload new photo</label>'+
        '<input class="v-file-input" id="vUpload_'+esc(id)+'" data-v-upload="'+esc(path)+
        '" type="file" accept="image/jpeg,image/png,image/webp">' +
        '<small>JPG, PNG or WebP · up to 5 MB</small>' : "") +
      (kind==="csv" ? '<small>Separate items with commas.</small>' : "")+
      '</div>';
  }

  function resolveImage(value) {
    if(/^https:\/\//i.test(value))return value;
    if (/^(?:\.\/)?generated\/[a-zA-Z0-9._/-]+$/.test(value))
      return new URL(value,new URL("../",window.location.href)).href;
    return "";
  }

  function highlight() {
    if(!previewDoc || !selected)return;
    previewDoc.querySelectorAll(".dashcam-visual-selected").forEach(function(el){
      el.classList.remove("dashcam-visual-selected");
    });
    let candidates=[];
    if(selected.kind==="record"){
      const n=selected.index+1;
      if(selected.type==="products"){
        const id=model().products[selected.index] && model().products[selected.index].id;
        candidates=Array.from(previewDoc.querySelectorAll("[data-visual-product-id]")).filter(function(el){
          return el.getAttribute("data-visual-product-id")===String(id);
        });
      } else {
        const key={"services":"service","reviews":"review","articles":"article"}[selected.type];
        candidates=Array.from(previewDoc.querySelectorAll("[data-cms-"+key+"-container='"+n+"']"));
      }
    } else {
      const path=selected.path;
      if(path.indexOf("siteContent.")===0){
        const key=path.slice("siteContent.".length);
        candidates=Array.from(previewDoc.querySelectorAll("[data-cms], [data-cms-image]")).filter(function(el){
          return el.getAttribute("data-cms")===key || el.getAttribute("data-cms-image")===key;
        });
        if(!candidates.length && key==="hero_background_image"){
          const hero=previewDoc.getElementById("home");
          if(hero)candidates=[hero];
        }
      } else if(path.indexOf("showcaseCars.")===0){
        const index=path.split(".")[1];
        candidates=Array.from(previewDoc.querySelectorAll("[data-visual-brand-index]")).filter(function(el){
          return el.getAttribute("data-visual-brand-index")===index;
        });
      }
    }
    candidates.forEach(function(el){el.classList.add("dashcam-visual-selected");});
  }

  function applyDraft() {
    if(!frame || !bridge || !model())return;
    try {
      const w=frame.contentWindow;
      if(w && typeof w.__dashcamApplyVisualDraft==="function") {
        w.__dashcamApplyVisualDraft(model());
        highlight();
        return true;
      }
    } catch(err){
      bridge.notify("Preview update failed: "+err.message,true);
    }
    return false;
  }

  function parseValue(input) {
    const kind=input.dataset.vFormat;
    if(kind==="checkbox")return input.checked;
    if(kind==="number") {
      if(input.value.trim()==="")return null;
      const n=Number(input.value);
      return Number.isFinite(n)?n:null;
    }
    if(kind==="csv")return input.value.split(",").map(function(x){return x.trim();}).filter(Boolean);
    return input.value;
  }

  function inputField(event) {
    const input=event.target;
    if(!input || !input.matches("[data-v-path]"))return;
    if(input.dataset.vFormat==="checkbox")return;
    const value=parseValue(input);
    if(input.dataset.vFormat==="number" && input.value.trim()!=="" && value===null)return;
    bridge.set(input.dataset.vPath,value);
    applyDraft();
  }

  function changeField(event) {
    const input=event.target;
    if (!input)return;
    if(input.matches("[data-v-path]") && input.dataset.vFormat==="checkbox"){
      bridge.set(input.dataset.vPath,input.checked);
      applyDraft();
    }
    if(input.matches("[data-v-upload]"))upload(input);
  }

  async function upload(el) {
    const file=el.files && el.files[0];
    if(!file || !bridge || busyUploading)return;
    busyUploading=true;
    el.disabled=true;
    const target=el.dataset.vUpload;
    try {
      bridge.notify("Uploading image to Supabase…");
      const url=await bridge.upload(file);
      if(!mounted)return;
      bridge.set(target,url);
      applyDraft();
      renderInspector();
      bridge.notify("Image uploaded! It is still a draft until you publish.");
    } catch (error) {
      bridge.notify("Upload failed: "+(error.message||error),true);
      if(mounted){el.disabled=false;el.value="";}
    } finally {busyUploading=false;}
  }

  function clickControls(event) {
    const el=event.target;
    if(!el || el.nodeType!==1)return;
    const toggle=el.closest("[data-v-device]");
    if(toggle){setDevice(toggle.dataset.vDevice);return;}
    const go=el.closest("[data-v-goto]");
    if(go && bridge){bridge.navigate(go.dataset.vGoto);return;}
    if(el.closest("#vCloseInspector")) {closeInspector();return;}
    if(el.closest("#vReloadPreview")){
      if(frame)frame.src="../?visual-preview=1&refresh="+Date.now();
      bridge.notify("Reloading the website preview…");
      return;
    }
    if(el.closest("#vDiscard")){
      if(!bridge.isDirty()){bridge.notify("There are no unpublished edits.");return;}
      if(window.confirm("Discard ALL unpublished edits from this editing session?")){
        bridge.rollback();
        applyDraft();
        if(selected)renderInspector();
        bridge.notify("Draft edits discarded. Published content restored.");
      }
      return;
    }
    if(el.closest("#vInspectorPublish") && bridge)bridge.publish();
  }

  function jumpToSection(){
    if(!frame || !frame.contentDocument)return;
    const id=$("vJump").value;
    const aliases={
      home:["home"],services:["services"],products:["products"],
      about:["about"],tesla:["tesla"],brands:["brands","brand-tiles","brandTiles"],
      showcase:["showcase"],reviews:["reviews","testimonials"],
      blog:["blog"],contact:["contact"]
    };
    const ids=aliases[id] || [id];
    let target=null;
    for(const name of ids){
      target=frame.contentDocument.getElementById(name);
      if(target)break;
    }
    if(!target){
      const anchors=Array.from(frame.contentDocument.querySelectorAll("a[href^='#']"));
      const link=anchors.find(function(a){return a.textContent.toLowerCase().includes(id);});
      if(link)target=frame.contentDocument.querySelector(link.getAttribute("href"));
    }
    if(target)target.scrollIntoView({behavior:"smooth",block:"start"});
    else if(bridge)bridge.notify("Scroll within the preview to find this section.");
  }

  window.DashcamVisual={
    html:html,mount:mount,unmount:unmount
  };
})();
