
const DATA_FILES = {
  cocktails: "data/cocktails.json",
  ingredients: "data/ingredients.json",
  techniques: "data/techniques.json",
  glassware: "data/glassware.json",
  rules: "data/utah-rules.json",
  questions: "data/questions.json",
  scenarios: "data/scenarios.json"
};

const NAV = [
  ["home","Home","i-home"],
  ["cocktails","Cocktail Database","i-glass"],
  ["study","Study","i-study"],
  ["practice","Practice Bar","i-practice"],
  ["ingredients","Ingredients","i-ingredient"],
  ["techniques","Techniques","i-technique"],
  ["law","Utah Law","i-law"],
  ["progress","Progress","i-progress"],
  ["favorites","Favorites","i-heart"]
];

const STORAGE_KEY = "uca_state_v1";
const today = () => new Date().toISOString().slice(0,10);
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const titleCase = value => String(value ?? "").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const icon = id => `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;

const defaultState = {
  skillLevel: "New bartender",
  favorites: [],
  viewed: [],
  studied: [],
  mastered: {},
  notes: {},
  houseSpecs: {},
  hidden: [],
  inventory: [],
  flashcards: {},
  quizHistory: [],
  scenarioHistory: [],
  recentMisses: [],
  currentStreak: 0,
  lastStudyDate: null,
  bestTimedScore: 0,
  legalHistory: [],
  legalReviewDate: null,
  settings: {fontScale: 1, reducedMotion: false},
  customCocktails: []
};

let data = {};
let state = loadState();
let session = {};
let activeSpec = "utah";

function loadState(){
  try{
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return deepMerge(structuredClone(defaultState), parsed);
  }catch(err){
    console.warn("Could not load saved state", err);
    return structuredClone(defaultState);
  }
}
function deepMerge(target, source){
  if(!source || typeof source !== "object") return target;
  for(const [key,val] of Object.entries(source)){
    if(val && typeof val === "object" && !Array.isArray(val)){
      target[key] = deepMerge(target[key] && typeof target[key]==="object" ? target[key] : {}, val);
    }else target[key]=val;
  }
  return target;
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  applySettings();
}
function applySettings(){
  document.documentElement.style.setProperty("--font-scale", String(state.settings.fontScale || 1));
  document.documentElement.dataset.reducedMotion = String(Boolean(state.settings.reducedMotion));
}
function toast(message){
  const node=$("#toast");
  node.textContent=message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>node.classList.remove("show"),2600);
}
function routeTo(route){ location.hash = route.startsWith("#") ? route : `#${route}`; }
function currentRoute(){ return location.hash.replace(/^#/,"") || "home"; }
function setStudyActivity(){
  const d=today();
  if(state.lastStudyDate!==d){
    const prev=new Date(); prev.setDate(prev.getDate()-1);
    state.currentStreak = state.lastStudyDate===prev.toISOString().slice(0,10) ? state.currentStreak+1 : 1;
    state.lastStudyDate=d;
  }
  saveState();
}
function allCocktails(){ return [...(data.cocktails||[]), ...(state.customCocktails||[])]; }
function cocktailById(id){ return allCocktails().find(c=>c.id===id); }
function masteryValue(id){ return Number(state.mastered[id] || 0); }
function masteryLabel(value){ return value>=4?"Mastered":value===3?"Almost":value===2?"Difficult":value===1?"Again":"Unrated"; }
function markViewed(id){
  state.viewed=[id,...state.viewed.filter(x=>x!==id)].slice(0,12);
  if(!state.studied.includes(id)) state.studied.push(id);
  saveState();
}
function toggleFavorite(id){
  state.favorites = state.favorites.includes(id) ? state.favorites.filter(x=>x!==id) : [...state.favorites,id];
  saveState();
}
function dayIndex(){
  const start=new Date(new Date().getFullYear(),0,0);
  return Math.floor((new Date()-start)/86400000);
}
function arrayUnique(values){ return [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))); }

async function loadData(){
  const pairs=await Promise.all(Object.entries(DATA_FILES).map(async ([key,url])=>{
    const res=await fetch(url);
    if(!res.ok) throw new Error(`Failed to load ${url}`);
    return [key,await res.json()];
  }));
  data=Object.fromEntries(pairs);
  const issues=validateCocktails(data.cocktails);
  if(issues.length) console.warn("Cocktail data warnings",issues);
}

function validateCocktails(cocktails){
  const required=["id","name","cocktailFamily","baseSpirit","standardSpecification","utahSpecification","preparationMethod","glassware","utahComplianceStatus"];
  const issues=[];
  const ids=new Set();
  cocktails.forEach((c,index)=>{
    required.forEach(k=>{if(c[k]===undefined||c[k]===null||c[k]==="") issues.push(`Record ${index} missing ${k}`)});
    if(ids.has(c.id)) issues.push(`Duplicate id ${c.id}`); ids.add(c.id);
    for(const spec of ["standardSpecification","utahSpecification"]){
      if(!Array.isArray(c[spec]?.ingredients)) issues.push(`${c.id} missing ${spec}.ingredients`);
    }
  });
  return issues;
}

function calculateCompliance(recipe){
  const limits=data.rules.limits;
  const ingredients=Array.isArray(recipe)?recipe:[];
  const amount=(classes)=>ingredients.filter(i=>i.unit==="oz"&&classes.includes(i.classification)).reduce((sum,i)=>sum+Number(i.amount||0),0);
  const primary=amount(["primary_spirit"]);
  const secondary=amount(["secondary_spirit"]);
  const uncertain=amount(["classification_uncertain"]);
  const wine=amount(["wine"]);
  const fortifiedWine=amount(["fortified_wine"]);
  const beer=amount(["beer"]);
  const heavyBeer=amount(["heavy_beer"]);
  const flavoredMalt=amount(["flavored_malt_beverage"]);
  const bitters=amount(["bitters"]);
  const nonAlcoholic=amount(["mixer","juice","syrup","dairy","herb","seasoning","nonalcoholic"]);
  const totalSpirit=primary+secondary;
  const problems=[];
  if(!ingredients.length) problems.push("No recipe ingredients are available for validation.");
  if(primary>limits.primarySpiritMaxOz+1e-9) problems.push(`Primary spirit is ${fmt(primary)} oz, above ${limits.primarySpiritMaxOz} oz.`);
  if(totalSpirit>limits.totalSpirituousLiquorMaxOz+1e-9) problems.push(`Total spirituous liquor is ${fmt(totalSpirit)} oz, above ${limits.totalSpirituousLiquorMaxOz} oz.`);
  if(wine>limits.wineIndividualPortionMaxOz+1e-9) problems.push(`Wine is ${fmt(wine)} oz, above ${limits.wineIndividualPortionMaxOz} oz.`);
  if(uncertain>0) problems.push(`${fmt(uncertain)} oz has uncertain legal classification. Verify classification with Utah DABS or management.`);
  let status="Utah compliant";
  if(!ingredients.length) status="Not enough information";
  else if(problems.some(p=>p.includes("above"))) status="Do not serve as written";
  else if(uncertain>0) status="Requires license-specific review";
  else if(secondary>0 || wine>0 || fortifiedWine>0 || beer>0 || heavyBeer>0 || flavoredMalt>0 || bitters>0) status="Compliant if prepared as specified";
  return {primary,secondary,uncertain,totalSpirit,wine,fortifiedWine,beer,heavyBeer,flavoredMalt,bitters,nonAlcoholic,status,problems};
}
function complianceStatusForCocktail(c){
  const calculated=calculateCompliance(c?.utahSpecification?.ingredients||[]).status;
  const configured=c?.utahComplianceStatus||"Not enough information";
  const caution=["Not enough information","Requires license-specific review","Do not serve as written"];
  if(calculated==="Do not serve as written") return calculated;
  if(caution.includes(configured)) return configured;
  return calculated;
}

function fmt(n){ return Number(n).toFixed(2).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1"); }

function navMarkup(){
  return NAV.map(([route,label,ic])=>`<a class="nav-link" href="#${route}" data-route="${route}">${icon(ic)}<span>${esc(label)}</span></a>`).join("");
}
function updateNav(route){
  const root=route.split("/")[0];
  $$(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.route===root));
  const found=NAV.find(x=>x[0]===root);
  $("#page-title").textContent=found?.[1] || (route.startsWith("cocktail/")?"Cocktail":"Utah Cocktail Academy");
}
function initNavigation(){
  $("#desktop-nav").innerHTML=navMarkup();
  $("#mobile-nav").innerHTML=navMarkup();
  $("#menu-toggle").addEventListener("click",()=>{
    const open=$(".sidebar").classList.toggle("open");
    $("#menu-toggle").setAttribute("aria-expanded",String(open));
  });
  document.addEventListener("click",e=>{
    const nav=e.target.closest("[data-route]");
    if(nav && innerWidth<=820) $(".sidebar").classList.remove("open");
  });
}

