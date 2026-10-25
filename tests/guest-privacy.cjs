const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {startBrowser,navigate,generate}=require('./browser-support.cjs');
const date=new Date().toISOString().slice(0,10);
const oldState={version:1,profile:{age:33,height:175,current:88.4,goal:80,weeks:24,activity:'low',experience:'beginner',minutes:20,days:3,diet:'balanced',equipment:'none',place:'home',health:[]},records:[{date,weight:86.1}],checkins:[{date,fatigue:'high',hunger:'low',completion:'high'}],habits:{[date]:{meal:true,movement:false}}};
const backup=state=>JSON.stringify({app:'qingying-plan',state});
(async()=>{
 const env=await startBrowser({bfcache:true}),failures=[],outcomes=[];
 const fresh=async({legacy=null,blocked=false,holdAsset=false}={})=>{
  const context=await env.browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,locale:'zh-CN'});
  await context.addInitScript(({legacy,blocked})=>{
   window.__privacyCalls={reads:[],writes:[],deletes:[]};window.__pageShows=[];
   addEventListener('pageshow',e=>window.__pageShows.push(e.persisted));
   if(blocked){for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('blocked','SecurityError');}});return;}
   const local=localStorage,session=sessionStorage;
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
   if(legacy!==null){set.call(local,'qingying-state-v1',legacy);set.call(local,'other-app-setting','leave-me');}
   window.__readLegacy=()=>get.call(local,'qingying-state-v1');
   Storage.prototype.getItem=function(key){window.__privacyCalls.reads.push({area:this===local?'local':'session',key});return get.call(this,key);};
   Storage.prototype.setItem=function(key,value){window.__privacyCalls.writes.push({area:this===local?'local':'session',key});return set.call(this,key,value);};
   Storage.prototype.removeItem=function(key){window.__privacyCalls.deletes.push({area:this===local?'local':'session',key});return remove.call(this,key);};
  },{legacy,blocked});
  let releaseAsset=()=>{};
  if(holdAsset){const gate=new Promise(resolve=>releaseAsset=resolve);await context.route('**/assets/meal-hero.webp',async route=>{await gate;await route.continue();});}
  const page=await context.newPage();await page.goto(env.base,{waitUntil:holdAsset?'domcontentloaded':'load'});return {page,context,releaseAsset};
 };
 const ready=async page=>{assert.equal(await page.locator('#end-guest').count(),1,'the guest end action must be globally available');await page.waitForFunction(()=>document.documentElement.dataset.guestReady==='true');};
 const end=async page=>{page.once('dialog',d=>d.accept());await page.locator('#end-guest').click();await page.waitForFunction(()=>location.hash==='#/home');};
 const empty=async page=>{
  for(const name of ['age','height','current','goal','weeks'])assert.equal(await page.locator('#plan-form [name='+name+']').inputValue(),'');
  assert.equal(await page.locator('#plan-form [name=health]:checked').count(),0);
  assert.equal(await page.locator('#record-weight').inputValue(),'');
  assert.equal(await page.locator('#entries .entry').count(),0);assert.equal(await page.locator('#checkin-history .checkin-entry').count(),0);
  assert.equal(await page.locator('#chart circle').count(),0);assert.equal(await page.locator('#target-current').textContent(),'');
  assert.equal(await page.locator('#why-list').textContent(),'');assert.equal(await page.locator('#import-summary').textContent(),'');
  for(const id of ['headline','summary','bmi','pace','duration','target-goal','change-list','week-grid','daily-detail'])assert.equal(await page.locator('#'+id).textContent(),'');
  assert.ok(!(await page.locator('#meal-check').isChecked()));assert.ok(!(await page.locator('#plan-pending').isVisible()));
 };
 const exported=async page=>{
  await navigate(page,'#/plan/records');const pending=page.waitForEvent('download');await page.locator('#export-data').click();const download=await pending;
  return JSON.parse(await fs.readFile(await download.path(),'utf8')).state;
 };
 const importFile=(page,state,name='backup.json')=>page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(backup(state))});
 const cases=[
 ['initial',async()=>{
  const {page,context}=await fresh({legacy:JSON.stringify(oldState)});try{
   assert.equal(await page.locator('[name=current]').inputValue(),'','old browser profile must not auto-populate even hidden controls');
   assert.equal(await page.locator('#entries .entry').count(),0,'old records must not be displayed');
   assert.deepEqual(await page.evaluate(()=>__privacyCalls.reads),[],'no old value may be read before consent');
   await ready(page);await navigate(page,'#/plan/records');assert.ok(await page.locator('#legacy-notice').isVisible());
   assert.ok(!(await page.locator('#legacy-notice').innerText()).includes('86.1'));
   assert.deepEqual(await page.evaluate(()=>__privacyCalls.writes),[]);assert.deepEqual(await page.evaluate(()=>__privacyCalls.deletes),[]);
  }finally{await context.close();}
 }],
 ['memory',async()=>{
  const {page,context}=await fresh();try{await ready(page);await generate(page);await navigate(page,'#/plan/records');
   await page.locator('#record-weight').fill('72.5');await page.locator('#add-record').click();await page.locator('#meal-check').check();
   await page.locator('#checkin-form [name=fatigue]').selectOption('high');await page.locator('#update-checkin').click();
   const saved=await exported(page);assert.equal(saved.profile.current,75);assert.equal(saved.records[0].weight,72.5);assert.ok(saved.habits[date].meal);assert.equal(saved.checkins[0].fatigue,'high');
   assert.deepEqual(await page.evaluate(()=>__privacyCalls.writes),[]);assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
   const second=await context.newPage();await second.goto(env.base);await ready(second);await navigate(second,'#/plan/records');assert.equal(await second.locator('#entries .entry').count(),0);
   await second.locator('#record-weight').fill('68');await second.locator('#add-record').click();assert.match(await page.locator('#entries').innerText(),/72.5/);assert.ok(!(await page.locator('#entries').innerText()).includes('68.0'));
   await page.evaluate(state=>dispatchEvent(new StorageEvent('storage',{key:'qingying-state-v1',newValue:JSON.stringify(state)})),oldState);
   assert.match(await page.locator('#entries').innerText(),/72.5/);
   await page.reload();await ready(page);assert.equal(new URL(page.url()).hash,'#/home');await empty(page);
   const reopened=await context.newPage();await reopened.goto(env.base+'/#/plan/overview');await ready(reopened);await empty(reopened);
  }finally{await context.close();}
 }],
 ['end',async()=>{
  const {page,context}=await fresh();try{await ready(page);await generate(page);await navigate(page,'#/plan/records');await page.locator('#record-weight').fill('72.5');await page.locator('#add-record').click();
   await page.locator('#record-weight').fill('99.9');await page.locator('#checkin-form [name=hunger]').selectOption('high');
   await navigate(page,'#/profile/basic');await page.locator('[name=current]').fill('88.8');await navigate(page,'#/profile/health');await page.locator('[name=health][value=knee]').check();
   await end(page);await empty(page);assert.equal(await page.locator('[name=health]:checked').count(),0);
   for(let i=0;i<4;i++){await page.goBack();await page.waitForTimeout(50);await empty(page);}
   await navigate(page,'#/profile/basic');assert.equal(await page.locator('[name=current]').inputValue(),'');
   const state=await exported(page);assert.equal(state.profile,null);assert.deepEqual(state.records,[]);assert.deepEqual(state.checkins,[]);assert.deepEqual(state.habits,{});
  }finally{await context.close();}
 }],
 ['legacy',async()=>{
  const {page,context}=await fresh({legacy:JSON.stringify(oldState)});try{await ready(page);await generate(page);await navigate(page,'#/plan/records');await page.locator('#record-weight').fill('72.5');await page.locator('#add-record').click();
   await page.locator('#restore-legacy').click();assert.ok(await page.locator('#legacy-dialog').isVisible());assert.deepEqual(await page.evaluate(()=>__privacyCalls.reads),[]);
   assert.ok(!(await page.locator('#legacy-dialog').innerText()).includes('86.1'));await page.locator('#cancel-legacy').click();assert.match(await page.locator('#entries').innerText(),/72.5/);
   await page.locator('#restore-legacy').click();await page.locator('#confirm-legacy').click();
   assert.equal(await page.locator('[name=current]').inputValue(),'88.4');assert.equal(await page.locator('#entries .entry').count(),1);assert.match(await page.locator('#entries').innerText(),/86.1/);
   assert.ok(!(await page.locator('#entries').innerText()).includes('72.5'));assert.equal(await page.evaluate(()=>__privacyCalls.reads.filter(x=>x.key==='qingying-state-v1').length),1);
   assert.equal(await page.evaluate(()=>__readLegacy()),JSON.stringify(oldState));assert.deepEqual(await page.evaluate(()=>__privacyCalls.writes),[]);
   await end(page);await empty(page);await page.reload();await ready(page);await empty(page);
   await navigate(page,'#/plan/records');page.once('dialog',d=>d.accept());await page.locator('#delete-legacy').click();assert.equal(await page.evaluate(()=>__readLegacy()),null);
   assert.equal(await page.evaluate(()=>localStorage.getItem('other-app-setting')),'leave-me');assert.ok(!(await page.locator('#legacy-notice').isVisible()));
  }finally{await context.close();}
 }],
 ['failure',async()=>{
  const {page,context}=await fresh({legacy:'broken private legacy'});try{await ready(page);await generate(page);await navigate(page,'#/plan/records');await page.locator('#record-weight').fill('72.5');await page.locator('#add-record').click();
   await page.locator('#restore-legacy').click();await page.locator('#confirm-legacy').click();assert.match(await page.locator('#legacy-error').innerText(),/无法|失败/);assert.equal(await page.locator('[name=current]').inputValue(),'75');await page.locator('#cancel-legacy').click();
   await page.evaluate(()=>{Storage.prototype.removeItem=function(){throw new Error('blocked delete');};});page.once('dialog',d=>d.accept());await page.locator('#delete-legacy').click();
   assert.equal(await page.evaluate(()=>__readLegacy()),'broken private legacy');assert.match(await page.locator('#legacy-message').innerText(),/无法|失败/);assert.equal(await page.locator('#entries .entry').count(),1);
   await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});await page.waitForFunction(()=>document.getElementById('data-message').textContent.includes('无法'));
   assert.match(await page.locator('#entries').innerText(),/72.5/);
   await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('download unavailable');};});await page.locator('#export-data').click();assert.match(await page.locator('#data-message').innerText(),/无法|失败/);assert.equal(await page.locator('#entries .entry').count(),1);
  }finally{await context.close();}
  const blocked=await fresh({blocked:true});try{await ready(blocked.page);await generate(blocked.page);await navigate(blocked.page,'#/plan/records');await blocked.page.locator('#record-weight').fill('71');await blocked.page.locator('#add-record').click();assert.match(await blocked.page.locator('#entries').innerText(),/71.0/);await end(blocked.page);await empty(blocked.page);}finally{await blocked.context.close();}
 }],
 ['late-import',async()=>{
  const {page,context}=await fresh();try{await ready(page);await navigate(page,'#/plan/records');
   await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){const text=await original.call(this);return await new Promise(resolve=>window.__releaseImport=()=>resolve(text));};});
   await importFile(page,oldState,'slow.json');await page.waitForFunction(()=>typeof __releaseImport==='function');await end(page);
   await generate(page,{basic:{current:'80',goal:'74'}});await page.evaluate(()=>__releaseImport());await page.waitForTimeout(100);
   assert.ok(!(await page.locator('#import-dialog').isVisible()));assert.equal(await page.locator('[name=current]').inputValue(),'80');assert.equal(await page.locator('#import-summary').textContent(),'');
   assert.equal((await exported(page)).profile.current,80);
  }finally{await context.close();}
 }],
 ['bfcache',async()=>{
  const {page,context}=await fresh();try{await ready(page);await generate(page);await navigate(page,'#/plan/records');await page.locator('#record-weight').fill('72.5');await page.locator('#add-record').click();
   await page.goto(env.base+'/tests/away.html');await page.goBack();await ready(page);await empty(page);
   assert.equal(new URL(page.url()).hash,'#/home');assert.ok(await page.evaluate(()=>__pageShows.includes(true)),'must exercise an actual BFCache restoration');
   await generate(page);await page.evaluate(()=>document.dispatchEvent(new Event('freeze')));await page.evaluate(()=>document.dispatchEvent(new Event('resume')));await page.waitForFunction(()=>document.documentElement.dataset.guestReady==='true');await empty(page);
   return {actualBFCacheRestoration:true,freezeResumeCheck:'synthetic events'};
  }finally{await context.close();}
 }],
 ['late-picker',async()=>{
  const {page,context}=await fresh();try{await ready(page);await navigate(page,'#/plan/records');
   const pending=page.waitForEvent('filechooser');await page.locator('#import-data').click();const chooser=await pending;
   await end(page);await generate(page,{basic:{current:'80',goal:'74'}});
   await chooser.setFiles({name:'previous-visitor.json',mimeType:'application/json',buffer:Buffer.from(backup(oldState))});await page.waitForTimeout(100);
   assert.ok(!(await page.locator('#import-dialog').isVisible()),'a file picker opened by the ended guest cannot create a new preview');
   assert.equal(await page.locator('[name=current]').inputValue(),'80');
  }finally{await context.close();}
 }],
 ['suspended',async()=>{
  const {page,context,releaseAsset}=await fresh({legacy:JSON.stringify(oldState),holdAsset:true});try{
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.guestReady),'false');
   let blocked=false;
   try{await page.locator('#end-guest').click({timeout:400});}catch(error){if(error.name==='TimeoutError')blocked=true;else throw error;}
   assert.ok(blocked,'suspended pages must not allow global controls to act before sanitation');
   assert.ok(!(await page.locator('#legacy-dialog').evaluate(el=>el.open)));
   releaseAsset();await ready(page);await empty(page);
  }finally{releaseAsset();await context.close();}
 }]
 ];
 try{
  for(const [name,run] of cases){if(process.env.QINGYING_PRIVACY_CASE&&process.env.QINGYING_PRIVACY_CASE!==name)continue;try{const evidence=await run();outcomes.push({name,passed:true,...(evidence?{evidence}:{})});console.log('PASS guest privacy: '+name);}catch(error){failures.push(name+': '+error.stack);outcomes.push({name,passed:false,error:error.message});console.error('FAIL guest privacy: '+name+' — '+error.message);}}
  await fs.mkdir(path.join(env.root,'artifacts'),{recursive:true});await fs.writeFile(path.join(env.root,'artifacts/guest-privacy-results.json'),JSON.stringify(outcomes,null,2));
  if(failures.length)throw new Error(failures.join('\n'));
 }finally{await env.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
