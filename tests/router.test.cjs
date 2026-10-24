const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
if(fs.existsSync(path.join(__dirname,'../router.js')))require('../router.js');
test('routes identify the three screens, grouped profile steps and result panels',()=>{
 const R=globalThis.QingyingRouter;
 assert.equal(typeof R?.resolve,'function','the SPA needs an explicit router');
 assert.deepEqual(R.resolve('#/home'),{screen:'home',step:null,panel:null,hash:'#/home'});
 for(const step of ['basic','habits','health'])assert.equal(R.resolve('#/profile/'+step).step,step);
 for(const panel of ['overview','week','records'])assert.equal(R.resolve('#/plan/'+panel).panel,panel);
});
test('invalid routes do not preserve arbitrary data or redirect outside the app',()=>{
 const R=globalThis.QingyingRouter;assert.equal(typeof R?.resolve,'function');
 for(const hash of ['',null,'#https://example.com','#/unknown','#/plan/overview?weight=75','#/profile/health/extra'])assert.equal(R.resolve(hash).hash,'#/home');
});
test('previous public anchors remain usable without returning to a stacked page',()=>{
 const R=globalThis.QingyingRouter;assert.equal(typeof R?.resolve,'function');
 assert.equal(R.resolve('#plan').hash,'#/profile/basic');
 assert.equal(R.resolve('#week').hash,'#/plan/week');
 assert.equal(R.resolve('#record').hash,'#/plan/records');
});