function pageHead(eyebrow,title,description,actions=""){
  return `<div class="page-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div><div class="page-actions">${actions}</div></div>`;
}
function statusBadge(status){ return `<span class="status" data-status="${esc(status)}">${esc(status)}</span>`; }
function miniLink(c){
  return `<a class="mini-link" href="#cocktail/${c.id}"><span>${esc(c.name)}</span><small>${esc(c.baseSpirit)}</small></a>`;
}
function cocktailCard(c){
  const fav=state.favorites.includes(c.id);
  return `<article class="cocktail-card" data-open-cocktail="${esc(c.id)}" tabindex="0" role="link" aria-label="Open ${esc(c.name)}">
    <div class="card-top">${statusBadge(complianceStatusForCocktail(c))}
      <button class="favorite-button ${fav?"active":""}" data-favorite="${esc(c.id)}" aria-label="${fav?"Remove from":"Add to"} favorites">${icon("i-heart")}</button>
    </div>
    <h3>${esc(c.name)}</h3>
    <p>${esc(c.commonCustomerDescription||`${c.cocktailFamily} cocktail`)}</p>
    <div class="meta">
      <span class="chip">${esc(c.baseSpirit)}</span><span class="chip">${esc(c.preparationMethod)}</span><span class="chip">${esc(c.glassware)}</span>
      ${masteryValue(c.id)>=4?`<span class="chip">Mastered</span>`:""}
    </div>
  </article>`;
}
function emptyState(title,body,button=""){
  return `<div class="empty-state"><h3>${esc(title)}</h3><p>${esc(body)}</p>${button}</div>`;
}

function renderHome(){
  const cocktails=allCocktails().filter(c=>!state.hidden.includes(c.id));
  const daily=cocktails[dayIndex()%cocktails.length];
  const mastered=cocktails.filter(c=>masteryValue(c.id)>=4).length;
  const mastery=Math.round(cocktails.reduce((s,c)=>s+Math.min(masteryValue(c.id),4),0)/(cocktails.length*4)*100)||0;
  const review=cocktails.filter(c=>[1,2].includes(masteryValue(c.id))).length;
  const recent=state.viewed.map(cocktailById).filter(Boolean).slice(0,5);
  const favorites=state.favorites.map(cocktailById).filter(Boolean).slice(0,5);
  const recommendation=recommendCocktail(cocktails);
  return `<section class="page">
    <div class="hero">
      <div class="hero-content">
        <span class="eyebrow">Train the craft. Respect the license.</span>
        <h2>Build speed without losing precision.</h2>
        <p>Master classic cocktail structure, Utah-adjusted specifications, service judgment, and the mechanics that make a drink work.</p>
        <div class="hero-actions">
          <button class="button primary" data-route="study">${icon("i-study")} Continue studying</button>
          <button class="button secondary" data-route="practice">${icon("i-practice")} Practice Bar</button>
          <button class="button ghost" data-random>${icon("i-random")} Random cocktail</button>
        </div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><strong>${mastery}%</strong><span>Current mastery</span></div>
      <div class="stat-card"><strong>${state.studied.length}</strong><span>Cocktails learned</span></div>
      <div class="stat-card"><strong>${review}</strong><span>Need review</span></div>
      <div class="stat-card"><strong>${state.currentStreak}</strong><span>Day study streak</span></div>
    </div>
    <div class="dashboard-grid">
      <div class="stack">
        <article class="card daily-card">
          <div>
            <span class="eyebrow">Daily cocktail</span>
            <h3>${esc(daily.name)}</h3>
            <p>${esc(daily.commonCustomerDescription)}</p>
            <div class="pill-row">${daily.flavorProfile.map(x=>`<span class="chip">${esc(x)}</span>`).join("")}</div>
            <div class="hero-actions"><button class="button primary small" data-open-cocktail="${daily.id}">Study today’s drink</button></div>
          </div>
          <div class="daily-art" aria-hidden="true"><div class="glass-illustration"><span class="liquid"></span></div></div>
        </article>
        <article class="card">
          <div class="card-header"><h3>Suggested next lesson</h3><span class="chip">${esc(state.skillLevel)}</span></div>
          <h4>${esc(recommendation.name)}</h4>
          <p>${esc(recommendation.memoryTrick)}</p>
          <button class="button small ghost" data-open-cocktail="${recommendation.id}">Open lesson</button>
        </article>
        <div class="notice"><strong>Utah reminder:</strong> The ${data.rules.limits.totalSpirituousLiquorMaxOz} oz total-spirit limit does not replace the general ${data.rules.limits.primarySpiritMaxOz} oz primary-spirit limit. Ingredient classification and license context still matter.</div>
      </div>
      <div class="stack">
        <article class="card">
          <h3>Training level</h3>
          <label for="skill-level">Recommendation profile
            <select id="skill-level">
              ${["New bartender","Beginner","Intermediate","Experienced","Custom study plan"].map(x=>`<option ${state.skillLevel===x?"selected":""}>${x}</option>`).join("")}
            </select>
          </label>
        </article>
        <article class="card"><div class="card-header"><h3>Recently viewed</h3><a href="#cocktails">Browse all</a></div>
          <div class="mini-list">${recent.length?recent.map(miniLink).join(""):`<p class="muted">Open a cocktail to start your history.</p>`}</div>
        </article>
        <article class="card"><div class="card-header"><h3>Favorites</h3><a href="#favorites">View all</a></div>
          <div class="mini-list">${favorites.length?favorites.map(miniLink).join(""):`<p class="muted">Save drinks you make often.</p>`}</div>
        </article>
        <button class="button primary" data-quick-quiz>Quick 10-question quiz</button>
      </div>
    </div>
  </section>`;
}
function recommendCocktail(cocktails){
  const order={
    "New bartender":["screwdriver","gin-tonic","moscow-mule","cape-codder","old-fashioned"],
    "Beginner":["daiquiri","margarita","whiskey-sour","manhattan","mojito"],
    "Intermediate":["martini","negroni","sidecar","french-75","mai-tai"],
    "Experienced":["sazerac","boulevardier","long-island","amaretto-sour"],
    "Custom study plan":[]
  }[state.skillLevel]||[];
  return order.map(cocktailById).find(c=>c&&masteryValue(c.id)<4) || cocktails.find(c=>masteryValue(c.id)<4) || cocktails[0];
}

