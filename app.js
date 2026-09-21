/* Mi Capital — versión conectada a Supabase
   Frontend estático para GitHub Pages.
   La Publishable Key puede estar en el frontend; la seguridad real está en RLS.
*/

const SUPABASE_URL = 'https://xnwuoheyuorofpdivuok.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aBxKDERTfTdeVwNCKpBwKQ_TAL0-ykE';

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PRODUCTION_APP_URL = 'https://lortalopes-lab.github.io/capital/';
const LOCAL_APP_URL = 'http://localhost:3000/';

function getRecoveryRedirectUrl() {
  // Cuando se prueba esta versión localmente desde un servidor HTTP,
  // el enlace puede regresar a localhost. En producción, regresa a GitHub Pages.
  if (window.location.protocol !== 'file:' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return LOCAL_APP_URL;
  }
  return PRODUCTION_APP_URL;
}

let recoveryMode = false;

const money = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN'
}).format(Number(n) || 0);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

const today = () => new Date().toISOString().slice(0, 10);

let currentUser = null;
let currentProfile = null;
let selectedBusinessId = null;
let currentBusinesses = [];
let currentMovements = [];
let adminData = { profiles: [], businesses: [], movements: [] };

function setApp(html) {
  document.getElementById('app').innerHTML = html;
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

function friendlyError(error) {
  const msg = error?.message || 'Ocurrió un error. Intenta nuevamente.';
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/user already registered/i.test(msg)) return 'Ese correo ya está registrado.';
  if (/password/i.test(msg) && /6/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  return msg;
}

async function loadSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;

  if (!data.session) {
    currentUser = null;
    currentProfile = null;
    return renderAuth('login');
  }

  currentUser = data.session.user;
  await loadProfile();
}

async function loadProfile() {
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error(error);
    return renderAuth('login', 'No se pudo cargar tu perfil. Verifica la configuración de la base de datos.');
  }

  currentProfile = data;
  await loadUserDashboard();
}

function renderAuth(mode = 'login', message = '') {
  setApp(`
    <main class="auth">
      <section class="card auth-card">
        <div class="brand">Mi Capital</div>
        <h1>${mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p class="small">Control personal de aportaciones, devoluciones y rendimiento estimado.</p>
        ${message ? `<div class="notice">${esc(message)}</div>` : ''}
        <form id="authForm">
          ${mode === 'register' ? `
            <div class="field">
              <label>Nombre</label>
              <input id="name" autocomplete="name" required>
            </div>` : ''}
          <div class="field">
            <label>Correo electrónico</label>
            <input id="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label>Contraseña</label>
            <input id="pass" type="password" minlength="6"
              autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required>
          </div>
          <button class="btn primary" style="width:100%">
            ${mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
          <div id="err" class="error"></div>
        </form>
        ${mode === 'login' ? `
          <p class="switchline"><span class="switch" id="forgotPassword">¿Olvidaste tu contraseña?</span></p>
        ` : ''}
        <p class="switchline">
          ${mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
          <span class="switch" id="switch">
            ${mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </span>
        </p>
      </section>
    </main>
  `);

  document.getElementById('switch').onclick =
    () => renderAuth(mode === 'login' ? 'register' : 'login');

  const forgot = document.getElementById('forgotPassword');
  if (forgot) forgot.onclick = () => renderForgotPassword();

  document.getElementById('authForm').onsubmit = async e => {
    e.preventDefault();
    const button = e.target.querySelector('button');
    button.disabled = true;
    showError('err', '');

    try {
      const email = document.getElementById('email').value.trim().toLowerCase();
      const pass = document.getElementById('pass').value;

      if (mode === 'register') {
        const name = document.getElementById('name').value.trim();
        const { data, error } = await sb.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: name } }
        });
        if (error) throw error;

        if (!data.session) {
          renderAuth('login', 'Cuenta creada. Revisa tu correo para confirmar la cuenta y después inicia sesión.');
        } else {
          currentUser = data.user;
          await loadProfile();
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        currentUser = data.user;
        await loadProfile();
      }
    } catch (error) {
      console.error(error);
      showError('err', friendlyError(error));
      button.disabled = false;
    }
  };
}


