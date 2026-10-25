const assert=require('node:assert/strict');
const {startBrowser,waitForGuest,generate,navigate}=require('./browser-support.cjs');
(async()=>{
 const env=await startBrowser();
 try{
  const context=await env.browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'}),page=await context.newPage();
  await page.goto(env.base);await waitForGuest(page);
  assert.equal(await page.locator('.guest-bar').count(),0,'no repeated guest banner above page content');
  assert.ok(await page.locator('#home-privacy-note').isVisible());
  assert.equal(await page.locator('#home-privacy-note').innerText(),'无需登录即可使用，刷新后资料会清空');
  await generate(page);assert.equal(await page.locator('dialog[open]').count(),0,'no automatic privacy modal');
  assert.ok((await page.locator('.plan-heading').boundingBox()).y<160,'results begin near the phone header');
  await navigate(page,'#/home');assert.ok(!(await page.locator('#home-privacy-note').isVisible()),'first-entry notice does not repeat in the same document');
  await navigate(page,'#/profile/basic');assert.ok((await page.locator('#profile-view-title').boundingBox()).y<180,'form is not displaced by a guest banner');
  await navigate(page,'#/plan/records');assert.match(await page.locator('#backup-note').innerText(),/刷新或退出前导出备份/);
  assert.ok(!(await page.locator('.privacy-details').evaluate(el=>el.open)));await page.locator('.privacy-details summary').click();
  assert.match(await page.locator('.privacy').innerText(),/不自动写入浏览器存储或上传云端/);
  const menu=page.locator('.mobile-menu');await menu.locator('summary').click();
  page.once('dialog',d=>d.accept());await page.locator('#menu-end-guest').click();
  assert.equal(new URL(page.url()).hash,'#/home');assert.ok(!(await menu.evaluate(el=>el.open)));
  assert.ok(!(await page.locator('#home-privacy-note').isVisible()));assert.equal(await page.locator('[name=current]').inputValue(),'');
  assert.ok(await page.locator('footer #end-guest').isVisible());
  const fresh=await context.newPage();await fresh.goto(env.base);await waitForGuest(fresh);assert.ok(await fresh.locator('#home-privacy-note').isVisible());
  await page.reload();await waitForGuest(page);assert.ok(await page.locator('#home-privacy-note').isVisible());
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  console.log('PASS first-entry home notice, contextual backup/privacy, unobstructed mobile content and accessible end actions');
 }finally{await env.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
