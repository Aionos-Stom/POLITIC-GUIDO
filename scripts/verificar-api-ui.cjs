'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');

// El navegador ejecuta los módulos reales contra un almacén desechable en memoria.
// No se envían peticiones a Supabase, GitHub ni al proveedor de correo.
exports.run=async function ({browser,origin,check,overflow,screenshots,failures}) {
  const {fixture,ids,password}=await import('../tests/helpers/api-fixture.mjs');
  const {createHandler}=await import('../supabase/functions/guido-api/http.mjs');
  for(const width of [390,1440]) {
    const f=await fixture();
    const handler=createHandler(f.api,f.store,{origins:[origin],allowLocal:true});
    const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce',serviceWorkers:'block',locale:'es-DO'});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',error=>failures.push({stage:'api-'+width,javascript:error.message,stack:error.stack}));
    await page.route('**/*',async route=>{
      const request=route.request(),url=request.url();
      if(url.startsWith(origin+'/'))return route.continue();
      if(url.includes('/functions/v1/guido-api')) {
        const headers={...request.headers(),origin};
        const response=await handler(new Request(url,{method:request.method(),headers,body:request.method()==='POST'?request.postData():undefined}));
        return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
      }
      if(url.includes('@supabase/supabase-js')) return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:function(){return {from:function(){throw Error("Acceso directo inesperado");},rpc:function(){throw Error("RPC directa inesperada");}};}};'});
      if(url.startsWith('https://cdn.jsdelivr.net/'))return route.fulfill({contentType:'text/javascript',body:'/* Dependencia sin uso en esta prueba. */'});
      failures.push({stage:'api-'+width,externalRequestBlocked:url.split('?')[0]});return route.abort();
    });
    async function login(user) {
      await page.locator('#loginUser').fill(user);await page.locator('#loginPassword').fill(password);
      await page.locator('#loginForm button[type=submit]').click();
      await page.waitForFunction(()=>document.body.classList.contains('is-authenticated')&&document.querySelector('#totalVoters').textContent!=='—');
    }
    async function logout(){await page.evaluate(()=>document.querySelector('#logoutBtn').click());await page.waitForFunction(()=>!document.body.classList.contains('is-authenticated'));}
    await page.goto(origin,{waitUntil:'networkidle'});
    await check('api-'+width+': acceso protegido y restauración sin consultas directas',async()=>{
      await login('admin');assert.equal(await page.evaluate(()=>GuidoBackend.isSecure()),true);
      assert.equal(await page.evaluate(()=>getSession().password_hash),undefined);
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body.classList.contains('is-authenticated'));
      assert.equal(await page.evaluate(()=>getSession().id),ids.admin);
      await page.waitForFunction(()=>document.querySelectorAll('.zone-item').length===4);
      await overflow(page,'api-'+width+': resumen');
      await page.screenshot({path:path.join(screenshots,'api-'+width+'-resumen.png'),fullPage:true});
    });
    await check('api-'+width+': círculo provincial desglosa sus cuatro sectores',async()=>{
      await page.locator('.globe-marker:not([hidden])').first().click();
      await page.locator('#territoryInfoModal').waitFor({state:'visible'});
      assert.equal(await page.locator('.territory-info-zone').count(),4);
      assert.ok((await page.locator('#territoryInfoTitle').textContent()).includes('Santo Domingo'));
      assert.equal(await page.locator('#territoryInfoLocation').isVisible(),true);
      const content=await page.locator('#territoryInfoList').textContent();
      for(const sector of ['Sector 1','Sector 2','Sector 3','Sector 4'])assert.ok(content.includes(sector));
      await overflow(page,'api-'+width+': detalle provincial');
      await page.screenshot({path:path.join(screenshots,'api-'+width+'-detalle-territorial.png'),fullPage:true});
      if(width===390) {
        const enlarged=await page.addStyleTag({content:'html { font-size:200% !important; }'});
        await overflow(page,'api-390: ventana territorial con texto al 200%');
        await page.screenshot({path:path.join(screenshots,'api-390-detalle-territorial-200.png'),fullPage:true});
        await enlarged.evaluate(element=>element.remove());
      }
      await page.locator('#territoryInfoLocateBtn').click();
      await page.locator('#territoryInfoModal').waitFor({state:'hidden'});
    });
    await check('api-'+width+': asignación de equipo desde administración',async()=>{
      await page.evaluate(async id=>{const users=await getUsers();await fillUserForm(users.find(user=>user.id===id));},ids.other);
      await page.locator('#editUserManager').selectOption(ids.coord);
      await overflow(page,'api-'+width+': edición del equipo');
      await page.locator('#userEditForm button[type=submit]').click();
      await page.locator('#userEditModal').waitFor({state:'hidden'});
      assert.equal(f.state.users.find(user=>user.id===ids.other).manager_id,ids.coord);
    });
    await check('api-'+width+': coordinador ve su equipo y el registrador solo lo propio',async()=>{
      await logout();await login('coordinator');
      await page.waitForFunction(()=>document.querySelector('#totalVoters').textContent==='3');
      assert.equal(await page.locator('#manageUsersBtn').isVisible(),false);
      await page.waitForFunction(()=>document.querySelectorAll('.zone-item').length===3);
      // Incluye metadatos heredados incompletos y un nombre de rol presente.
      f.state.voters[2].registered_by_role='Registrador';
      const downloadPromise=page.waitForEvent('download');
      await page.evaluate(()=>exportToExcel());
      const download=await downloadPromise;
      const report=require('node:fs').readFileSync(await download.path(),'utf8');
      assert.ok(report.includes('Persona 2')&&report.includes('Persona 3')&&report.includes('Persona 4'));
      assert.equal(report.includes('Persona 1'),false);
      await logout();await login('register');
      await page.waitForFunction(()=>document.querySelector('#totalVoters').textContent==='1');
      await page.waitForFunction(()=>document.querySelectorAll('.zone-item').length===1);
      const rejected=await page.evaluate(async id=>supabase.from('users').update({role:'Administrador'}).eq('id',id),ids.reg);
      assert.equal(rejected.error.status,403);
    });
    await check('api-'+width+': caducidad elimina el mapa y cierra la sesión',async()=>{
      await page.locator('.globe-marker:not([hidden])').first().click();
      await page.locator('#territoryInfoModal').waitFor({state:'visible'});
      assert.equal(await page.locator('.territory-info-zone').count(),1);
      f.state.guido_sessions.length=0;
      await page.evaluate(async()=>{await supabase.rpc('territory_map_data');});
      await page.waitForFunction(()=>!document.body.classList.contains('is-authenticated'));
      assert.equal(await page.locator('.globe-marker').count(),0);
      assert.equal(await page.locator('#territoryInfoModal').isVisible(),false);
      assert.equal(await page.locator('#territoryInfoList').textContent(),'');
    });
    await check('api-'+width+': recuperación completa con enlace local y sin correo real',async()=>{
      await page.locator('#forgotPasswordBtn').click();await page.locator('#forgotEmail').fill('register@example.invalid');
      await page.locator('#forgotForm button[type=submit]').click();
      await page.waitForFunction(()=>document.querySelector('#forgotMessage').textContent.includes('Si el correo'));
      assert.equal(f.emails.length,1);const reset=new URL(f.emails[0].link).searchParams.get('reset_token');
      await page.goto(origin+'/?reset_token='+reset,{waitUntil:'networkidle'});
      await page.locator('#resetPassword').waitFor({state:'visible'});
      await page.locator('#resetPassword').fill(password);await page.locator('#resetPasswordConfirm').fill(password);
      await page.locator('#resetForm button[type=submit]').click();
      await page.locator('#resetPasswordModal').waitFor({state:'hidden'});
      assert.equal(f.state.users.find(user=>user.id===ids.reg).reset_token,null);
      await login('register');await logout();
    });
    await context.close();
  }
};