function renderForgotPassword(message = '') {
  setApp(`
    <main class="auth">
      <section class="card auth-card">
        <div class="brand">Mi Capital</div>
        <h1>Restablecer contraseña</h1>
        <p class="small">Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>
        ${message ? `<div class="notice">${esc(message)}</div>` : ''}
        <form id="resetRequestForm">
          <div class="field">
            <label>Correo electrónico</label>
            <input id="resetEmail" type="email" autocomplete="email" required>
          </div>
          <button id="resetRequestButton" class="btn primary" style="width:100%">
            Enviar enlace
          </button>
          <div id="resetErr" class="error"></div>
        </form>
        <p class="switchline">
          <span class="switch" id="backToLogin">Volver a iniciar sesión</span>
        </p>
      </section>
    </main>
  `);

  document.getElementById('backToLogin').onclick = () => renderAuth('login');

  document.getElementById('resetRequestForm').onsubmit = async e => {
    e.preventDefault();
    const button = document.getElementById('resetRequestButton');
    button.disabled = true;
    showError('resetErr', '');

    try {
      const email = document.getElementById('resetEmail').value.trim().toLowerCase();
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: getRecoveryRedirectUrl()
      });
      if (error) throw error;

      renderForgotPassword(
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de correo no deseado.'
      );
    } catch (error) {
      console.error(error);
      showError('resetErr', friendlyError(error));
      button.disabled = false;
    }
  };
}

function renderResetPassword() {
  recoveryMode = true;
  setApp(`
    <main class="auth">
      <section class="card auth-card">
        <div class="brand">Mi Capital</div>
        <h1>Nueva contraseña</h1>
        <p class="small">Escribe y confirma tu nueva contraseña.</p>
        <form id="newPasswordForm">
          <div class="field">
            <label>Nueva contraseña</label>
            <input id="newPassword" type="password" minlength="6"
              autocomplete="new-password" required>
          </div>
          <div class="field">
            <label>Confirmar contraseña</label>
            <input id="confirmPassword" type="password" minlength="6"
              autocomplete="new-password" required>
          </div>
          <button id="newPasswordButton" class="btn primary" style="width:100%">
            Guardar nueva contraseña
          </button>
          <div id="newPasswordErr" class="error"></div>
        </form>
      </section>
    </main>
  `);

  document.getElementById('newPasswordForm').onsubmit = async e => {
    e.preventDefault();
    const button = document.getElementById('newPasswordButton');
    button.disabled = true;
    showError('newPasswordErr', '');

    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('confirmPassword').value;

    if (password.length < 6) {
      showError('newPasswordErr', 'La contraseña debe tener al menos 6 caracteres.');
      button.disabled = false;
      return;
    }

    if (password !== confirmation) {
      showError('newPasswordErr', 'Las contraseñas no coinciden.');
      button.disabled = false;
      return;
    }

    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;

      recoveryMode = false;
      // Limpiamos el fragmento del enlace de recuperación para que no se reutilice.
      history.replaceState({}, document.title, window.location.pathname + window.location.search);

      await sb.auth.signOut();
      currentUser = null;
      currentProfile = null;
      selectedBusinessId = null;
      currentBusinesses = [];
      currentMovements = [];

      renderAuth('login', 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.');
    } catch (error) {
      console.error(error);
      showError('newPasswordErr', friendlyError(error));
      button.disabled = false;
    }
  };
}

async function startApp() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isRecovery = params.get('type') === 'recovery';

  if (isRecovery) {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      return renderAuth('login', 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.');
    }

    currentUser = data.session.user;
    renderResetPassword();
    return;
  }

  await loadSession();
}

async function loadUserDashboard() {
  const { data: businesses, error: bError } = await sb
    .from('businesses')
    .select('id, user_id, name, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (bError) {
    console.error(bError);
    return renderError('No se pudieron cargar tus negocios.');
  }

  currentBusinesses = businesses || [];

  if (!selectedBusinessId || !currentBusinesses.some(b => b.id === selectedBusinessId)) {
    selectedBusinessId = currentBusinesses[0]?.id || null;
  }

  if (selectedBusinessId) {
    const { data: movements, error: mError } = await sb
      .from('movements')
      .select('id, business_id, user_id, movement_date, type, concept, notes, amount, created_at, updated_at')
      .eq('business_id', selectedBusinessId)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (mError) {
      console.error(mError);
      return renderError('No se pudieron cargar los movimientos.');
    }
    currentMovements = movements || [];
  } else {
    currentMovements = [];
  }

  renderDashboard();
}