function renderCocktails(){
  const c=allCocktails().filter(x=>!state.hidden.includes(x.id));
  const bases=arrayUnique(c.map(x=>x.baseSpirit));
  const families=arrayUnique(c.map(x=>x.cocktailFamily));
  const diff=arrayUnique(c.map(x=>x.difficulty));
  const methods=arrayUnique(c.map(x=>x.preparationMethod));
  const glasses=arrayUnique(c.map(x=>x.glassware));
  const statuses=arrayUnique(c.map(x=>x.utahComplianceStatus));
  return `<section class="page">
    ${pageHead("Recipe database","Cocktail Database","Search specs, compare national and Utah builds, filter your workplace set, and launch the inventory matcher.",
      `<button class="button ghost" data-inventory-toggle>${icon("i-ingredient")} What can I make?</button><button class="button primary" data-open-custom>+ Custom cocktail</button>`)}
    <div id="inventory-panel" class="inventory-panel hidden"></div>
    <div class="controls">
      <label class="search-wrap"><span class="hidden">Search cocktails</span>${icon("i-search")}<input id="cocktail-search" type="search" placeholder="Search name, ingredient, flavor…" autocomplete="off"></label>
      ${selectFilter("filter-base","Base spirit",bases)}
      ${selectFilter("filter-family","Family",families)}
      ${selectFilter("filter-difficulty","Difficulty",diff)}
      ${selectFilter("filter-method","Technique",methods)}
      ${selectFilter("filter-glass","Glassware",glasses)}
      ${selectFilter("filter-status","Utah status",statuses)}
      <label><span>Study status</span><select id="filter-study"><option value="">All study states</option><option value="mastered">Mastered</option><option value="review">Needs review</option><option value="unrated">Unrated</option><option value="favorites">Favorites</option></select></label>
    </div>
    <div class="filter-row"><span id="result-count" class="chip">${c.length} cocktails</span><button class="button small ghost" data-clear-filters>Clear filters</button></div>
    <div id="cocktail-grid" class="cocktail-grid">${c.map(cocktailCard).join("")}</div>
  </section>`;
}
function selectFilter(id,label,values){
  return `<label><span>${esc(label)}</span><select id="${id}"><option value="">All ${esc(label.toLowerCase())}</option>${values.map(v=>`<option>${esc(v)}</option>`).join("")}</select></label>`;
}
function filterCocktails(){
  const q=($("#cocktail-search")?.value||"").trim().toLowerCase();
  const vals={
    base:$("#filter-base")?.value,family:$("#filter-family")?.value,difficulty:$("#filter-difficulty")?.value,
    method:$("#filter-method")?.value,glass:$("#filter-glass")?.value,status:$("#filter-status")?.value,study:$("#filter-study")?.value
  };
  const result=allCocktails().filter(c=>{
    if(state.hidden.includes(c.id)) return false;
    const hay=[c.name,...(c.alternateNames||[]),c.baseSpirit,c.cocktailFamily,c.glassware,c.garnish,c.preparationMethod,...(c.flavorProfile||[]),
      ...(c.utahSpecification?.ingredients||[]).map(i=>i.name)].join(" ").toLowerCase();
    if(q&&!fuzzyContains(hay,q)) return false;
    if(vals.base&&c.baseSpirit!==vals.base) return false;
    if(vals.family&&c.cocktailFamily!==vals.family) return false;
    if(vals.difficulty&&c.difficulty!==vals.difficulty) return false;
    if(vals.method&&c.preparationMethod!==vals.method) return false;
    if(vals.glass&&c.glassware!==vals.glass) return false;
    if(vals.status&&c.utahComplianceStatus!==vals.status) return false;
    if(vals.study==="mastered"&&masteryValue(c.id)<4) return false;
    if(vals.study==="review"&&![1,2].includes(masteryValue(c.id))) return false;
    if(vals.study==="unrated"&&masteryValue(c.id)!==0) return false;
    if(vals.study==="favorites"&&!state.favorites.includes(c.id)) return false;
    return true;
  });
  $("#cocktail-grid").innerHTML=result.length?result.map(cocktailCard).join(""):emptyState("No matching cocktails","Clear a filter or try a broader search.");
  $("#result-count").textContent=`${result.length} cocktail${result.length===1?"":"s"}`;
}
function fuzzyContains(hay,q){
  if(hay.includes(q)) return true;
  return q.split(/\s+/).every(token=>{
    if(hay.includes(token)) return true;
    return hay.split(/\s+/).some(word=>word.length>3&&levenshtein(word,token)<=Math.max(1,Math.floor(token.length/4)));
  });
}
function levenshtein(a,b){
  const m=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let prev=m[0];m[0]=i;
    for(let j=1;j<=b.length;j++){
      const tmp=m[j];
      m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
      prev=tmp;
    }
  }
  return m[b.length];
}
function renderInventoryPanel(){
  const selected=new Set(state.inventory);
  const names=arrayUnique(data.ingredients.map(i=>i.name));
  const matches=inventoryMatches();
  return `<div class="card-header"><div><h3>What can I make?</h3><p class="muted">Mark ingredients currently available. Results update immediately and stay in this browser.</p></div><button class="button small ghost" data-inventory-clear>Clear inventory</button></div>
    <label class="search-wrap">${icon("i-search")}<input id="inventory-search" type="search" placeholder="Filter ingredients"></label>
    <div id="inventory-grid" class="inventory-grid">${names.map(n=>`<label class="check-item"><input type="checkbox" data-inventory="${esc(n)}" ${selected.has(n)?"checked":""}>${esc(n)}</label>`).join("")}</div>
    <div class="divider"></div>
    <div id="inventory-results">${inventoryResultMarkup(matches)}</div>`;
}
function inventoryMatches(){
  const have=new Set(state.inventory.map(x=>x.toLowerCase()));
  return allCocktails().map(c=>{
    const required=(c.utahSpecification?.ingredients||[]).filter(i=>["primary_spirit","secondary_spirit","classification_uncertain","wine","fortified_wine","beer","heavy_beer","juice","syrup","mixer","dairy","herb"].includes(i.classification)).map(i=>i.name);
    const missing=required.filter(n=>!have.has(n.toLowerCase()));
    return {c,missing};
  }).filter(x=>x.missing.length<=2).sort((a,b)=>a.missing.length-b.missing.length||a.c.name.localeCompare(b.c.name));
}
function inventoryResultMarkup(matches){
  return [0,1,2].map(n=>{
    const group=matches.filter(x=>x.missing.length===n).slice(0,10);
    if(!group.length) return "";
    return `<h4>${n===0?"Ready to make":`Missing ${n} ingredient${n>1?"s":""}`}</h4><div class="mini-list">${group.map(x=>`<a class="mini-link" href="#cocktail/${x.c.id}"><span>${esc(x.c.name)}</span><small>${n?esc(x.missing.join(", ")):"Utah build"}</small></a>`).join("")}</div>`;
  }).join("");
}

