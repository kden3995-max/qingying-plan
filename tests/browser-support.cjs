const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function startBrowser({bfcache=false}={}){
 const mountPath=process.env.QINGYING_TEST_BASE_PATH||'';
 if(mountPath&&!/^\/[a-z0-9-]+$/i.test(mountPath))throw new Error('Invalid test mount path');
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(mountPath&&url.pathname===mountPath){res.writeHead(301,{Location:mountPath+'/'});res.end();return;}
   if(mountPath&&!url.pathname.startsWith(mountPath+'/')){res.writeHead(404);res.end();return;}
   const relative=decodeURIComponent(url.pathname.slice(mountPath.length)).replace(/^\//,'')||'index.html';
   const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep)||relative.startsWith('.')||relative.includes('/.')){res.writeHead(404);res.end();return;}
   const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
   const ext=path.extname(file);if(!mime[ext]){res.writeHead(404);res.end();return;}
   const data=await fs.readFile(file);res.setHeader('Content-Type',mime[ext]);res.end(data);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 let browser;
 try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',ignoreDefaultArgs:bfcache?['--disable-back-forward-cache']:undefined,args:['--no-sandbox']});}
 catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
 return {browser,base:'http://127.0.0.1:'+server.address().port+mountPath,root,async close(){await browser.close();await new Promise(resolve=>server.close(resolve));}};
}
async function waitForGuest(page){await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-guest-ready')||document.documentElement.dataset.guestReady==='true');}
async function navigate(page,hash){await waitForGuest(page);await page.evaluate(h=>{location.hash=h;},hash);await page.waitForFunction(h=>location.hash===h,hash);await page.waitForTimeout(50);}
async function fillBasic(page,values={}){
 for(const [name,value] of Object.entries({age:'25',height:'170',current:'75',goal:'70',weeks:'12',...values}))await page.locator('#plan-form [name='+name+']').fill(value);
}
async function generate(page,options={}){
 await navigate(page,'#/profile/basic');await fillBasic(page,options.basic);
 await page.locator('#next-profile').click();
 for(const [name,value] of Object.entries(options.habits||{}))await page.locator('#plan-form [name='+name+']').selectOption(value);
 await page.locator('#next-profile').click();
 for(const value of options.health||[])await page.locator('#plan-form [name=health][value='+value+']').check();
 await page.locator('#update-plan').click();
 await page.waitForFunction(()=>location.hash==='#/plan/overview');
}
module.exports={startBrowser,navigate,fillBasic,generate,waitForGuest};