function renderError(message) {
  setApp(`
    <main class="auth">
      <section class="card auth-card">
        <div class="brand">Mi Capital</div>
        <h1>Algo salió mal</h1>
        <div class="notice">${esc(message)}</div>
        <button class="btn primary" onclick="location.reload()">Reintentar</button>
      </section>
    </main>
  `);
}

function stats(moves) {
  const ins = moves.filter(m => m.type === 'ingreso')
    .reduce((a, m) => a + Number(m.amount), 0);
  const outs = moves.filter(m => m.type === 'devolucion')
    .reduce((a, m) => a + Number(m.amount), 0);
  const pending = Math.max(ins - outs, 0);
  const gain = outs - ins;
  const pct = ins ? gain / ins * 100 : 0;
  return { ins, outs, pending, gain, pct };
}

function renderDashboard() {
  const b = currentBusinesses.find(x => x.id === selectedBusinessId);
  const s = stats(currentMovements);

  setApp(`
    <header class="appbar">
      <strong>Mi Capital</strong>
      <div class="top-actions">
        ${currentProfile?.role === 'admin'
          ? '<span class="admin-badge">ADMIN</span>' : ''}
        <span class="small user-name">${esc(currentProfile?.full_name || currentUser?.email || '')}</span>
        <button id="logout" class="btn secondary">Salir</button>
      </div>
    </header>

    <main class="wrap">
      <div class="toolbar">
        <div>
          <h1>Mi resumen</h1>
          <span class="small">Gestiona tus negocios y movimientos</span>
        </div>
        <div class="top-actions">
          ${currentProfile?.role === 'admin'
            ? '<button id="adminPanel" class="btn secondary">Panel administrador</button>' : ''}
          <button id="newBusiness" class="btn secondary">＋ Nuevo negocio</button>
        </div>
      </div>

      ${currentBusinesses.length ? `
        <section class="businessbar">
          <label>Negocio / proyecto</label>
          <select id="businessSelect">
            ${currentBusinesses.map(x => `
              <option value="${x.id}" ${x.id === selectedBusinessId ? 'selected' : ''}>
                ${esc(x.name)}
              </option>`).join('')}
          </select>
          <button id="renameBusiness" class="btn secondary">Editar nombre</button>
        </section>
      ` : `
        <section class="card empty">
          Crea tu primer negocio para comenzar a registrar movimientos.
        </section>
      `}

      ${b ? `
        <section class="grid">
          <div class="card metric">
            <div class="label">Capital ingresado</div>
            <div class="value">${money(s.ins)}</div>
          </div>
          <div class="card metric">
            <div class="label">Total devuelto</div>
            <div class="value">${money(s.outs)}</div>
          </div>
          <div class="card metric">
            <div class="label">Capital pendiente</div>
            <div class="value">${money(s.pending)}</div>
          </div>
          <div class="card metric">
            <div class="label">Resultado estimado</div>
            <div class="value ${s.gain >= 0 ? 'positive' : 'negative'}">${money(s.gain)}</div>
            <div class="small">${s.pct.toFixed(2)}% sobre lo ingresado</div>
          </div>
        </section>

        <section class="card chart-card" style="margin-top:18px">
          <div class="toolbar">
            <div>
              <h2>Evolución del capital</h2>
              <span class="small">Ingresos y devoluciones acumulados por fecha</span>
            </div>
          </div>
          ${chart(currentMovements)}
        </section>

        <section class="card" style="margin-top:18px">
          <div class="toolbar">
            <h2>Movimientos</h2>
            <div>
              <button id="add" class="btn primary">＋ Nuevo movimiento</button>
              <span class="small">${currentMovements.length} registro(s)</span>
            </div>
          </div>
          ${table(currentMovements)}
        </section>
      ` : ''}
    </main>

    <div id="modal"></div>
  `);

  document.getElementById('logout').onclick = async () => {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    selectedBusinessId = null;
    currentBusinesses = [];
    currentMovements = [];
    renderAuth('login');
  };

  document.getElementById('newBusiness').onclick = () => businessModal();

  const select = document.getElementById('businessSelect');
  if (select) select.onchange = async e => {
    selectedBusinessId = e.target.value;
    await loadUserDashboard();
  };

  const rename = document.getElementById('renameBusiness');
  if (rename) rename.onclick = () => businessModal(b);

  const add = document.getElementById('add');
  if (add) add.onclick = () => moveModal();

  const admin = document.getElementById('adminPanel');
  if (admin) admin.onclick = loadAdminPanel;

  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = () => deleteMovement(btn.dataset.del);
  });

  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => moveModal(currentMovements.find(m => m.id === btn.dataset.edit));
  });
}