function renderCocktailDetail(id){
  const c=cocktailById(id);
  if(!c) return `<section class="page">${emptyState("Cocktail not found","The record may have been removed from this browser.",`<a class="button" href="#cocktails">Back to database</a>`)}</section>`;
  markViewed(id);
  activeSpec=session.detailSpec?.[id]||"utah";
  const recipe=activeSpec==="utah"?c.utahSpecification:c.standardSpecification;
  const calc=calculateCompliance(recipe.ingredients);
  const utahCalc=calculateCompliance(c.utahSpecification?.ingredients||[]);
  const fav=state.favorites.includes(id);
  const note=state.notes[id]||"";
  const house=state.houseSpecs[id]||"";
  return `<section class="page">
    <div class="detail-hero">
      <div class="detail-title">
        <a href="#cocktails" class="source-link">← Cocktail Database</a>
        <span class="eyebrow">${esc(c.cocktailFamily)}</span>
        <h2>${esc(c.name)}</h2>
        <p>${esc(c.commonCustomerDescription)}</p>
        <div class="pill-row">${statusBadge(complianceStatusForCocktail(c))}${(c.flavorProfile||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join("")}</div>
        <div class="glance-grid">
          ${glance("Primary",c.baseSpirit)}${glance("Glass",c.glassware)}${glance("Technique",c.preparationMethod)}${glance("Difficulty",c.difficulty)}
          ${glance("Ice",c.iceType)}${glance("Garnish",c.garnish)}${glance("Strength",c.approximateStrength)}${glance("Mastery",masteryLabel(masteryValue(id)))}
        </div>
      </div>
      <div class="cocktail-art" aria-hidden="true"><div class="glass-illustration"><span class="liquid"></span></div></div>
    </div>
    <div class="page-actions" style="margin-bottom:1rem">
      <button class="button ${fav?"secondary":"ghost"}" data-favorite="${id}">${icon("i-heart")} ${fav?"Favorited":"Add favorite"}</button>
      <button class="button ghost" data-hide-cocktail="${id}">Hide from workplace set</button>
    </div>
    <div class="detail-grid">
      <div class="stack">
        <article class="card">
          <div class="tabs" role="tablist" aria-label="Recipe specification">
            <button class="tab ${activeSpec==="utah"?"active":""}" data-spec-tab="utah" role="tab">Utah build</button>
            <button class="tab ${activeSpec==="standard"?"active":""}" data-spec-tab="standard" role="tab">Standard / historical</button>
          </div>
          ${c.changedForUtah?`<div class="notice"><strong>Recipes differ:</strong> the recognized standard is preserved separately and has not been silently rewritten.</div>`:""}
          <p class="data-warning">${esc(recipe.note)}</p>
          <div class="recipe-list">${recipe.ingredients.map(ingredientRow).join("")}</div>
          ${totalsMarkup(calc)}
        </article>
        <article class="card">
          <h3>Build procedure</h3>
          <ol class="steps">${(c.procedure||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ol>
        </article>
        <div class="two-col">
          <article class="card"><h3>Understand the drink</h3><p>${esc(c.whyRecipeWorks)}</p><h4>Family relationship</h4><p>${esc(c.cocktailFamily)} · ${esc(c.memoryTrick)}</p></article>
          <article class="card"><h3>Avoid these mistakes</h3><ul class="clean-list">${(c.commonMistakes||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></article>
        </div>
        <div class="two-col">
          <article class="card"><h3>History and appearance</h3><p>${esc(c.historyOrOrigin)}</p><p><strong>Visual target:</strong> ${esc(c.appearance)}</p></article>
          <article class="card"><h3>Substitutions</h3><p><strong>Acceptable:</strong> ${esc((c.acceptableSubstitutions||[]).join("; ")||"None specified")}</p><p><strong>Do not casually replace:</strong> ${esc((c.doNotSubstitute||[]).join("; ")||"None specified")}</p></article>
        </div>
      </div>
      <aside class="stack">
        <article class="card"><h3>Live compliance check</h3>${complianceMarkup(calc,c)}</article>
        <article class="card"><h3>Memory aid</h3><p class="text-amber">${esc(c.memoryTrick)}</p><h4>Speed service</h4><p>${esc(c.speedServiceVersion)}</p></article>
        <article class="card">
          <h3>Mastery</h3>
          <div class="mastery-buttons">${[["Again",1],["Difficult",2],["Almost",3],["Mastered",4]].map(([label,v])=>`<button class="button small ${masteryValue(id)===v?"active":""}" data-set-mastery="${v}" data-id="${id}">${label}</button>`).join("")}</div>
        </article>
        <article class="card note-area">
          <h3>Private notes</h3>
          <label>Personal / station notes<textarea id="cocktail-note" rows="5">${esc(note)}</textarea></label>
          <label>Workplace specification<textarea id="house-spec" rows="6" placeholder="Record the approved house build, bottle placement, and station sequence.">${esc(house)}</textarea></label>
          <button class="button primary" data-save-notes="${id}">Save notes</button>
        </article>
        <article class="card"><h3>Verification</h3><p class="data-warning">${esc(c.sourceVerificationNotes)}</p><p><strong>Record reviewed:</strong> ${esc(c.lastReviewedDate)}</p><a href="#law" class="source-link">Review Utah rules →</a></article>
      </aside>
    </div>
  </section>`;
}
function glance(label,value){ return `<div class="glance"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }
function ingredientRow(i){
  return `<div class="recipe-row"><strong>${esc(i.amount)} ${esc(i.unit)}</strong><span>${esc(i.name)}${i.note?`<br><small>${esc(i.note)}</small>`:""}</span><small>${esc(titleCase(i.classification))}<br>${esc(titleCase(i.handling))}</small></div>`;
}
function totalsMarkup(calc){
  return `<div class="total-box">
    <div><strong>${fmt(calc.primary)} oz</strong><span>Primary spirit</span></div>
    <div><strong>${fmt(calc.secondary)} oz</strong><span>Secondary spirit</span></div>
    <div><strong>${fmt(calc.totalSpirit)} oz</strong><span>Total spirituous</span></div>
    <div><strong>${fmt(calc.wine)} oz</strong><span>Wine</span></div>
    <div><strong>${fmt(calc.fortifiedWine)} oz</strong><span>Fortified / aromatized wine</span></div>
    <div><strong>${fmt(calc.beer)} oz</strong><span>Beer</span></div>
    <div><strong>${fmt(calc.heavyBeer)} oz</strong><span>Heavy beer</span></div>
    <div><strong>${fmt(calc.flavoredMalt)} oz</strong><span>Flavored malt beverage</span></div>
    <div><strong>${fmt(calc.bitters)} oz</strong><span>Bitters</span></div>
    <div><strong>${fmt(calc.nonAlcoholic)} oz</strong><span>Nonalcoholic ingredients</span></div>
    <div><strong>${fmt(calc.uncertain)} oz</strong><span>Uncertain classification</span></div>
  </div>`;
}
function complianceMarkup(calc,c){
  const suggestion=calc.status==="Do not serve as written"?
    `Reduce primary spirit to ${data.rules.limits.primarySpiritMaxOz} oz and total spirituous liquor to ${data.rules.limits.totalSpirituousLiquorMaxOz} oz or less; then re-balance acid, sweetness, and dilution.`:
    calc.status==="Requires license-specific review"?
    "Do not guess. Confirm the product's classification, flavoring designation, storage label, dispensing method, and the establishment's approved recipe.":
    "Prepare exactly as specified, use the approved dispensing setup, and apply the establishment's license and policy.";
  return `${statusBadge(calc.status)}
    ${calc.problems.length?`<ul class="clean-list">${calc.problems.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p>No configured numeric limit is exceeded by this entered recipe.</p>`}
    <p><strong>Operational response:</strong> ${esc(suggestion)}</p>
    <p><strong>Flavor effect:</strong> Reducing base spirit can make acid, sugar, bitterness, and mixer volume feel stronger. The Utah build should be re-balanced rather than merely shortened.</p>
    <p class="data-warning">${esc(c.legalExplanation)}</p>`;
}

function renderStudy(){
  const levels=[
    ["1","Foundations","Tools, measurement, glassware, ice, spirits, shaking, stirring, building, and Utah dispensing basics."],
    ["2","Essential Orders","High-frequency cocktails and simple mixed drinks."],
    ["3","Cocktail Families","Sours, daisies, highballs, Collins, Old Fashioned, Martini/Manhattan, Negroni, fizz, spritz, and tropical patterns."],
    ["4","Speed and Recall","Rapid specs, build order, garnish, glassware, and similar-drink differentiation."],
    ["5","Advanced Bartending","Balancing, substitutions, recommendations, troubleshooting, Utah conversion, and multi-order prioritization."]
  ];
  const modes=[
    ["flashcards","Flashcards","Spaced repetition with Again, Difficult, Almost, and Mastered."],
    ["quiz","Adaptive Quiz","Mixed recipe, glassware, and Utah-law questions."],
    ["builder","Recipe Builder","Tap the ingredients that belong in the Utah build."],
    ["reverse","Reverse Identification","Read a recipe and identify the cocktail."],
    ["missing","Missing Ingredient","Find the omitted ingredient."],
    ["error","Spot the Error","Identify a flawed amount, technique, glass, or legal pour."],
    ["similar","Similar Drink Challenge","Separate commonly confused drinks."],
    ["timed","Timed Recall","Answer ten questions against the clock."]
  ];
  return `<section class="page">
    ${pageHead("Learning system","Study","Move from mechanics to service judgment. Every session updates local progress and spaced-repetition scheduling.")}
    <h3>Guided curriculum</h3>
    <div class="curriculum-grid">${levels.map(([n,t,d])=>`<article class="level-card" data-start-level="${n}" tabindex="0"><span class="level-number">0${n}</span><h3>${t}</h3><p>${d}</p></article>`).join("")}</div>
    <h3 style="margin-top:1.5rem">Study modes</h3>
    <div class="mode-grid">${modes.map(([id,t,d])=>`<article class="mode-card" data-study-mode="${id}" tabindex="0"><span class="eyebrow">${id}</span><h3>${t}</h3><p>${d}</p></article>`).join("")}</div>
    <div id="study-stage" class="study-stage">${studyWelcome()}</div>
  </section>`;
}
function studyWelcome(){ return `<div class="empty-state"><h3>Choose a study mode</h3><p>Your answers, misses, mastery ratings, and review dates remain only in this browser.</p></div>`; }
function startFlashcards(ids=null){
  const cards=(ids?ids.map(cocktailById).filter(Boolean):allCocktails()).filter(c=>!state.hidden.includes(c.id));
  cards.sort((a,b)=>(state.flashcards[a.id]?.due||"") .localeCompare(state.flashcards[b.id]?.due||"") || masteryValue(a.id)-masteryValue(b.id));
  session.flash={cards,index:0,revealed:false};
  renderFlashcard();
}
function renderFlashcard(){
  const s=session.flash, c=s.cards[s.index%s.cards.length];
  const due=state.flashcards[c.id]?.due||"New";
  $("#study-stage").innerHTML=`<div class="card-header"><div><span class="eyebrow">Flashcard ${s.index+1} of ${s.cards.length}</span><h3>${esc(c.name)}</h3></div><span class="chip">Due: ${esc(due)}</span></div>
    <div class="flashcard">
      ${s.revealed?`<div class="answer"><span class="eyebrow">Utah training build</span><h3>${esc(c.name)}</h3><div class="recipe-list">${c.utahSpecification.ingredients.map(ingredientRow).join("")}</div><p>${esc(c.memoryTrick)}</p></div>`:
      `<div><span class="eyebrow">Recall the full build</span><h3>${esc(c.name)}</h3><p>Ingredients · measurements · glass · ice · method · garnish</p><button class="button primary" data-reveal-flash>Reveal answer</button></div>`}
    </div>
    ${s.revealed?`<div class="rating-row">${[["Again",1,0],["Difficult",2,1],["Almost",3,3],["Mastered",4,7]].map(([l,v,d])=>`<button class="button" data-rate-card="${v}" data-days="${d}">${l}</button>`).join("")}</div>`:""}`;
}
function startQuiz(type="quiz",count=10){
  let pool=[...data.questions];
  if(type==="reverse") pool=pool.filter(q=>q.type==="reverse");
  if(type==="quiz") pool.sort((a,b)=>weaknessScore(b)-weaknessScore(a));
  shuffle(pool);
  session.quiz={type,questions:pool.slice(0,count),index:0,correct:0,answered:false,start:Date.now(),deadline:type==="timed"?Date.now()+60000:null};
  renderQuizQuestion();
  if(type==="timed") session.quiz.timer=setInterval(updateTimer,250);
}
function weaknessScore(q){
  const miss=state.recentMisses.filter(x=>x===q.id).length;
  const c=q.cocktailId?4-masteryValue(q.cocktailId):1;
  return miss*3+c;
}
function renderQuizQuestion(){
  const s=session.quiz;
  if(s.index>=s.questions.length){ finishQuiz(); return; }
  const q=s.questions[s.index];
  $("#study-stage").innerHTML=`<div class="card-header"><div><span class="eyebrow">${esc(titleCase(s.type))} · ${s.index+1}/${s.questions.length}</span><h3>${esc(q.category)}</h3></div><span id="quiz-timer" class="chip">${s.deadline?"60s":`${s.correct} correct`}</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${s.index/s.questions.length*100}%"></div></div>
    <h3>${esc(q.prompt)}</h3>
    <div class="quiz-options">${q.options.map(o=>`<button class="option" data-answer="${esc(o)}">${esc(o)}</button>`).join("")}</div>
    <div id="quiz-feedback"></div>`;
}
function answerQuiz(answer){
  const s=session.quiz;if(s.answered)return;s.answered=true;
  const q=s.questions[s.index], correct=answer===q.answer;
  if(correct)s.correct++; else{state.recentMisses=[q.id,...state.recentMisses].slice(0,30);}
  $$(".option").forEach(b=>{b.disabled=true;b.classList.toggle("correct",b.dataset.answer===q.answer);b.classList.toggle("incorrect",b.dataset.answer===answer&&!correct);});
  $("#quiz-feedback").innerHTML=`<div class="notice ${correct?"success":"danger"}" style="margin-top:1rem"><strong>${correct?"Correct":"Review it"}</strong><p>${esc(q.explanation)}</p></div><button class="button primary" style="margin-top:.75rem" data-next-question>${s.index===s.questions.length-1?"Finish":"Next question"}</button>`;
  saveState();
}
function finishQuiz(){
  const s=session.quiz; clearInterval(s.timer);
  const pct=Math.round(s.correct/s.questions.length*100);
  state.quizHistory.push({date:new Date().toISOString(),type:s.type,correct:s.correct,total:s.questions.length,percent:pct});
  if(s.type==="timed") state.bestTimedScore=Math.max(state.bestTimedScore,s.correct);
  setStudyActivity();
  saveState();
  $("#study-stage").innerHTML=`<div class="empty-state"><span class="eyebrow">Session complete</span><h3>${pct}% · ${s.correct}/${s.questions.length}</h3><p>${pct>=80?"Strong recall. Rate difficult drinks in flashcards to lock them in.":"Review recent misses and repeat the weakest category."}</p><button class="button primary" data-study-mode="${s.type}">Run again</button></div>`;
}
function updateTimer(){
  const s=session.quiz;if(!s?.deadline)return;
  const remain=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));
  const node=$("#quiz-timer");if(node)node.textContent=`${remain}s`;
  if(remain<=0){clearInterval(s.timer);finishQuiz();}
}
function startBuilder(){
  const c=randomCocktail();
  const correct=c.utahSpecification.ingredients.map(i=>i.name);
  const distractors=arrayUnique(allCocktails().flatMap(x=>x.utahSpecification?.ingredients?.map(i=>i.name)||[]).filter(n=>!correct.includes(n))).sort(()=>Math.random()-.5).slice(0,Math.min(5,correct.length));
  const choices=shuffle([...correct,...distractors]);
  session.builder={c,correct:new Set(correct),selected:new Set(),choices};
  renderBuilder();
}
function renderBuilder(){
  const s=session.builder;
  $("#study-stage").innerHTML=`<span class="eyebrow">Recipe Builder</span><h3>Build the Utah specification for ${esc(s.c.name)}</h3><p>Tap every ingredient that belongs. This mode tests components; open the detail page afterward for measurements and order.</p>
    <div class="filter-row">${s.choices.map(n=>`<button class="chip ${s.selected.has(n)?"text-amber":""}" data-builder-choice="${esc(n)}">${esc(n)}</button>`).join("")}</div>
    <button class="button primary" data-check-builder>Check build</button><div id="builder-feedback"></div>`;
}
function checkBuilder(){
  const s=session.builder;
  const exact=s.correct.size===s.selected.size&&[...s.correct].every(x=>s.selected.has(x));
  $("#builder-feedback").innerHTML=`<div class="notice ${exact?"success":"danger"}" style="margin-top:1rem"><strong>${exact?"Correct build":"Not quite"}</strong><p>Required: ${esc([...s.correct].join(", "))}</p></div><button class="button" style="margin-top:.6rem" data-open-cocktail="${s.c.id}">Open full recipe</button>`;
  if(exact){state.mastered[s.c.id]=Math.max(masteryValue(s.c.id),3);setStudyActivity();saveState();}
}
function startMissing(){
  const c=randomCocktail(), recipe=c.utahSpecification.ingredients;
  const missing=recipe[Math.floor(Math.random()*recipe.length)];
  const options=[missing.name,...arrayUnique(allCocktails().flatMap(x=>x.utahSpecification.ingredients.map(i=>i.name)).filter(n=>!recipe.some(i=>i.name===n))).slice(0,3)];
  shuffle(options);
  session.quiz={type:"missing",questions:[{id:`missing-${c.id}`,prompt:`Which ingredient is missing from this ${c.name} build: ${recipe.filter(i=>i!==missing).map(i=>i.name).join(", ")}?`,options,answer:missing.name,category:"Missing Ingredient",explanation:`${missing.amount} ${missing.unit} ${missing.name}.`,cocktailId:c.id}],index:0,correct:0,answered:false,start:Date.now()};
  renderQuizQuestion();
}
function startError(){
  const c=randomCocktail();
  const correct=`${c.preparationMethod} in a ${c.glassware}`;
  const options=[correct,`Shake in a ${c.glassware}`,`${c.preparationMethod} in a Pint glass`,`Build with no measurement check`];
  shuffle(options);
  session.quiz={type:"error",questions:[{id:`error-${c.id}`,prompt:`Which service description is correct for ${c.name}?`,options,answer:correct,category:"Spot the Error",explanation:`Use ${c.preparationMethod}, ${c.glassware}, ${c.iceType}, and ${c.garnish}.`,cocktailId:c.id}],index:0,correct:0,answered:false,start:Date.now()};
  renderQuizQuestion();
}
function startSimilar(){
  const pairs=[["Cape Codder","Sea Breeze","Cape Codder uses cranberry; Sea Breeze adds grapefruit."],["Manhattan","Rob Roy","Rob Roy uses Scotch; Manhattan uses American whiskey."],["Martini","Gibson","The Gibson is identified by a cocktail onion."],["Margarita","Sidecar","Margarita uses tequila and lime; Sidecar uses brandy and lemon."],["Tom Collins","Gin Fizz","A Collins is taller and served on ice; a traditional fizz is shorter and often no-ice."],["Negroni","Boulevardier","Boulevardier replaces gin with whiskey."],["Black Russian","White Russian","White Russian adds cream."],["Daiquiri","Gimlet","Daiquiri uses rum; Gimlet uses gin."]];
  const [a,b,ex]=pairs[Math.floor(Math.random()*pairs.length)];
  const ca=allCocktails().find(c=>c.name===a),cb=allCocktails().find(c=>c.name===b);
  $("#study-stage").innerHTML=`<span class="eyebrow">Similar Drink Challenge</span><h3>${a} vs. ${b}</h3>
    <div class="two-col"><article class="card"><h3>${a}</h3><p>${esc(ca?.memoryTrick||"")}</p></article><article class="card"><h3>${b}</h3><p>${esc(cb?.memoryTrick||"")}</p></article></div>
    <div class="notice" style="margin-top:1rem"><strong>Distinction:</strong> ${esc(ex)}</div><button class="button primary" style="margin-top:.75rem" data-study-mode="similar">Next pair</button>`;
  setStudyActivity();
}
function startLevel(level){
  const map={
    "1":["screwdriver","gin-tonic","moscow-mule","old-fashioned","daiquiri"],
    "2":["margarita","mojito","whiskey-sour","manhattan","cosmopolitan"],
    "3":["negroni","tom-collins","french-75","sidecar","boulevardier"],
    "4":["cape-codder","sea-breeze","bay-breeze","martini","gibson"],
    "5":["sazerac","mai-tai","long-island","amaretto-sour","aperol-spritz"]
  };
  startFlashcards(map[level]);
}
function randomCocktail(){ const c=allCocktails().filter(x=>!state.hidden.includes(x.id));return c[Math.floor(Math.random()*c.length)];}
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}

function renderPractice(){
  const total=state.scenarioHistory.length;
  const avg=total?Math.round(state.scenarioHistory.reduce((s,x)=>s+x.score,0)/total):0;
  return `<section class="page">
    ${pageHead("Simulation","Practice Bar","Interpret natural guest requests, choose the right drink, protect Utah compliance, and communicate a lawful alternative.")}
    <div class="stats-grid"><div class="stat-card"><strong>${total}</strong><span>Orders completed</span></div><div class="stat-card"><strong>${avg}%</strong><span>Average score</span></div><div class="stat-card"><strong>${state.bestTimedScore}</strong><span>Best timed recall</span></div><div class="stat-card"><strong>${state.currentStreak}</strong><span>Study streak</span></div></div>
    <div id="practice-stage" class="study-stage">${practiceWelcome()}</div>
  </section>`;
}
function practiceWelcome(){return `<div class="empty-state"><h3>Open the simulated bar</h3><p>Each order scores recipe choice, compliance, technique, communication, speed, and waste judgment.</p><button class="button primary" data-start-practice>Start shift</button></div>`;}
function startPractice(){
  session.practice={queue:shuffle([...data.scenarios]).slice(0,10),index:0,total:0,answered:false};
  renderScenario();
}
function labelForChoice(id){
  if(id==="refuse-service")return "Refuse further alcohol service";
  if(id==="refuse-entry")return "Refuse entry without valid ID";
  return cocktailById(id)?.name||titleCase(id);
}
function renderScenario(){
  const s=session.practice;
  if(s.index>=s.queue.length){finishPractice();return;}
  const sc=s.queue[s.index];
  const opts=arrayUnique(sc.options).map(id=>({id,label:labelForChoice(id)}));
  $("#practice-stage").innerHTML=`<div class="card-header"><div><span class="eyebrow">Order ${s.index+1} of ${s.queue.length}</span><h3>Guest request</h3></div><span class="chip">${s.total} points</span></div>
    <blockquote class="scenario-guest">“${esc(sc.guestRequest)}”</blockquote>
    <h4>Select the best response</h4><div class="quiz-options">${opts.map(o=>`<button class="option" data-scenario-choice="${esc(o.id)}">${esc(o.label)}</button>`).join("")}</div><div id="scenario-feedback"></div>`;
}
function answerScenario(choice){
  const s=session.practice;if(s.answered)return;s.answered=true;
  const sc=s.queue[s.index],correct=choice===sc.correctDrinkId;
  const score=correct?100:(sc.requiredJudgment==="refuse_or_modify"&&choice.startsWith("refuse")?65:25);
  s.total+=score;
  $$(".option").forEach(b=>{b.disabled=true;b.classList.toggle("correct",b.dataset.scenarioChoice===sc.correctDrinkId);b.classList.toggle("incorrect",b.dataset.scenarioChoice===choice&&!correct);});
  $("#scenario-feedback").innerHTML=`<div class="notice ${correct?"success":"danger"}" style="margin-top:1rem"><strong>${correct?"Strong service decision":"Better response available"}</strong><p>${esc(sc.feedback)}</p></div>
    <div class="score-grid">${Object.entries(sc.scores).map(([k,v])=>`<div><strong>${correct?v:Math.round(v*.35)}</strong><span>${titleCase(k)}</span></div>`).join("")}</div>
    <button class="button primary" data-next-scenario>${s.index===s.queue.length-1?"End shift":"Next order"}</button>`;
}
function finishPractice(){
  const s=session.practice,score=Math.round(s.total/s.queue.length);
  state.scenarioHistory.push({date:new Date().toISOString(),score,orders:s.queue.length});
  setStudyActivity();saveState();
  $("#practice-stage").innerHTML=`<div class="empty-state"><span class="eyebrow">Shift complete</span><h3>${score}%</h3><p>${score>=80?"Accurate, lawful, and guest-aware.":"Review misses, especially refusal and modification scenarios."}</p><button class="button primary" data-start-practice>Run another shift</button></div>`;
}

function renderIngredients(){
  const cats=arrayUnique(data.ingredients.map(i=>i.category));
  return `<section class="page">
    ${pageHead("Encyclopedia","Ingredients","Flavor function, storage, deterioration, substitutions, refrigeration, and cautious Utah classification.",
      `<button class="button ghost" data-route="cocktails">${icon("i-glass")} Open inventory tool</button>`)}
    <div class="controls" style="grid-template-columns:minmax(240px,2fr) minmax(180px,1fr)">
      <label class="search-wrap">${icon("i-search")}<input id="ingredient-search" type="search" placeholder="Search ingredients…"></label>
      ${selectFilter("ingredient-category","Category",cats)}
    </div>
    <div id="ingredient-grid" class="ingredient-grid">${data.ingredients.map(ingredientCard).join("")}</div>
  </section>`;
}
function ingredientCard(i){
  const selected=state.inventory.includes(i.name);
  return `<article class="ingredient-card" data-ingredient-card="${esc(i.name.toLowerCase())}" data-category="${esc(i.category)}">
    <div class="card-header"><div><span class="eyebrow">${esc(i.category)}</span><h3>${esc(i.name)}</h3></div><label class="check-item"><input type="checkbox" data-inventory="${esc(i.name)}" ${selected?"checked":""}> In stock</label></div>
    <p>${esc(i.flavorProfile)}</p>
    <details><summary>Use, storage, and legal classification</summary><div>
      <dl class="definition-list"><dt>Function</dt><dd>${esc(i.typicalFunction)}</dd><dt>Storage</dt><dd>${esc(i.storage)}</dd><dt>After opening</dt><dd>${esc(i.shelfLifeAfterOpening)}</dd><dt>Refrigerate</dt><dd>${esc(i.refrigerationUsuallyNeeded)}</dd><dt>Utah</dt><dd>${esc(i.utahLegalClassification)}</dd></dl>
      <p><strong>Common drinks:</strong> ${esc((i.commonCocktails||[]).join(", ")||"Varies")}</p><p class="data-warning">${esc(i.sourceNote)}</p>
    </div></details>
  </article>`;
}
function filterIngredients(){
  const q=($("#ingredient-search")?.value||"").toLowerCase(),cat=$("#ingredient-category")?.value||"";
  $$("[data-ingredient-card]").forEach(card=>{
    card.classList.toggle("hidden",Boolean((q&&!card.dataset.ingredientCard.includes(q))||(cat&&card.dataset.category!==cat)));
  });
}

function renderTechniques(){
  return `<section class="page">
    ${pageHead("Mechanics","Techniques, Glassware & Ice","Learn what each movement does to temperature, dilution, texture, aroma, and presentation.")}
    <div class="tabs"><button class="tab active" data-library-tab="techniques">Techniques</button><button class="tab" data-library-tab="glassware">Glassware</button><button class="tab" data-library-tab="ice">Ice</button></div>
    <div id="library-content">${techniqueGrid()}</div>
  </section>`;
}
function techniqueGrid(){
  return `<div class="technique-grid">${data.techniques.map(t=>`<article class="technique-card"><span class="eyebrow">${esc(t.sensoryGoal)}</span><h3>${esc(t.name)}</h3><p>${esc(t.whenUsed)}</p><details><summary>Step-by-step</summary><div><ol class="clean-list">${t.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol><p><strong>Why:</strong> ${esc(t.whyItWorks)}</p><p><strong>Equipment:</strong> ${esc(t.equipment.join(", "))}</p><p><strong>Practice:</strong> ${esc(t.practiceExercise)}</p></div></details></article>`).join("")}</div>`;
}
function glassGrid(){
  return `<div class="technique-grid">${data.glassware.glassware.map(g=>`<article class="technique-card"><span class="eyebrow">Glassware</span><h3>${esc(g.name)}</h3><p>${esc(g.bestFor)}</p><dl class="definition-list"><dt>Temperature</dt><dd>${esc(g.temperatureEffect)}</dd><dt>Dilution</dt><dd>${esc(g.dilutionEffect)}</dd><dt>Service</dt><dd>${esc(g.servingVolumeNote)}</dd></dl></article>`).join("")}</div>`;
}
function iceGrid(){
  return `<div class="technique-grid">${data.glassware.ice.map(i=>`<article class="technique-card"><span class="eyebrow">Ice</span><h3>${esc(i.name)}</h3><p>${esc(i.bestFor)}</p><p>${esc(i.effect)}</p></article>`).join("")}</div>`;
}

function renderLaw(){
  const official=new Date(data.rules.lastLegallyReviewed+"T00:00:00");
  const ageDays=Math.floor((Date.now()-official)/86400000);
  const stale=ageDays>data.rules.reviewWarningAfterDays;
  return `<section class="page">
    ${pageHead("Operational reference","Utah Law","Current baseline rules are centralized in data/utah-rules.json. Every legal claim below links to an official Utah source.")}
    <div class="notice ${stale?"danger":"success"}"><strong>${stale?"Legal review required":"Legal data within review window"}</strong><p>Last legally reviewed: ${esc(data.rules.lastLegallyReviewed)} · ${ageDays} days ago. ${esc(data.rules.disclaimer)}</p></div>
    <div class="stats-grid">
      <div class="stat-card"><strong>${data.rules.limits.primarySpiritMaxOz} oz</strong><span>General primary-spirit maximum</span></div>
      <div class="stat-card"><strong>${data.rules.limits.totalSpirituousLiquorMaxOz} oz</strong><span>General total spirituous maximum</span></div>
      <div class="stat-card"><strong>${data.rules.limits.wineIndividualPortionMaxOz} oz</strong><span>General wine individual portion</span></div>
      <div class="stat-card"><strong>21+</strong><span>Minimum drinking age</span></div>
    </div>
    <article class="card">
      <h3>Workplace review record</h3>
      <div class="two-col"><label>Manual rules-reviewed date<input id="legal-review-date" type="date" value="${esc(state.legalReviewDate||"")}"></label><div><p class="muted">This records that you or management checked current rules. It does not alter the official-source date inside the data file.</p><button class="button small primary" data-save-legal-review>Save review date</button></div></div>
    </article>
    <h3>Central rule configuration</h3>
    <div class="law-grid">${data.rules.rules.map(r=>`<article class="law-card"><span class="eyebrow">${esc(r.verificationStatus)}</span><h3>${esc(r.ruleName)}</h3><p>${esc(r.notes)}</p><dl class="definition-list"><dt>Applies</dt><dd>${esc(r.applicableLicenseTypes.join(", "))}</dd><dt>Effective</dt><dd>${esc(r.effectiveDate)}</dd><dt>Verified</dt><dd>${esc(r.dateLastVerified)}</dd></dl><a class="source-link" href="${esc(r.officialSource)}" target="_blank" rel="noopener">Verify current rule ↗</a></article>`).join("")}</div>
    <h3 style="margin-top:1.5rem">Bartender lessons</h3>
    <div class="stack">${data.rules.lessons.map(l=>`<details><summary>${esc(l.title)}</summary><div><p>${esc(l.plainLanguage)}</p><div class="two-col"><div><h4>Example scenario</h4><p>${esc(l.scenario)}</p><h4>Correct response</h4><p>${esc(l.correctResponse)}</p></div><div><h4>Common mistake</h4><p>${esc(l.commonMistake)}</p><h4>Licenses affected</h4><p>${esc(l.licenseTypesAffected.join(", "))}</p></div></div><p><strong>Effective:</strong> ${esc(l.effectiveDate)}</p><a class="source-link" href="${esc(l.source)}" target="_blank" rel="noopener">Verify current rule ↗</a></div></details>`).join("")}</div>
  </section>`;
}

function renderProgress(){
  const cocktails=allCocktails(), mastered=cocktails.filter(c=>masteryValue(c.id)>=4).length;
  const quizTotal=state.quizHistory.reduce((s,x)=>s+x.total,0),quizCorrect=state.quizHistory.reduce((s,x)=>s+x.correct,0);
  const quizAcc=quizTotal?Math.round(quizCorrect/quizTotal*100):0;
  const dims=progressDimensions(cocktails,quizAcc);
  return `<section class="page">
    ${pageHead("Local analytics","Progress","A browser-only view of recipe knowledge, technique, law, and service performance. Export whenever you want a backup.")}
    <div class="stats-grid"><div class="stat-card"><strong>${mastered}</strong><span>Cocktails mastered</span></div><div class="stat-card"><strong>${quizAcc}%</strong><span>Quiz accuracy</span></div><div class="stat-card"><strong>${state.bestTimedScore}</strong><span>Best timed score</span></div><div class="stat-card"><strong>${state.currentStreak}</strong><span>Current streak</span></div></div>
    <div class="detail-grid">
      <div class="stack">
        <article class="card"><h3>Mastery map</h3><div class="mastery-map">${Object.entries(dims).map(([k,v])=>`<div class="mastery-row"><strong>${esc(k)}</strong><div class="progress-track"><div class="progress-fill" style="width:${v}%"></div></div><span>${v}%</span></div>`).join("")}</div></article>
        <article class="card"><h3>Recently missed</h3><div class="mini-list">${state.recentMisses.slice(0,8).map(id=>{const q=data.questions.find(x=>x.id===id);return q?`<div class="mini-link"><span>${esc(q.prompt)}</span><small>${esc(q.category)}</small></div>`:""}).join("")||`<p class="muted">No missed questions recorded yet.</p>`}</div></article>
      </div>
      <div class="stack">
        <article class="card"><h3>Backup and privacy</h3><p>All tracking remains in localStorage. There are no accounts, hidden analytics, or network tracking.</p><div class="stack"><button class="button primary" data-export-progress>Export progress JSON</button><button class="button ghost" data-import-progress>Import progress JSON</button><button class="button ghost" data-clear-legal-history>Clear legal-history data only</button><button class="button ghost" data-unhide-cocktails ${state.hidden.length?"":"disabled"}>Restore hidden cocktails (${state.hidden.length})</button><button class="button danger" data-reset-progress>Reset all progress</button></div></article>
        <article class="card"><h3>Accessibility settings</h3><label>Text size<select id="text-scale"><option value=".9" ${state.settings.fontScale===.9?"selected":""}>Compact</option><option value="1" ${state.settings.fontScale===1?"selected":""}>Standard</option><option value="1.12" ${state.settings.fontScale===1.12?"selected":""}>Large</option><option value="1.25" ${state.settings.fontScale===1.25?"selected":""}>Extra large</option></select></label><label class="check-item" style="margin-top:.75rem"><input id="reduce-motion" type="checkbox" ${state.settings.reducedMotion?"checked":""}> Reduce interface motion</label></article>
      </div>
    </div>
  </section>`;
}
function progressDimensions(cocktails,quizAcc){
  const avg=Math.round(cocktails.reduce((s,c)=>s+masteryValue(c.id),0)/(cocktails.length*4)*100)||0;
  const lawQs=state.quizHistory.filter(x=>x.type==="law");
  const practice=state.scenarioHistory.length?Math.round(state.scenarioHistory.reduce((s,x)=>s+x.score,0)/state.scenarioHistory.length):0;
  return {"Recipe knowledge":avg,"Technique":Math.round((avg+quizAcc)/2),"Ingredients":Math.round((state.inventory.length/Math.max(data.ingredients.length,1))*100),"Glassware":quizAcc,"Utah law":lawQs.length?quizAcc:Math.round(quizAcc*.8),"Speed":Math.min(100,state.bestTimedScore*10),"Guest service":practice};
}
function renderFavorites(){
  const fav=state.favorites.map(cocktailById).filter(Boolean);
  return `<section class="page">${pageHead("Saved set","Favorites","Your fast-access list for house standards, frequent orders, and drinks that need repetition.")}
    <div class="cocktail-grid">${fav.length?fav.map(cocktailCard).join(""):emptyState("No favorites yet","Tap the heart on any cocktail card or detail page.",`<a class="button primary" href="#cocktails">Browse cocktails</a>`)}</div></section>`;
}

function renderRoute(){
  const route=currentRoute();
  updateNav(route);
  let html="";
  if(route==="home") html=renderHome();
  else if(route==="cocktails") html=renderCocktails();
  else if(route.startsWith("cocktail/")) html=renderCocktailDetail(route.split("/")[1]);
  else if(route==="study") html=renderStudy();
  else if(route==="practice") html=renderPractice();
  else if(route==="ingredients") html=renderIngredients();
  else if(route==="techniques") html=renderTechniques();
  else if(route==="law") html=renderLaw();
  else if(route==="progress") html=renderProgress();
  else if(route==="favorites") html=renderFavorites();
  else {routeTo("home");return;}
  $("#main-content").innerHTML=html;
  $("#main-content").focus({preventScroll:true});
}

function createCustomCocktail(form){
  const fd=new FormData(form),name=String(fd.get("name")).trim();
  const id=`custom-${slugify(name)}-${Date.now().toString(36)}`;
  const ingredients=String(fd.get("ingredients")).split(/\n+/).map(line=>{
    const [amount,unit,ingredient,classification]=line.split("|").map(x=>x.trim());
    return {name:ingredient,amount:Number(amount),unit:unit||"oz",classification:classification||"classification_uncertain",handling:classification==="primary_spirit"?"metered":classification==="secondary_spirit"?"flavoring":"verify",note:"User-created record"};
  }).filter(i=>i.name&&Number.isFinite(i.amount));
  if(!ingredients.length) throw new Error("Add at least one valid ingredient line.");
  const calc=calculateCompliance(ingredients);
  const c={
    id,name,alternateNames:[],cocktailFamily:String(fd.get("family")||"Custom"),baseSpirit:String(fd.get("baseSpirit")),
    standardSpecification:{label:"User-created variation",ingredients,note:"User-created record; no external verification."},
    utahSpecification:{label:"User-entered Utah candidate",ingredients,note:"Validate classifications and workplace approval before service."},
    preparationMethod:String(fd.get("method")),glassware:String(fd.get("glassware")),iceType:String(fd.get("iceType")),garnish:String(fd.get("garnish")),
    difficulty:"Custom",flavorProfile:["custom"],approximateStrength:"Not calculated",appearance:"User-defined",commonCustomerDescription:"Private custom cocktail",
    historyOrOrigin:"User-created variation.",whyRecipeWorks:"Record your balance notes in the private notes field.",commonMistakes:["Serving without management approval"],
    acceptableSubstitutions:[],doNotSubstitute:[],speedServiceVersion:"Use the approved workplace sequence.",memoryTrick:"User-created recipe",relatedCocktails:[],
    utahComplianceStatus:calc.status,legalExplanation:"Calculated from entered categories; uncertain classifications require verification.",sourceVerificationNotes:"User-created record.",
    lastReviewedDate:today(),commonlyOrdered:false,tags:["custom"],procedure:["Confirm management approval.","Measure every ingredient.","Use the selected method and glass.","Verify totals and presentation."],changedForUtah:false,
    totalPrimarySpiritVolume:calc.primary,totalSecondaryAlcoholicFlavoringVolume:calc.secondary,totalSpirituousLiquorVolume:calc.totalSpirit,
    utahTotals:calc,standardTotals:calc
  };
  state.customCocktails.push(c);state.notes[id]=String(fd.get("notes")||"");saveState();return c;
}
function slugify(s){return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-");}

function exportProgress(){
  const blob=new Blob([JSON.stringify({app:"Utah Cocktail Academy",version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`utah-cocktail-academy-progress-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
}
async function importProgress(file){
  const parsed=JSON.parse(await file.text());
  if(parsed.app!=="Utah Cocktail Academy"||!parsed.state) throw new Error("This is not a Utah Cocktail Academy export.");
  state=deepMerge(structuredClone(defaultState),parsed.state);saveState();renderRoute();toast("Progress imported.");
}

