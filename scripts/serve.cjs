// Static local preview only. No data API or browser-data collection.
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const host=option('--host','127.0.0.1'),port=Number(option('--port','4173'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  const file=path.resolve(root,relative),type=mime[path.extname(file)];
  if(!type||!file.startsWith(root+path.sep)||relative.startsWith('.')||relative.includes('/.')){res.writeHead(404);res.end();return;}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,host,()=>console.log(`Local preview: http://${host}:${port}/#/home`));