function chart(ms) {
  if (!ms.length) return '<div class="chart-empty">Agrega movimientos para visualizar la evolución del capital.</div>';

  const rows = [...ms].sort((a,b) =>
    a.movement_date.localeCompare(b.movement_date) || a.id.localeCompare(b.id)
  );
  let cumIn = 0, cumOut = 0;
  const pts = rows.map(m => {
    if (m.type === 'ingreso') cumIn += Number(m.amount);
    else cumOut += Number(m.amount);
    return { date: m.movement_date, ins: cumIn, outs: cumOut };
  });

  const W=900,H=300,L=72,R=24,T=22,B=48;
  const max=Math.max(1,...pts.flatMap(p=>[p.ins,p.outs]));
  const x=i=>pts.length===1?W/2:L+i*(W-L-R)/Math.max(1,pts.length-1);
  const y=v=>T+(max-v)*(H-T-B)/max;
  const poly=key=>pts.map((p,i)=>`${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const labels=pts.map((p,i)=>`<text x="${x(i).toFixed(1)}" y="${H-17}" text-anchor="middle">${esc(p.date.slice(5))}</text>`).join('');
  const dots=(key,cls)=>pts.map((p,i)=>`
    <circle class="${cls}" cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="4">
      <title>${esc(p.date)} — ${money(p[key])}</title>
    </circle>`).join('');
  const ticks=[0,.25,.5,.75,1].map(t=>{
    const v=max*t, yy=y(v);
    return `<line class="gridline" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/>
            <text class="axislabel" x="${L-10}" y="${yy+4}" text-anchor="end">${money(v)}</text>`;
  }).join('');

  return `
    <div class="chart-wrap">
      <div class="chart-legend">
        <span><i class="legend-dot income"></i>Ingresos acumulados</span>
        <span><i class="legend-dot return"></i>Devoluciones acumuladas</span>
      </div>
      <svg class="capital-chart" viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Gráfica de ingresos y devoluciones acumulados">
        <g>${ticks}</g>
        <polyline class="line income-line" points="${poly('ins')}"/>
        <polyline class="line return-line" points="${poly('outs')}"/>
        ${dots('ins','income-point')}
        ${dots('outs','return-point')}
        <line class="axis" x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/>
        ${labels}
      </svg>
    </div>`;
}

function table(ms) {
  if (!ms.length) return '<div class="empty">Aún no tienes movimientos en este negocio.</div>';

  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Notas</th><th>Monto</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          ${[...ms].sort((a,b)=>b.movement_date.localeCompare(a.movement_date))
            .map(m=>`
              <tr>
                <td>${esc(m.movement_date)}</td>
                <td><span class="tag ${m.type}">${m.type === 'ingreso' ? 'Ingreso' : 'Devolución'}</span></td>
                <td>${esc(m.concept)}</td>
                <td>${esc(m.notes || '')}</td>
                <td>${money(m.amount)}</td>
                <td class="row-actions">
                  <button class="btn secondary small-btn" data-edit="${m.id}">Editar</button>
                  <button class="btn danger small-btn" data-del="${m.id}">Eliminar</button>
                </td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function businessModal(b = null) {
  document.getElementById('modal').innerHTML = `
    <div class="modal">
      <section class="card">
        <h2>${b ? 'Renombrar negocio' : 'Nuevo negocio'}</h2>
        <form id="businessForm">
          <div class="field">
            <label>Nombre</label>
            <input id="businessName" maxlength="80" value="${esc(b?.name || '')}"
              placeholder="Ej. Negocio principal" required>
          </div>
          <div class="actions">
            <button type="button" id="cancel" class="btn secondary">Cancelar</button>
            <button class="btn primary">Guardar</button>
          </div>
          <div id="modalErr" class="error"></div>
        </form>
      </section>
    </div>`;

  document.getElementById('cancel').onclick = closeModal;

  document.getElementById('businessForm').onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById('businessName').value.trim();
    if (!name) return showError('modalErr', 'Escribe un nombre.');

    try {
      let error;
      if (b) {
        ({ error } = await sb.from('businesses').update({ name }).eq('id', b.id));
      } else {
        const { data, error: insertError } = await sb.from('businesses')
          .insert({ user_id: currentUser.id, name })
          .select('id')
          .single();
        error = insertError;
        if (data) selectedBusinessId = data.id;
      }
      if (error) throw error;
      closeModal();
      await loadUserDashboard();
    } catch (err) {
      showError('modalErr', friendlyError(err));
    }
  };
}

function moveModal(m = null) {
  document.getElementById('modal').innerHTML = `
    <div class="modal">
      <section class="card">
        <h2>${m ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        <form id="moveForm">
          <div class="field">
            <label>Tipo</label>
            <select id="type">
              <option value="ingreso" ${m?.type === 'ingreso' ? 'selected' : ''}>Ingreso</option>
              <option value="devolucion" ${m?.type === 'devolucion' ? 'selected' : ''}>Devolución</option>
            </select>
          </div>
          <div class="field">
            <label>Fecha</label>
            <input id="date" type="date" value="${esc(m?.movement_date || today())}" required>
          </div>
          <div class="field">
            <label>Monto (MXN)</label>
            <input id="amount" type="number" min="0.01" step="0.01"
              value="${m ? Number(m.amount).toFixed(2) : ''}" required>
          </div>
          <div class="field">
            <label>Concepto</label>
            <input id="concept" maxlength="100" value="${esc(m?.concept || '')}"
              placeholder="Ej. Aportación inicial" required>
          </div>
          <div class="field">
            <label>Notas (opcional)</label>
            <textarea id="notes" rows="3">${esc(m?.notes || '')}</textarea>
          </div>
          <div class="actions">
            <button type="button" id="cancel" class="btn secondary">Cancelar</button>
            <button class="btn primary">Guardar</button>
          </div>
          <div id="moveErr" class="error"></div>
        </form>
      </section>
    </div>`;

  document.getElementById('cancel').onclick = closeModal;

  document.getElementById('moveForm').onsubmit = async e => {
    e.preventDefault();

    const amount = Number(document.getElementById('amount').value);
    if (!(amount > 0)) return showError('moveErr', 'El monto debe ser mayor a cero.');

    const payload = {
      business_id: selectedBusinessId,
      user_id: currentUser.id,
      movement_date: document.getElementById('date').value,
      type: document.getElementById('type').value,
      amount,
      concept: document.getElementById('concept').value.trim(),
      notes: document.getElementById('notes').value.trim() || null
    };

    try {
      let error;
      if (m) {
        ({ error } = await sb.from('movements').update(payload).eq('id', m.id));
      } else {
        ({ error } = await sb.from('movements').insert(payload));
      }
      if (error) throw error;
      closeModal();
      await loadUserDashboard();
    } catch (err) {
      showError('moveErr', friendlyError(err));
    }
  };
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.innerHTML = '';
}

async function deleteMovement(id) {
  if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return;

  const { error } = await sb.from('movements').delete().eq('id', id);
  if (error) {
    alert(friendlyError(error));
    return;
  }
  await loadUserDashboard();
}

async function loadAdminPanel() {
  if (currentProfile?.role !== 'admin') return;

  const [p, b, m] = await Promise.all([
    sb.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: true }),
    sb.from('businesses').select('id, user_id, name, created_at').order('created_at', { ascending: true }),
    sb.from('movements').select('id, business_id, user_id, movement_date, type, concept, notes, amount, created_at')
      .order('movement_date', { ascending: false })
  ]);

  const firstError = [p,b,m].find(x => x.error);
  if (firstError) {
    alert(friendlyError(firstError.error));
    return;
  }

  adminData = {
    profiles: p.data || [],
    businesses: b.data || [],
    movements: m.data || []
  };

  renderAdminPanel();
}

