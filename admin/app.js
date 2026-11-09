(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SITE_URL = "../";
  const BUCKET = "site-media";
  const GROUPS = [
    { name: "SEO & Social Sharing", match: (k) => /^(meta_|og_|twitter_)/.test(k) },
    { name: "Business & Contact Details", match: (k) => /^(brand_name|brand_tagline|phone_|email_|business_|google_)/.test(k) },
    { name: "Homepage Hero", match: (k) => /^(hero_|install_card_|price_)/.test(k) },
    { name: "Rideshare Section", match: (k) => /^rideshare_/.test(k) },
    { name: "Services Section", match: (k) => /^services_/.test(k) },
    { name: "Products & Featured Items", match: (k) => /^(featured_|product_tab|product_tabs)/.test(k) },
    { name: "About & Benefits", match: (k) => /^(about_|stat_)/.test(k) },
    { name: "Tesla Section", match: (k) => /^tesla_/.test(k) },
    { name: "Vehicle & Brand Showcase", match: (k) => /^(brands_|showcase_)/.test(k) },
    { name: "Reviews & Trust", match: (k) => /^reviews_/.test(k) },
    { name: "Call to Action", match: (k) => /^cta_/.test(k) },
    { name: "Articles", match: (k) => /^blog_/.test(k) },
    { name: "Social Media", match: (k) => /^instagram_/.test(k) },
    { name: "Contact & Forms", match: (k) => /^(contact_|form_)/.test(k) },
    { name: "Newsletter", match: (k) => /^newsletter_/.test(k) },
    { name: "Footer", match: (k) => /^footer_/.test(k) },
    { name: "Other Content", match: () => true }
  ];
  const SECTIONS = {
    visual: ["Visual Editor", "Click on your actual website to edit the content while seeing each change.", "LIVE PREVIEW"],
    overview: ["Overview", "Your website at a glance", "CONTENT MANAGEMENT"],
    text: ["Website Text", "Edit headlines, buttons, descriptions and business information.", "PAGE CONTENT"],
    products: ["Products", "Manage products, prices, images, badges and product tabs.", "YOUR CATALOG"],
    services: ["Services", "Update the four existing service cards and choose which ones are visible.", "WHAT YOU OFFER"],
    reviews: ["Reviews", "Edit or hide the four review cards. Publish only authentic customer feedback.", "SOCIAL PROOF"],
    articles: ["Articles", "Edit the three article cards shown on the homepage.", "INSIGHTS & GUIDES"],
    showcaseCars: ["Vehicle Brands", "Edit the vehicle names shown in the compatibility showcase.", "COMPATIBILITY"],
    media: ["Images & Media", "Replace hero, installation, rideshare and Tesla section images.", "VISUAL ASSETS"]
  };
  const MEDIA = [
    ["hero_background_image", "Homepage hero background", "The large image behind the homepage headline"],
    ["rideshare_image", "Rideshare card", "Image shown in the rideshare promo"],
    ["install_image", "Installation section", "Installation photo in the About section"],
    ["tesla_image", "Tesla section", "Tesla image beside the Tesla benefits"]
  ];

  let client = null;
  let editorEmail = "";
  let model = null;
  let savedModel = null;
  let rowVersion = null;
  let section = "overview";
  let dirty = false;
  let saving = false;
  let toastTimer = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) =>
      ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function labelize(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
      .replace(/\bOg\b/g,"Open Graph").replace(/\bCta\b/g,"CTA")
      .replace(/\bSeo\b/g,"SEO").replace(/\bHref\b/g,"Link");
  }
  function showOnly(id) {
    ["loadingScreen","setupScreen","signInScreen","editorScreen"].forEach((name) => {
      $(name).hidden = name !== id;
    });
  }
  function notice(message, isError) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }
  function configured() {
    const c = window.DASHCAM_SUPABASE || {};
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.url || "") &&
      typeof c.anonKey === "string" && c.anonKey.length > 25 &&
      !c.anonKey.includes("YOUR_");
  }
  function isLong(k, v) {
    return String(v || "").length > 100 ||
      /description|summary|quote|privacy_note|footer_description|blurb|feature_.*_description/.test(k);
  }
  function field(label, path, value, opts) {
    opts = opts || {};
    const long = !!opts.long;
    const span = long ? " span-2" : "";
    let control = "";
    if (opts.type === "number") {
      control = '<input class="field-control" type="number" step="any" data-path="' + esc(path) +
        '" data-format="number" value="' + esc(value) + '">';
    } else if (long) {
      control = '<textarea class="field-control textarea" rows="3" data-path="' + esc(path) +
        '" data-format="' + esc(opts.format || "string") + '">' + esc(value) + '</textarea>';
    } else {
      control = '<input class="field-control" type="text" data-path="' + esc(path) +
        '" data-format="' + esc(opts.format || "string") + '" value="' + esc(value) + '">';
    }
    const upload = opts.image ? '<div class="upload-row"><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="' + esc(path) + '" aria-label="Upload image for ' + esc(label) + '"><small class="muted">PNG, JPG or WebP · max 5 MB</small></div>' : "";
    return '<div class="field' + span + '"><label>' + esc(label) + '</label>' +
      control + upload + (opts.hint ? '<span class="hint">' + esc(opts.hint) + '</span>' : "") + '</div>';
  }
  function panel(title, note, body, trailing) {
    return '<section class="panel"><div class="panel-head"><div><h2>' + esc(title) +
      '</h2><p>' + esc(note || "") + '</p></div>' + (trailing || "") +
      '</div><div class="panel-body">' + body + '</div></section>';
  }
  function get(path) {
    return path.split(".").reduce((o, k) => o == null ? undefined : o[k], model);
  }
  function set(path, value) {
    const parts = path.split(".");
    let node = model;
    for (let i=0; i<parts.length - 1; i++) {
      if (node[parts[i]] == null) return;
      node = node[parts[i]];
    }
    node[parts[parts.length-1]] = value;
  }
  function markDirty() {
    dirty = true;
    $("saveButton").disabled = false;
    $("saveStatus").textContent = "Unpublished changes";
    $("saveStatus").classList.add("dirty");
  }
  function markSaved() {
    dirty = false;
    $("saveButton").disabled = true;
    $("saveStatus").textContent = "All changes published";
    $("saveStatus").classList.remove("dirty");
  }
  function requireClean() {
    return !dirty || window.confirm("You have unpublished changes. Discard them?");
  }
  async function signIn(event) {
    event.preventDefault();
    $("authError").hidden = true;
    $("loginButton").disabled = true;
    try {
      const email = $("loginEmail").value.trim();
      const password = $("loginPassword").value;
      const out = await client.auth.signInWithPassword({email:email,password:password});
      if (out.error) throw out.error;
      await openEditor(out.data.user);
    } catch (error) {
      $("authError").textContent = error.message || "Unable to sign in.";
      $("authError").hidden = false;
    } finally {
      $("loginButton").disabled = false;
    }
  }
  async function openEditor(user) {
    if (!user) { showOnly("signInScreen"); return; }
    const result = await client.from("cms_editors").select("user_id").eq("user_id",user.id).maybeSingle();
    if (result.error || !result.data) {
      await client.auth.signOut();
      showOnly("signInScreen");
      $("authError").textContent = "This account is not approved as a website editor. Add its Supabase Auth user ID to cms_editors.";
      $("authError").hidden = false;
      return;
    }
    editorEmail = user.email || "Website editor";
    $("userEmail").textContent = editorEmail;
    await loadContent();
    showOnly("editorScreen");
    navigate("visual");
  }
  async function loadContent() {
    const result = await client.from("cms_content").select("payload,updated_at").eq("id","main").single();
    if (result.error || !result.data || !result.data.payload || !result.data.payload.siteContent) {
      throw new Error("CMS data not found. Run supabase/setup.sql to initialize the database.");
    }
    model = result.data.payload;
    rowVersion = result.data.updated_at;
    savedModel = JSON.stringify(model);
    markSaved();
  }
  async function init() {
    if (!configured()) { showOnly("setupScreen"); return; }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      showOnly("setupScreen");
      $("setupScreen").querySelector(".muted").textContent =
        "The Supabase library could not load. Check your internet connection and reload this page.";
      return;
    }
    try {
      const c = window.DASHCAM_SUPABASE;
      client = window.supabase.createClient(c.url, c.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const session = await client.auth.getSession();
      if (session.error) throw session.error;
      if (session.data.session) await openEditor(session.data.session.user);
      else showOnly("signInScreen");
    } catch (error) {
      showOnly("signInScreen");
      $("authError").textContent = error.message || "Unable to connect to Supabase.";
      $("authError").hidden = false;
    }
  }
  function navigate(next) {
    if (!model || !SECTIONS[next]) return;
    if (section === "visual" && next !== "visual" && window.DashcamVisual) window.DashcamVisual.unmount();
    section = next;
    document.body.classList.toggle("visual-mode", next === "visual");
    document.querySelectorAll("[data-section]").forEach((el) => {
      el.classList.toggle("active", el.dataset.section === next);
    });
    const [title,desc,eyebrow] = SECTIONS[next];
    $("pageTitle").textContent = title;
    $("pageDescription").textContent = desc;
    $("pageEyebrow").textContent = eyebrow;
    $("crumbSection").textContent = title;
    $("searchWrap").hidden = next !== "text";
    if (next !== "text") $("fieldSearch").value = "";
    render();
    if (next === "visual" && window.DashcamVisual) window.DashcamVisual.mount(window.DashcamVisualBridge);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function render() {
    const map = {
      visual:() => window.DashcamVisual ? window.DashcamVisual.html() : "<p>Visual editor unavailable. Refresh this page.</p>",
      overview:renderOverview,
      text:renderText,
      products:() => renderRecords("products"),
      services:() => renderRecords("services"),
      reviews:() => renderRecords("reviews"),
      articles:() => renderRecords("articles"),
      showcaseCars:renderShowcase,
      media:renderMedia
    };
    $("workspaceContent").innerHTML = map[section]();
  }
  function renderOverview() {
    const n = (key) => (model[key] || []).length;
    const blocks = [
      ["Editable text fields", Object.keys(model.siteContent || {}).length, "Headlines, buttons and details"],
      ["Products", n("products"), "Editable prices and specs"],
      ["Services", n("services"), "Homepage service cards"],
      ["Customer reviews", n("reviews"), "Visible if published"]
    ];
    let html = '<div class="overview-hero"><div><div class="eyebrow">YOUR WEBSITE IS CONNECTED</div>' +
      '<h2>Make changes with confidence.</h2><p>Edit website content here, select Publish, and your changes will appear on the live site on its next refresh. No coding and no spreadsheets required.</p></div>' +
      '<button type="button" data-go="visual">Open visual editor →</button></div><div class="stat-grid">';
    blocks.forEach((b) => {
      html += '<div class="stat-card"><small>' + esc(b[0]) + '</small><strong>' +
        esc(b[1]) + '</strong><span class="sub">' + esc(b[2]) + '</span></div>';
    });
    html += '</div>' + panel("Quick actions", "Jump right into the part of your website you want to change.",
      '<div class="tips"><div class="tip"><strong>✎ &nbsp; Update a headline</strong><p>Change the hero heading, a button, or any other text on the site.</p><button data-go="text">Edit website text →</button></div>' +
      '<div class="tip"><strong>▣ &nbsp; Replace an image</strong><p>Upload a new hero, installation, rideshare or Tesla image.</p><button data-go="media">Manage images →</button></div>' +
      '<div class="tip"><strong>▤ &nbsp; Update product pricing</strong><p>Adjust your product lineup, prices, descriptions and photos.</p><button data-go="products">Manage products →</button></div>' +
      '<div class="tip"><strong>☆ &nbsp; Manage reviews</strong><p>Edit existing reviews and hide any that should not appear publicly.</p><button data-go="reviews">Manage reviews →</button></div></div>') +
      '<div class="note"><strong>Publishing:</strong> Use the red Publish changes button after editing. If you leave without publishing, your changes will be lost.' +
      (rowVersion ? '<br>Last published in Supabase: ' + esc(new Date(rowVersion).toLocaleString()) : '') + '</div>';
    return html;
  }
  function renderText() {
    const source = model.siteContent || {};
    const filter = $("fieldSearch").value.toLowerCase().trim();
    const keys = Object.keys(source).filter((k) => !MEDIA.some((m) => m[0] === k));
    const used = new Set();
    let html = "";
    GROUPS.forEach((group) => {
      const selection = keys.filter((k) => !used.has(k) && group.match(k));
      selection.forEach((k) => used.add(k));
      const found = selection.filter((k) =>
        !filter || (labelize(k) + " " + group.name + " " + String(source[k])).toLowerCase().includes(filter));
      if (!found.length) return;
      html += panel(group.name, found.length + " editable fields",
        '<div class="fields-grid">' + found.map((key) =>
          field(labelize(key), "siteContent." + key, source[key], {
            long:isLong(key,source[key]),
            hint:key
          })).join("") + '</div>');
    });
    if (!html) html = '<div class="empty">No matching fields. Try another search.</div>';
    return html;
  }
  function recordConfig(type) {
    const map = {
      products: {
        fields:[
          ["Product name","name"],["Brand","brand"],["Category","category"],["Product ID","id"],
          ["Price","price","number"],["Previous price","oldPrice","number"],
          ["Rating (0–5)","rating","number"],["Review count","reviews","number"],
          ["Description","blurb","long"],["Image","image","image"],
          ["Feature tags (comma-separated)","tags","csv"],["Badges (comma-separated)","badges","csv"],
          ["Show in product tabs (top, best, new)","list","csv"]
        ],
        note:"Add, remove, and price your product catalog. Only published products appear publicly."
      },
      services: {
        fields:[["Service name","title"],["Description","description","long"],["Button label","linkText"],["Button destination","linkUrl"]],
        note:"These four cards correspond to the four service positions in the homepage."
      },
      reviews: {
        fields:[["Customer name","name"],["Customer description","role"],["Rating (0–5)","rating","number"],["Review quote","quote","long"]],
        note:"Publish genuine customer feedback only. These four records map to existing homepage review cards."
      },
      articles: {
        fields:[["Article headline","title"],["Short summary","summary","long"],["Cover image","imagePath","image"],["Link label","linkText"],["Link destination","linkUrl"]],
        note:"These three cards map to the existing homepage article positions. Links may point to new pages or external articles."
      }
    };
    return map[type];
  }
  function renderRecords(type) {
    const arr = model[type] || [];
    const config = recordConfig(type);
    let body = '<div class="record-list">';
    arr.forEach((item, index) => {
      const name = item.name || item.title || ("Item " + (index+1));
      const path = type + "." + index + ".";
      const published = item.published !== false;
      body += '<div class="record"><div class="record-head"><div><h3>' + esc(name) +
        '</h3><p>Item ' + (index+1) + ' of ' + arr.length + '</p></div><div class="record-actions">';
      body += '<label class="toggle"><input type="checkbox" data-path="' + esc(path + "published") +
        '" data-format="boolean" ' + (published?"checked":"") + '> Published</label>';
      if (type === "products") {
        body += '<button type="button" class="ghost-btn danger" data-delete="' + index + '">Delete</button>';
      }
      body += '</div></div><div class="fields-grid">';
      config.fields.forEach((entry) => {
        const [label,key,kind] = entry;
        const v = item[key] == null ? "" : item[key];
        body += field(label,path+key,Array.isArray(v)?v.join(", "):v,{
          long:kind === "long",type:kind === "number"?"number":"text",
          format:kind === "csv"?"csv":"string",image:kind === "image"
        });
      });
      body += '</div></div>';
    });
    body += '</div>';
    if (type === "products") {
      body += '<div class="item-footer"><button class="ghost-btn" data-add-product>+ Add a product</button>' +
        '<span class="muted">New items are included in the site after publishing.</span></div>';
    }
    if (arr.length === 0) body = '<div class="empty">No items yet.</div>' + body;
    return panel(SECTIONS[type][0],config.note,body,
      '<span class="tag">' + arr.length + ' records</span>');
  }
  function renderShowcase() {
    return panel("Compatible vehicle brands", "One vehicle brand per line. The site renders these dynamically.",
      '<div class="fields-grid"><div class="field span-2"><label>Vehicle brands (' + model.showcaseCars.length + ')</label>' +
      '<textarea rows="16" class="field-control textarea" style="min-height:300px" data-path="showcaseCars" data-format="lines">' +
      esc(model.showcaseCars.join("\n")) + '</textarea><span class="hint">Add, remove or reorder vehicle names. One brand per line.</span></div></div>');
  }
  function mediaCard(key,title,description) {
    const value = model.siteContent[key] || "";
    const safe = /^(https:\/\/|generated\/)/i.test(value) ? value : "";
    return panel(title,description,'<div class="media-box"><img class="media-preview" src="' + esc(safe) +
      '" alt="' + esc(title) + '" loading="lazy"><div>' +
      '<div class="fields-grid">' + field("Image URL or repository path", "siteContent."+key,value,{
        hint:"Uploaded images are stored in your Supabase site-media bucket.",
        image:true
      }) + '</div></div></div>');
  }
  function renderMedia() {
    return '<div class="note" style="margin-bottom:20px"><strong>Easy image uploads:</strong> Choose a JPG, PNG, or WebP and we will upload it to Supabase Storage. Then click Publish changes to make it live. Uploaded images are publicly viewable, but only approved editors can upload.</div>' +
      MEDIA.map((m) => mediaCard(m[0],m[1],m[2])).join("");
  }
  async function uploadImage(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    if (!["image/jpeg","image/png","image/webp"].includes(f.type)) {
      notice("Please choose a PNG, JPG or WebP image.",true);el.value="";return;
    }
    if (f.size > 5*1024*1024) {
      notice("Please choose an image smaller than 5 MB.",true);el.value="";return;
    }
    const path = el.dataset.upload;
    const ext = { "image/jpeg":"jpg","image/png":"png","image/webp":"webp" }[f.type];
    const objectName = "uploads/" + Date.now() + "-" + Math.random().toString(36).slice(2,9) + "." + ext;
    el.disabled = true;
    notice("Uploading image…");
    try {
      const uploaded = await client.storage.from(BUCKET).upload(objectName,f,{contentType:f.type,upsert:false});
      if (uploaded.error) throw uploaded.error;
      const url = client.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl;
      set(path,url);
      markDirty();
      render();
      notice("Image uploaded. Click Publish changes to update the live site.");
    } catch (error) {
      notice("Upload failed: " + error.message,true);
      el.disabled = false;
      el.value="";
    }
  }
  function handleField(event) {
    const el = event.target;
    if (el.matches("[data-upload]")) {
      if(event.type === "change") uploadImage(el);
      return;
    }
    if (!el.matches("[data-path]")) return;
    if (event.type === "input" && el.type === "checkbox") return;
    let value = el.type === "checkbox" ? el.checked : el.value;
    const kind = el.dataset.format;
    if (kind === "number") {
      value = value.trim() === "" ? null : Number(value);
      if (value !== null && !Number.isFinite(value)) return;
    } else if (kind === "csv") {
      value = value.split(",").map((x)=>x.trim()).filter(Boolean);
    } else if (kind === "lines") {
      value = value.split(/\r?\n/).map((x)=>x.trim()).filter(Boolean);
    }
    set(el.dataset.path,value);
    markDirty();
  }
  function addProduct() {
    model.products.push({
      id:"new-product-"+Date.now(),
      name:"New dash camera",brand:"",category:"2-Channel",
      price:0,oldPrice:null,rating:5,reviews:0,blurb:"",
      tags:[],badges:[],list:["top"],image:"generated/product-1.png",published:true
    });
    markDirty();
    render();
    notice("New product added. Edit its details and publish.");
  }
  function removeProduct(index) {
    const item = model.products[index];
    if (!item || !window.confirm("Remove " + item.name + " from your product catalog?")) return;
    model.products.splice(index,1);
    markDirty();
    render();
    notice("Product removed from the draft.");
  }
  async function save() {
    if (!dirty || saving) return;
    if (!model || !model.siteContent || !Array.isArray(model.products)) {
      notice("Your data is incomplete. Nothing was published.",true);return;
    }
    saving = true;
    $("saveButton").disabled = true;
    $("saveButton").textContent = "Publishing…";
    try {
      const result = await client.from("cms_content")
        .update({payload:model})
        .eq("id","main")
        .eq("updated_at",rowVersion)
        .select("updated_at")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Another editor published a change. Reload the page before saving again.");
      rowVersion = result.data.updated_at;
      savedModel = JSON.stringify(model);
      markSaved();
      notice("Published successfully. Refresh your live website to see the changes!");
    } catch (error) {
      markDirty();
      notice("Publish failed: " + error.message,true);
    } finally {
      saving = false;
      $("saveButton").textContent = "Publish changes ↗";
    }
  }
  async function signOut() {
    if (!requireClean()) return;
    try { await client.auth.signOut(); } catch (_) {}
    model = null;
    dirty = false;
    document.body.classList.remove("visual-mode");
    if (window.DashcamVisual) window.DashcamVisual.unmount();
    $("loginForm").reset();
    $("authError").hidden = true;
    showOnly("signInScreen");
  }

  window.DashcamVisualBridge = {
    getModel: () => model,
    get: (path) => get(path),
    set: (path, value) => { set(path, value); markDirty(); },
    markDirty: markDirty,
    publish: save,
    notify: notice,
    navigate: navigate,
    isDirty: () => dirty,
    rollback: () => {
      if (!savedModel) return;
      model = JSON.parse(savedModel);
      markSaved();
    },
    upload: async (file) => {
      if (!file || !["image/jpeg","image/png","image/webp"].includes(file.type)) {
        throw new Error("Choose a JPG, PNG or WebP image.");
      }
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be smaller than 5 MB.");
      const ext = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
      const objectName = "uploads/" + Date.now() + "-" + Math.random().toString(36).slice(2,10) + "." + ext;
      const response = await client.storage.from(BUCKET).upload(objectName,file,{
        contentType:file.type,upsert:false
      });
      if (response.error) throw response.error;
      return client.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl;
    }
  };

  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) navigate(go.dataset.go);
    const tab = event.target.closest("[data-section]");
    if (tab) navigate(tab.dataset.section);
    const remove = event.target.closest("[data-delete]");
    if (remove) removeProduct(Number(remove.dataset.delete));
    if (event.target.closest("[data-add-product]")) addProduct();
  });
  document.addEventListener("input",handleField);
  document.addEventListener("change",handleField);
  $("loginForm").addEventListener("submit",signIn);
  $("saveButton").addEventListener("click",save);
  $("signOutButton").addEventListener("click",signOut);
  $("fieldSearch").addEventListener("input",() => {if(section==="text")render();});
  window.addEventListener("beforeunload",(event) => {if(dirty){event.preventDefault();event.returnValue="";}});
  init();
})();
