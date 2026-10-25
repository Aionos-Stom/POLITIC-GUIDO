#!/usr/bin/env node
'use strict';
// Acceso demostrativo en localhost. Todos los cambios viven en memoria.
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf','.jpeg':'image/jpeg'};
exports.createPreview=async function (origin) {
 const {fixture,password}=await import('../tests/helpers/api-fixture.mjs');
 const {createApi}=await import('../supabase/functions/guido-api/core.mjs');
 const {createHandler}=await import('../supabase/functions/guido-api/http.mjs');
 const f=await fixture();
 const api=createApi(f.store,{appUrl:origin+'/',sendReset:async(email,name,link)=>{f.emails.push({email,name,link});},onError:code=>console.warn('Prueba local:',code)});
 const handler=createHandler(api,f.store,{origins:[origin],allowLocal:true});
 return {password,async handle(request) {
  const url=new URL(request.url);
  if(url.pathname==='/functions/v1/guido-api')return handler(request);
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return new Response(null,{status:400});}
  if(pathname==='/sw.js')return new Response(null,{status:410});
  if(pathname.split('/').some(part=>part.startsWith('.'))||/^\/(supabase|tests|scripts|docs)\//.test(pathname))return new Response(null,{status:403});
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep))return new Response(null,{status:403});
  let content;try{content=await fs.readFile(filename);}catch{return new Response('Archivo no disponible',{status:404});}
  if(pathname==='/'||pathname==='/index.html') {
   content=content.toString().replace(/<script[^>]+src="https:\/\/[^\"]+"[^>]*><\/script>/g,'');
   content=content.replace('<body>','<body><aside role="note" style="padding:12px 20px;background:#fff4cf;color:#453700;text-align:center;font:600 14px system-ui">Prueba local · Datos ficticios · No modifica Supabase · <a href="/__local/correos">Bandeja de correo de prueba</a></aside>');
   content=content.replace('<script src="audit.js"','<script>window.supabase={createClient:function(){return {from:function(){throw Error("Acceso directo desactivado en esta prueba");}};}};</script><script src="audit.js"');
  }
  if(pathname==='/script.js') {
   content=content.toString().replace(/const SUPABASE_URL\s*=\s*'[^']*';/,'const SUPABASE_URL = '+JSON.stringify(origin)+';').replace(/const SUPABASE_ANON_KEY\s*=\s*'[^']*';/,'const SUPABASE_ANON_KEY = "local-preview-only";');
   const pwa=content.indexOf('/* ── PWA');if(pwa>=0)content=content.slice(0,pwa);
   if(!content.includes('local-preview-only'))return new Response('No se pudo aislar la configuración local',{status:500});
  }
  return new Response(request.method==='HEAD'?null:content,{headers:{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 },emails:f.emails};
};
async function main() {
 const port=Number(process.env.PORT||4055);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT debe ser un puerto entre 1024 y 65535.');
 const origin='http://127.0.0.1:'+port,preview=await exports.createPreview(origin);
 const server=http.createServer(async(req,res)=>{
  try {
   if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)) {res.writeHead(403).end();return;}
   if(req.url==='/__local/correos') {
    const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end('<!doctype html><html lang="es"><meta charset="utf-8"><title>Correo de prueba</title><body><h1>Bandeja local de prueba</h1><p>No se envió ningún correo real.</p>'+preview.emails.map(email=>'<p>'+escape(email.email)+' <a href="'+escape(email.link)+'">Restablecer contraseña de prueba</a></p>').join('')+'<p><a href="/">Volver al sistema</a></p></body></html>');return;
   }
   let body; if(req.method==='POST'){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>131072){res.writeHead(413).end();return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
   const response=await preview.handle(new Request(origin+req.url,{method:req.method,headers:req.headers,body}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500).end('No se pudo completar la prueba local.');}
 });
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Puerto ocupado. Usa PORT=4056 antes del comando.':error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log('\nPrueba local: '+origin+'\nUsuario: admin\nContraseña: '+preview.password+'\nOtros perfiles: coordinator / register, con la misma contraseña.\nDatos ficticios en memoria; Ctrl+C para cerrar.\n'));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
