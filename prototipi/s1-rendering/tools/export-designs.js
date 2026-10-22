// Esporta dall'HTML originale i 129 disegni delle tessere (SVG) e la tavola del livello 20 (96 tessere).
// Uso: node tools/export-designs.js "<percorso di Majoa Mahjong.html>" <cartella del prototipo>
// Richiede Playwright con Chromium. Dopo l'esportazione servono `tools/text_to_paths.py` e `tools/generate-tile-index.js`.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const [html,out]=process.argv.slice(2);
if(!html||!out){console.error('Uso: node tools/export-designs.js "<Majoa Mahjong.html>" <cartella prototipo>');process.exit(2);}
const src=fs.readFileSync(html,'utf8');
const HOOK="openMap(); window.__x={get TYPES(){return TYPES},get FACES(){return FACES},startLevel:startLevel,get tiles(){return tiles},get STAR_IDX(){return STAR_IDX}};})();</script>";
const patched=src.replace(/openMap\(\);\s*\}\)\(\);\s*<\/script>/,HOOK);
if(!patched.includes('__x'))throw new Error('hook');
(async()=>{
 const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(patched);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const br=await chromium.launch();const pg=await (await br.newContext({viewport:{width:390,height:780}})).newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://127.0.0.1:'+srv.address().port+'/');await pg.waitForTimeout(300);
 const d=await pg.evaluate(()=>{
   const x=window.__x; const types=x.TYPES.slice();
   x.startLevel(20);
   const t=x.tiles.map(a=>({x:a.x,y:a.y,z:a.z,type:a.type}));
   return {types,tiles:t,star:x.STAR_IDX};
 });
 fs.mkdirSync(path.join(out,'assets/tiles'),{recursive:true});
 d.types.forEach((inner,i)=>{
   const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">'+inner+'</svg>\n';
   fs.writeFileSync(path.join(out,'assets/tiles',String(i).padStart(3,'0')+'.svg'),svg);
 });
 fs.mkdirSync(path.join(out,'src/data'),{recursive:true});
 fs.writeFileSync(path.join(out,'src/data/level20.json'),JSON.stringify({id:'legacy-20',starType:d.star,tiles:d.tiles},null,1)+'\n');
 console.log('designs',d.types.length,'tiles',d.tiles.length,'errs',JSON.stringify(errs));
 await br.close();srv.close();
})();
