/* SYLAJ – Pamja e re */
(function () {
  'use strict';
  if (document.getElementById('sylajBottomNav')) return;

  const css = document.createElement('style');
  css.textContent = `
    body{padding-bottom:calc(86px + env(safe-area-inset-bottom,0px))!important}
    #sylajBottomNav{position:fixed;bottom:0;left:0;right:0;z-index:9000;background:#fff;border-top:1px solid #dce3eb;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 18px #102b4212}
    #sylajBottomNav button{border:0!important;background:transparent!important;color:#5c6b7b!important;display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 0!important;font:500 12px system-ui!important;min-width:0;cursor:pointer;box-shadow:none!important}
    #sylajBottomNav button .sylaj-ico{font-size:23px;line-height:1.2}
    #sylajBottomNav button.sylaj-current{color:#126195!important;font-weight:750!important}
    #sylajHomePanel{margin:16px auto;padding:18px;max-width:100%;background:#fff;border:1px solid #dbe3eb;border-radius:16px}
    #sylajHomePanel h2{margin:0 0 14px;font-size:20px}
    #sylajHomeGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px 5px}
    #sylajHomeGrid button{border:0!important;background:transparent!important;color:#20344a!important;box-shadow:none!important;display:flex;flex-direction:column;align-items:center;gap:6px;padding:4px 0!important;min-width:0;font:500 12px system-ui!important;overflow-wrap:anywhere}
    #sylajHomeGrid .sylaj-circle{width:57px;height:57px;border-radius:50%;background:#e0f3f3;display:grid;place-items:center;font-size:26px}
    #sylajSplash{position:fixed;inset:0;z-index:99999;background:linear-gradient(145deg,#061625,#123957);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;transition:opacity .22s ease}
    #sylajSplash strong{font:bold clamp(46px,13vw,80px) system-ui;letter-spacing:3px;text-shadow:0 4px 15px #0005}
    #sylajSplash .sylaj-blue{font:bold 26px system-ui;letter-spacing:5px;color:#64c3ff}
    #sylajSplash small{font:500 14px system-ui;letter-spacing:3px;color:#d1e4f0}
    body.sylaj-scanning #sylajBottomNav{display:none!important}
    @media(min-width:900px){#sylajBottomNav{max-width:520px;left:50%;transform:translateX(-50%);border-radius:16px 16px 0 0}}
  `;
  document.head.appendChild(css);

  const nav = document.createElement('nav');
  nav.id = 'sylajBottomNav';
  nav.setAttribute('aria-label','Glavna navigacija');

  const items = [
    ['home','🏠','Domov'],
    ['hoursTab','🕒','Ure'],
    ['toolsTab','🛠️','Orodja'],
    ['other','☰','Ostalo']
  ];

  const buttons = {};
  for (const [id,ico,label] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML =
      '<span class="sylaj-ico" aria-hidden="true">' +
      ico + '</span><span>' + label + '</span>';
    b.addEventListener('click', () => navigate(id));
    nav.appendChild(b);
    buttons[id] = b;
  }
  document.body.appendChild(nav);

  const home = document.createElement('section');
  home.id = 'sylajHomePanel';
  home.hidden = true;
  home.innerHTML =
    '<h2>SYLAJ – Pregled</h2>' +
    '<div id="sylajHomeGrid"></div>';

  const app = document.getElementById('app');
  if (app) app.insertBefore(home, app.firstChild);

  const entries = [
    ['hoursTab','🕒','Delovne ure'],
    ['toolsTab','🛠️','Orodja'],
    ['workersTab','👷','Delavci'],
    ['sitesTab','🏗️','Gradbišča'],
    ['bagerTab','🚜','Bagerji'],
    ['vozilaTab','🚐','Vozila'],
    ['izmereTab','📐','Izmere'],
    ['ratingsTab','⭐','Ocene'],
    ['gpsTab','📍','GPS']
  ];

  const grid = document.getElementById('sylajHomeGrid');
  for (const [id,ico,label] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML =
      '<span class="sylaj-circle" aria-hidden="true">' +
      ico + '</span><span>' + label + '</span>';
    b.addEventListener('click', () => navigate(id));
    grid.appendChild(b);
  }

  function loggedIn() {
    const a = document.getElementById('app');
    return !!a &&
      !a.classList.contains('hidden') &&
      !a.hidden;
  }

  function hideHome() {
    home.hidden = true;
  }

  function showHome() {
    if (!loggedIn()) return;
    document.querySelectorAll(
      '#hoursView,#toolsView,#workersView,' +
      '#sitesView,#bagerView,#vozilaView,' +
      '#ratingsView,#gpsView,#izmereView'
    ).forEach(s => s.classList.add('hidden'));
    home.hidden = false;
  }

  function navigate(id) {
    if (!loggedIn()) return;
    hideHome();

    if (id === 'home' || id === 'other') {
      showHome();
    } else {
      const original = document.getElementById(id);
      if (original) original.click();
      else showHome();
    }

    for (const k of Object.keys(buttons)) {
      buttons[k].classList.toggle(
        'sylaj-current', k === id
      );
    }

    window.scrollTo({top:0,behavior:'smooth'});
  }

  entries.forEach(([id]) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', hideHome);
  });

  const observer = new MutationObserver(() => {
    const panel = document.getElementById('walkScanPanel');
    const camera = panel && panel.querySelector('video');
    document.body.classList.toggle(
      'sylaj-scanning',
      !!(camera && camera.srcObject &&
         !camera.paused &&
         panel.getClientRects().length)
    );
  });

  observer.observe(document.body, {
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class','style']
  });

  const splash = document.createElement('div');
  splash.id = 'sylajSplash';
  splash.innerHTML =
    '<strong>SYLAJ</strong>' +
    '<span class="sylaj-blue">D.O.O.</span>' +
    '<small>GRADBENIŠTVO</small>' +
    '<small>— EVIDENCA —</small>';

  document.body.appendChild(splash);

  setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 250);
  }, 3500);

  function updateLogin() {
    nav.style.display = loggedIn() ? 'grid' : 'none';
    if (!loggedIn()) hideHome();
  }

  updateLogin();

  const loginObserver = new MutationObserver(updateLogin);
  if (app) {
    loginObserver.observe(app, {
      attributes:true,
      attributeFilter:['class','style','hidden']
    });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#loginBtn,#logout')) {
      setTimeout(updateLogin,250);
    }
  });
})();