function renderAdminPanel() {
  const totalIn = adminData.movements.filter(m=>m.type==='ingreso')
    .reduce((a,m)=>a+Number(m.amount),0);
  const totalOut = adminData.movements.filter(m=>m.type==='devolucion')
    .reduce((a,m)=>a+Number(m.amount),0);

  const userMap = Object.fromEntries(adminData.profiles.map(p=>[p.id,p]));
  const businessMap = Object.fromEntries(adminData.businesses.map(b=>[b.id,b]));

  setApp(`
    <header class="appbar">
      <strong>Mi Capital · Administración</strong>
      <div class="top-actions">
        <button id="backDashboard" class="btn secondary">Mi resumen</button>
        <button id="logout" class="btn secondary">Salir</button>
      </div>
    </header>

    <main class="wrap">
      <div class="toolbar">
        <div>
          <h1>Panel administrador</h1>
          <span class="small">Consulta de usuarios, negocios y movimientos</span>
        </div>
      </div>

      <section class="grid">
        <div class="card metric"><div class="label">Usuarios</div><div class="value">${adminData.profiles.length}</div></div>
        <div class="card metric"><div class="label">Negocios</div><div class="value">${adminData.businesses.length}</div></div>
        <div class="card metric"><div class="label">Capital ingresado</div><div class="value">${money(totalIn)}</div></div>
        <div class="card metric"><div class="label">Total devuelto</div><div class="value">${money(totalOut)}</div></div>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="toolbar"><h2>Usuarios</h2><span class="small">${adminData.profiles.length} registro(s)</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nombre</th><th>ID</th><th>Rol</th><th>Alta</th></tr></thead>
            <tbody>
              ${adminData.profiles.map(p=>`
                <tr>
                  <td>${esc(p.full_name || 'Sin nombre')}</td>
                  <td class="mono">${esc(p.id)}</td>
                  <td><span class="tag ${p.role === 'admin' ? 'admin-tag' : 'user-tag'}">${esc(p.role)}</span></td>
                  <td>${esc(String(p.created_at || '').slice(0,10))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="toolbar"><h2>Negocios</h2><span class="small">${adminData.businesses.length} registro(s)</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Negocio</th><th>Usuario</th><th>Usuario ID</th><th>Alta</th></tr></thead>
            <tbody>
              ${adminData.businesses.map(b=>`
                <tr>
                  <td>${esc(b.name)}</td>
                  <td>${esc(userMap[b.user_id]?.full_name || 'Sin nombre')}</td>
                  <td class="mono">${esc(b.user_id)}</td>
                  <td>${esc(String(b.created_at || '').slice(0,10))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="toolbar"><h2>Movimientos de todos los usuarios</h2><span class="small">${adminData.movements.length} registro(s)</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Negocio</th><th>Tipo</th><th>Concepto</th><th>Monto</th></tr></thead>
            <tbody>
              ${adminData.movements.map(m=>`
                <tr>
                  <td>${esc(m.movement_date)}</td>
                  <td>${esc(userMap[m.user_id]?.full_name || 'Sin nombre')}</td>
                  <td>${esc(businessMap[m.business_id]?.name || 'Sin negocio')}</td>
                  <td><span class="tag ${m.type}">${m.type === 'ingreso' ? 'Ingreso' : 'Devolución'}</span></td>
                  <td>${esc(m.concept)}</td>
                  <td>${money(m.amount)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `);

  document.getElementById('backDashboard').onclick = loadUserDashboard;
  document.getElementById('logout').onclick = async () => {
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    renderAuth('login');
  };
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    currentUser = session?.user || null;
    renderResetPassword();
    return;
  }

  if (event === 'SIGNED_OUT' && !recoveryMode) {
    currentUser = null;
    currentProfile = null;
    selectedBusinessId = null;
    currentBusinesses = [];
    currentMovements = [];
    renderAuth('login');
  }
});

startApp().catch(error => {
  console.error(error);
  renderAuth('login', 'No se pudo iniciar la aplicación. Revisa la conexión con Supabase.');
});
