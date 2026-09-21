/* Mi Capital v4 — modo local con gráfica y preparado para Supabase.
   Para activar nube: completa SUPABASE_URL y SUPABASE_ANON_KEY.
*/
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
const cloudEnabled = false;
const sb = null;
const KEY='miCapital_v2_local';
let db=JSON.parse(localStorage.getItem(KEY)||'{"users":[],"current":null}');
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
let selectedBusinessId=null;
function render(){cloudEnabled?cloudRender():localRender()}
function localRender(){db.current?dashboard(db.users.find(u=>u.id===db.current)):auth('login')}
function auth(mode='login',message=''){
 document.getElementById('app').innerHTML=`<main class="auth"><section class="card auth-card"><div class="brand">Mi Capital</div><h1>${mode==='login'?'Iniciar sesión':'Crear cuenta'}</h1><p class="small">Control personal de aportaciones, devoluciones y rendimiento estimado.</p>${message?`<div class="notice">${esc(message)}</div>`:''}<form id="authForm"><div class="field"><label>Correo electrónico</label><input id="email" type="email" autocomplete="email" required></div><div class="field"><label>Contraseña</label><input id="pass" type="password" minlength="6" autocomplete="${mode==='login'?'current-password':'new-password'}" required></div>${mode==='register'?'<div class="field"><label>Nombre</label><input id="name" autocomplete="name" required></div>':''}<button class="btn primary" style="width:100%">${mode==='login'?'Entrar':'Registrarme'}</button><div id="err" class="error"></div></form><p class="switchline">${mode==='login'?'¿No tienes cuenta?':'¿Ya tienes cuenta?'} <span class="switch" id="switch">${mode==='login'?'Crear cuenta':'Iniciar sesión'}</span></p></section></main>`;
 document.getElementById('switch').onclick=()=>auth(mode==='login'?'register':'login');
 document.getElementById('authForm').onsubmit=e=>{e.preventDefault();const email=document.getElementById('email').value.trim().toLowerCase(),pass=document.getElementById('pass').value;if(mode==='register'){if(db.users.some(u=>u.email===email))return err('Ese correo ya está registrado.');const u={id:crypto.randomUUID(),name:document.getElementById('name').value.trim(),email,pass,businesses:[]};db.users.push(u);db.current=u.id;save();dashboard(u)}else{const u=db.users.find(u=>u.email===email&&u.pass===pass);if(!u)return err('Correo o contraseña incorrectos.');db.current=u.id;save();dashboard(u)}};
}
const err=m=>document.getElementById('err').textContent=m;
function getBusinesses(u){return u.businesses||[]}
function dashboard(u){
 if(!u)return localRender();
 const bs=getBusinesses(u); if(!selectedBusinessId || !bs.some(b=>b.id===selectedBusinessId)) selectedBusinessId=bs[0]?.id||null;
 const b=bs.find(x=>x.id===selectedBusinessId); const moves=b?.moves||[];
 const ins=moves.filter(m=>m.type==='in').reduce((a,m)=>a+m.amount,0), outs=moves.filter(m=>m.type==='out').reduce((a,m)=>a+m.amount,0), pending=Math.max(ins-outs,0), gain=outs-ins, pct=ins?gain/ins*100:0;
 document.getElementById('app').innerHTML=`<header class="appbar"><strong>Mi Capital</strong><div class="top-actions"><span class="small user-name">${esc(u.name)}</span><button id="logout" class="btn secondary">Salir</button></div></header><main class="wrap"><div class="toolbar"><div><h1>Mi resumen</h1><span class="small">Gestiona tus negocios y movimientos</span></div><button id="newBusiness" class="btn secondary">＋ Nuevo negocio</button></div>${bs.length?`<section class="businessbar"><label>Negocio / proyecto</label><select id="businessSelect">${bs.map(x=>`<option value="${x.id}" ${x.id===selectedBusinessId?'selected':''}>${esc(x.name)}</option>`).join('')}</select><button id="renameBusiness" class="btn secondary">Editar nombre</button></section>`:'<section class="card empty">Crea tu primer negocio para comenzar a registrar movimientos.</section>'}${b?`<section class="grid"><div class="card metric"><div class="label">Capital ingresado</div><div class="value">${money(ins)}</div></div><div class="card metric"><div class="label">Total devuelto</div><div class="value">${money(outs)}</div></div><div class="card metric"><div class="label">Capital pendiente</div><div class="value">${money(pending)}</div></div><div class="card metric"><div class="label">Resultado estimado</div><div class="value ${gain>=0?'positive':'negative'}">${money(gain)}</div><div class="small">${pct.toFixed(2)}% sobre lo ingresado</div></div></section><section class="card chart-card" style="margin-top:18px"><div class="toolbar"><div><h2>Evolución del capital</h2><span class="small">Ingresos y devoluciones acumulados por fecha</span></div></div>${chart(moves)}</section><section class="card" style="margin-top:18px"><div class="toolbar"><h2>Movimientos</h2><div><button id="add" class="btn primary">＋ Nuevo movimiento</button> <span class="small">${moves.length} registro(s)</span></div></div>${table(moves)}</section>`:''}</main><div id="modal"></div>`;
 document.getElementById('logout').onclick=()=>{db.current=null;selectedBusinessId=null;save();render()};
 document.getElementById('newBusiness').onclick=()=>businessModal(u);
 if(document.getElementById('businessSelect'))document.getElementById('businessSelect').onchange=e=>{selectedBusinessId=e.target.value;dashboard(u)};
 if(document.getElementById('renameBusiness'))document.getElementById('renameBusiness').onclick=()=>businessModal(u,b);
 if(document.getElementById('add'))document.getElementById('add').onclick=()=>moveModal(u,b);
}
function chart(ms){
 if(!ms.length)return '<div class="chart-empty">Agrega movimientos para visualizar la evolución del capital.</div>';
 const rows=[...ms].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 let cumIn=0,cumOut=0;
 const pts=rows.map(m=>{if(m.type==='in')cumIn+=m.amount;else cumOut+=m.amount;return {date:m.date,ins:cumIn,outs:cumOut,balance:cumIn-cumOut};});
 const W=900,H=300,L=62,R=24,T=22,B=48;
 const max=Math.max(1,...pts.flatMap(p=>[p.ins,p.outs,Math.abs(p.balance)]));
 const x=i=>pts.length===1?W/2:L+i*(W-L-R)/Math.max(1,pts.length-1);
 const y=v=>T+(max-v)*(H-T-B)/max;
 const poly=(key,cls)=>pts.map((p,i)=>`${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
 const labels=pts.map((p,i)=>`<text x="${x(i).toFixed(1)}" y="${H-17}" text-anchor="middle">${esc(p.date.slice(5))}</text>`).join('');
 const dots=(key,cls)=>pts.map((p,i)=>`<circle class="${cls}" cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="4"><title>${esc(p.date)} — ${money(p[key])}</title></circle>`).join('');
 const ticks=[0,.25,.5,.75,1].map(t=>{const v=max*t, yy=y(v);return `<line class="gridline" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="axislabel" x="${L-10}" y="${yy+4}" text-anchor="end">${money(v)}</text>`}).join('');
 return `<div class="chart-wrap"><div class="chart-legend"><span><i class="legend-dot income"></i>Ingresos acumulados</span><span><i class="legend-dot return"></i>Devoluciones acumuladas</span></div><svg class="capital-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de ingresos y devoluciones acumulados"><g>${ticks}</g><polyline class="line income-line" points="${poly('ins')}"/><polyline class="line return-line" points="${poly('outs')}"/>${dots('ins','income-point')}${dots('outs','return-point')}<line class="axis" x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/>${labels}</svg></div>`;
}
function table(ms){if(!ms.length)return '<div class="empty">Aún no tienes movimientos en este negocio.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Notas</th><th>Monto</th><th></th></tr></thead><tbody>${[...ms].sort((a,b)=>b.date.localeCompare(a.date)).map(m=>`<tr><td>${esc(m.date)}</td><td><span class="tag ${m.type}">${m.type==='in'?'Ingreso':'Devolución'}</span></td><td>${esc(m.concept)}</td><td>${esc(m.notes||'')}</td><td>${money(m.amount)}</td><td><button class="btn danger" data-del="${m.id}">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`}
function businessModal(u,b=null){document.getElementById('modal').innerHTML=`<div class="modal"><section class="card"><h2>${b?'Renombrar negocio':'Nuevo negocio'}</h2><form id="businessForm"><div class="field"><label>Nombre</label><input id="businessName" maxlength="80" value="${esc(b?.name||'')}" placeholder="Ej. Negocio principal" required></div><div class="actions"><button type="button" id="cancel" class="btn secondary">Cancelar</button><button class="btn primary">Guardar</button></div><div id="modalErr" class="error"></div></form></section></div>`;document.getElementById('cancel').onclick=()=>document.getElementById('modal').innerHTML='';document.getElementById('businessForm').onsubmit=e=>{e.preventDefault();const name=document.getElementById('businessName').value.trim();if(!name)return;u.businesses=u.businesses||[];if(b)b.name=name;else{const n={id:crypto.randomUUID(),name,moves:[]};u.businesses.push(n);selectedBusinessId=n.id}save();dashboard(u)}}
function moveModal(u,b){document.getElementById('modal').innerHTML=`<div class="modal"><section class="card"><h2>Nuevo movimiento</h2><form id="moveForm"><div class="field"><label>Tipo</label><select id="type"><option value="in">Ingreso</option><option value="out">Devolución</option></select></div><div class="field"><label>Fecha</label><input id="date" type="date" value="${today()}" required></div><div class="field"><label>Monto (MXN)</label><input id="amount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Concepto</label><input id="concept" maxlength="100" placeholder="Ej. Aportación inicial" required></div><div class="field"><label>Notas (opcional)</label><textarea id="notes" rows="3"></textarea></div><div class="actions"><button type="button" id="cancel" class="btn secondary">Cancelar</button><button class="btn primary">Guardar</button></div><div id="moveErr" class="error"></div></form></section></div>`;document.getElementById('cancel').onclick=()=>document.getElementById('modal').innerHTML='';document.getElementById('moveForm').onsubmit=e=>{e.preventDefault();const amount=Number(document.getElementById('amount').value);if(!(amount>0))return document.getElementById('moveErr').textContent='El monto debe ser mayor a cero.';b.moves.push({id:crypto.randomUUID(),type:document.getElementById('type').value,date:document.getElementById('date').value,amount,concept:document.getElementById('concept').value.trim(),notes:document.getElementById('notes').value.trim()});save();dashboard(u)}}
document.addEventListener('click',e=>{const id=e.target.dataset.del;if(id){const u=db.users.find(x=>x.id===db.current),b=u.businesses.find(x=>x.id===selectedBusinessId);b.moves=b.moves.filter(m=>m.id!==id);save();dashboard(u)}});
// Supabase migration scaffold: the local mode remains usable until credentials are configured.
async function cloudRender(){const {data:{session}}=await sb.auth.getSession();if(!session)return authCloud();await cloudDashboard(session.user)}
function authCloud(){auth('login','Modo nube pendiente de configuración. La versión local sigue disponible.');}
async function cloudDashboard(user){/* Implemented after SQL/RLS setup; local MVP is intentionally retained as fallback. */auth('login','La conexión con Supabase está preparada, pero aún falta configurar el proyecto.');}
render();