function bindEvents(){
  window.addEventListener("hashchange",renderRoute);
  $("#global-random").addEventListener("click",()=>routeTo(`cocktail/${randomCocktail().id}`));
  document.addEventListener("click",e=>{
    const route=e.target.closest("[data-route]");
    if(route && route.tagName!=="A"){e.preventDefault();routeTo(route.dataset.route);return;}
    const open=e.target.closest("[data-open-cocktail]");
    if(open){e.preventDefault();routeTo(`cocktail/${open.dataset.openCocktail}`);return;}
    const card=e.target.closest(".cocktail-card");
    if(card&&!e.target.closest("button")){routeTo(`cocktail/${card.dataset.openCocktail}`);return;}
    const fav=e.target.closest("[data-favorite]");
    if(fav){e.stopPropagation();toggleFavorite(fav.dataset.favorite);renderRoute();toast(state.favorites.includes(fav.dataset.favorite)?"Added to favorites.":"Removed from favorites.");return;}
    if(e.target.closest("[data-random]")){routeTo(`cocktail/${randomCocktail().id}`);return;}
    if(e.target.closest("[data-quick-quiz]")){routeTo("study");setTimeout(()=>startQuiz("quiz",10),0);return;}
    if(e.target.closest("[data-open-custom]")){$("#custom-cocktail-dialog").showModal();return;}
    if(e.target.closest("[data-close-dialog]")){$("#custom-cocktail-dialog").close();return;}
    if(e.target.closest("[data-clear-filters]")){$$("#cocktail-search,#filter-base,#filter-family,#filter-difficulty,#filter-method,#filter-glass,#filter-status,#filter-study").forEach(x=>x.value="");filterCocktails();return;}
    if(e.target.closest("[data-inventory-toggle]")){const p=$("#inventory-panel");p.classList.toggle("hidden");if(!p.classList.contains("hidden"))p.innerHTML=renderInventoryPanel();return;}
    if(e.target.closest("[data-inventory-clear]")){state.inventory=[];saveState();$("#inventory-panel").innerHTML=renderInventoryPanel();return;}
    const spec=e.target.closest("[data-spec-tab]");if(spec){const id=currentRoute().split("/")[1];session.detailSpec={...(session.detailSpec||{}),[id]:spec.dataset.specTab};renderRoute();return;}
    const hide=e.target.closest("[data-hide-cocktail]");if(hide){state.hidden.push(hide.dataset.hideCocktail);saveState();routeTo("cocktails");toast("Cocktail hidden from your workplace set.");return;}
    const mastery=e.target.closest("[data-set-mastery]");if(mastery){state.mastered[mastery.dataset.id]=Number(mastery.dataset.setMastery);setStudyActivity();saveState();renderRoute();return;}
    const notes=e.target.closest("[data-save-notes]");if(notes){state.notes[notes.dataset.saveNotes]=$("#cocktail-note").value;state.houseSpecs[notes.dataset.saveNotes]=$("#house-spec").value;saveState();toast("Private notes saved.");return;}
    const mode=e.target.closest("[data-study-mode]");if(mode){startStudyMode(mode.dataset.studyMode);return;}
    const level=e.target.closest("[data-start-level]");if(level){startLevel(level.dataset.startLevel);return;}
    if(e.target.closest("[data-reveal-flash]")){session.flash.revealed=true;renderFlashcard();return;}
    const rate=e.target.closest("[data-rate-card]");if(rate){rateCard(Number(rate.dataset.rateCard),Number(rate.dataset.days));return;}
    const answer=e.target.closest("[data-answer]");if(answer){answerQuiz(answer.dataset.answer);return;}
    if(e.target.closest("[data-next-question]")){session.quiz.index++;session.quiz.answered=false;renderQuizQuestion();return;}
    const builder=e.target.closest("[data-builder-choice]");if(builder){const n=builder.dataset.builderChoice;session.builder.selected.has(n)?session.builder.selected.delete(n):session.builder.selected.add(n);renderBuilder();return;}
    if(e.target.closest("[data-check-builder]")){checkBuilder();return;}
    if(e.target.closest("[data-start-practice]")){startPractice();return;}
    const sc=e.target.closest("[data-scenario-choice]");if(sc){answerScenario(sc.dataset.scenarioChoice);return;}
    if(e.target.closest("[data-next-scenario]")){session.practice.index++;session.practice.answered=false;renderScenario();return;}
    const tab=e.target.closest("[data-library-tab]");if(tab){$$("[data-library-tab]").forEach(x=>x.classList.toggle("active",x===tab));$("#library-content").innerHTML=tab.dataset.libraryTab==="techniques"?techniqueGrid():tab.dataset.libraryTab==="glassware"?glassGrid():iceGrid();return;}
    if(e.target.closest("[data-save-legal-review]")){state.legalReviewDate=$("#legal-review-date").value||today();state.legalHistory.push({date:new Date().toISOString(),reviewDate:state.legalReviewDate});saveState();toast("Manual review date saved.");return;}
    if(e.target.closest("[data-export-progress]")){exportProgress();return;}
    if(e.target.closest("[data-import-progress]")){$("#import-file").click();return;}
    if(e.target.closest("[data-clear-legal-history]")){state.legalHistory=[];state.legalReviewDate=null;saveState();renderRoute();toast("Legal-history data cleared.");return;}
    if(e.target.closest("[data-unhide-cocktails]")){state.hidden=[];saveState();renderRoute();toast("Hidden cocktails restored.");return;}
    if(e.target.closest("[data-reset-progress]")){if(confirm("Reset all Utah Cocktail Academy progress, favorites, notes, inventory, custom cocktails, and settings?")){state=structuredClone(defaultState);saveState();renderRoute();toast("All local progress reset.");}return;}
  });
  document.addEventListener("keydown",e=>{
    const card=e.target.closest(".cocktail-card,[data-study-mode],[data-start-level]");
    if(card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();card.click();}
  });
  document.addEventListener("input",e=>{
    if(["cocktail-search","filter-base","filter-family","filter-difficulty","filter-method","filter-glass","filter-status","filter-study"].includes(e.target.id)) filterCocktails();
    if(["ingredient-search","ingredient-category"].includes(e.target.id)) filterIngredients();
    if(e.target.id==="inventory-search"){
      const q=e.target.value.toLowerCase();$$("[data-inventory]",$("#inventory-grid")).forEach(box=>box.closest(".check-item").classList.toggle("hidden",!box.dataset.inventory.toLowerCase().includes(q)));
    }
  });
  document.addEventListener("change",e=>{
    if(["filter-base","filter-family","filter-difficulty","filter-method","filter-glass","filter-status","filter-study","ingredient-category"].includes(e.target.id)){
      e.target.id==="ingredient-category"?filterIngredients():filterCocktails();
    }
    if(e.target.matches("[data-inventory]")){
      const name=e.target.dataset.inventory;
      state.inventory=e.target.checked?arrayUnique([...state.inventory,name]):state.inventory.filter(x=>x!==name);saveState();
      const r=$("#inventory-results");if(r)r.innerHTML=inventoryResultMarkup(inventoryMatches());
    }
    if(e.target.id==="skill-level"){state.skillLevel=e.target.value;saveState();renderRoute();}
    if(e.target.id==="text-scale"){state.settings.fontScale=Number(e.target.value);saveState();}
    if(e.target.id==="reduce-motion"){state.settings.reducedMotion=e.target.checked;saveState();}
  });
  $("#custom-cocktail-form").addEventListener("submit",e=>{
    e.preventDefault();
    try{const c=createCustomCocktail(e.currentTarget);$("#custom-cocktail-dialog").close();e.currentTarget.reset();routeTo(`cocktail/${c.id}`);toast("Custom cocktail saved.");}
    catch(err){toast(err.message);}
  });
  $("#import-file").addEventListener("change",async e=>{try{if(e.target.files[0])await importProgress(e.target.files[0]);}catch(err){toast(err.message);}finally{e.target.value="";}});
}
function rateCard(value,days){
  const s=session.flash,c=s.cards[s.index%s.cards.length],due=new Date();due.setDate(due.getDate()+days);
  state.mastered[c.id]=value;state.flashcards[c.id]={rating:value,last:today(),due:due.toISOString().slice(0,10)};setStudyActivity();saveState();
  s.index++;s.revealed=false;renderFlashcard();
}
function startStudyMode(mode){
  if(mode==="flashcards")startFlashcards();
  else if(mode==="builder")startBuilder();
  else if(mode==="missing")startMissing();
  else if(mode==="error")startError();
  else if(mode==="similar")startSimilar();
  else if(mode==="timed")startQuiz("timed",10);
  else startQuiz(mode==="reverse"?"reverse":"quiz",10);
}

async function boot(){
  applySettings();initNavigation();bindEvents();
  try{
    await loadData();
    renderRoute();
    if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("service-worker.js").catch(console.warn);
  }catch(err){
    console.error(err);
    $("#main-content").innerHTML=`<section class="page">${emptyState("The academy could not load",`${err.message}. Run the site through a local web server or GitHub Pages; browsers block JSON fetches from file:// URLs.`)}</section>`;
  }
}
boot();
