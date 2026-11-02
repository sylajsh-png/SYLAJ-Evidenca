/* SYLAJ – GPS + Kamera, Samsung dhe iPhone */
(() => {
  'use strict';

  if (document.getElementById('sylajAutoMatje')) return;

  const panel = document.createElement('section');
  panel.id = 'sylajAutoMatje';
  panel.style.cssText =
    'margin:18px 0;padding:16px;border:1px solid #cbd5e1;' +
    'border-radius:15px;background:#f8fafc;color:#172c40';

  panel.innerHTML = `
    <h2>📷 SYLAJ – Auto Matje</h2>
    <p>Kamera + GPS za Samsung in iPhone</p>

    <video id="samVideo" autoplay playsinline muted
      style="width:100%;max-height:330px;background:#111;border-radius:12px"></video>

    <p>
      <button type="button" id="samCamera">📷 Odpri kamero</button>
      <button type="button" id="samPhoto">📸 Fotografiraj</button>
      <button type="button" id="samClose">⏹ Zapri kamero</button>
    </p>

    <canvas id="samCanvas" style="display:none"></canvas>
    <div id="samPhotos"></div>

    <h3>📍 GPS meritev</h3>
    <p>
      <button type="button" id="samStart">▶️ Začni GPS</button>
      <button type="button" id="samStop" disabled>⏹️ Končaj segment</button>
    </p>
    <p id="samGpsStatus">Pripravljeno.</p>

    <h3>📐 Vrste del</h3>
    <p>Izberite več del za isti segment.</p>

    <label><input type="checkbox" class="samWork" value="kanal" checked> Kanal – m</label>
    <label><input type="checkbox" class="samWork" value="tlakovci"> Tlakovci – m²</label>
    <label><input type="checkbox" class="samWork" value="asfalt"> Asfalt – m²</label>
    <label><input type="checkbox" class="samWork" value="tampon"> Tampon – m³</label>

    <label>Dolžina (m)
      <input id="samLength" type="number" min="0" step="0.01">
    </label>

    <label>Širina (m)
      <input id="samWidth" type="number" min="0" step="0.01" value="0.60">
    </label>

    <label>Debelina (m)
      <input id="samDepth" type="number" min="0" step="0.01" value="0.30">
    </label>

    <p>
      <button type="button" id="samCalculate">🧮 Izračunaj</button>
      <button type="button" id="samCopy">📋 Kopiraj meritve</button>
    </p>

    <div id="samResults"></div>
    <p id="samMessage" role="status"></p>

    <small>
      GPS meri približno dolžino. Širino in debelino je treba
      preveriti na terenu. AI in LiDAR še nista aktivna.
      Meritve se še ne shranjujejo v Supabase.
    </small>
  `;

  const get = id => document.getElementById(id);
  let cameraStream = null;
  let gpsWatch = null;
  let previous = null;
  let previousTime = 0;
  let meters = 0;
  let points = 0;
  let lastResults = [];

  const message = text => {
    get('samMessage').textContent = text;
  };

  const gpsMessage = text => {
    get('samGpsStatus').textContent = text;
  };

  function number(id) {
    return Number(String(get(id).value).replace(',', '.'));
  }

  get('samCamera').onclick = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Kamera ni podprta v tem brskalniku.');
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      get('samVideo').srcObject = cameraStream;
      await get('samVideo').play();
      message('Kamera je odprta.');
    } catch (error) {
      message('Napaka kamere: ' + error.message);
    }
  };

  get('samPhoto').onclick = () => {
    const video = get('samVideo');
    if (!cameraStream || !video.videoWidth) {
      message('Najprej odprite kamero.');
      return;
    }

    const canvas = get('samCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/jpeg', 0.8);
    img.style.cssText =
      'width:100%;max-width:280px;margin:8px 0;border-radius:10px';
    get('samPhotos').prepend(img);
    message('Fotografija dodana v trenutni pregled.');
  };

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    get('samVideo').srcObject = null;
  }

  get('samClose').onclick = () => {
    closeCamera();
    message('Kamera zaprta.');
  };

  function radians(value) {
    return value * Math.PI / 180;
  }

  function distance(a, b) {
    const lat = radians(b.latitude - a.latitude);
    const lon = radians(b.longitude - a.longitude);
    const h =
      Math.sin(lat / 2) ** 2 +
      Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(lon / 2) ** 2;

    return 12742000 * Math.atan2(
      Math.sqrt(Math.max(0, h)),
      Math.sqrt(Math.max(0, 1 - h))
    );
  }

  get('samStart').onclick = () => {
    if (!navigator.geolocation) {
      gpsMessage('GPS ni na voljo.');
      return;
    }

    meters = 0;
    points = 0;
    previous = null;
    previousTime = 0;

    get('samStart').disabled = true;
    get('samStop').disabled = false;
    gpsMessage('Čakam GPS ... Hodite zunaj.');

    gpsWatch = navigator.geolocation.watchPosition(
      position => {
        const c = position.coords;
        const time = position.timestamp;

        if (c.accuracy > 20) {
          gpsMessage(
            'GPS premalo natančen: ±' +
            Math.round(c.accuracy) + ' m'
          );
          return;
        }

        if (previous) {
          const d = distance(previous, c);
          const dt = (time - previousTime) / 1000;

          if (dt > 0 && d >= 1 && d / dt <= 3.5) {
            meters += d;
            previous = c;
            previousTime = time;
            points++;
          }
        } else {
          previous = c;
          previousTime = time;
          points++;
        }

        gpsMessage(
          'GPS dolžina: ' + meters.toFixed(2) +
          ' m | natančnost ±' + Math.round(c.accuracy) + ' m'
        );
      },
      error => {
        gpsMessage('GPS napaka: ' + error.message);
        stopGps(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  };

  function stopGps(keepMeasurement) {
    if (gpsWatch !== null) {
      navigator.geolocation.clearWatch(gpsWatch);
      gpsWatch = null;
    }

    get('samStart').disabled = false;
    get('samStop').disabled = true;

    if (keepMeasurement) {
      if (points < 2 || meters <= 0) {
        gpsMessage('Premalo GPS točk. Poskusite zunaj.');
      } else {
        get('samLength').value = meters.toFixed(2);
        gpsMessage(
          'Segment: ' + meters.toFixed(2) +
          ' m. Preverite dolžino.'
        );
      }
    }
  }

  get('samStop').onclick = () => stopGps(true);

  get('samCalculate').onclick = () => {
    const length = number('samLength');
    const width = number('samWidth');
    const depth = number('samDepth');

    const selected = [...document.querySelectorAll('.samWork:checked')]
      .map(el => el.value);

    if (!selected.length) {
      message('Izberite vsaj eno vrsto dela.');
      return;
    }

    if (!Number.isFinite(length) || length <= 0) {
      message('Vnesite pravilno dolžino.');
      return;
    }

    if (
      selected.some(t => t !== 'kanal') &&
      (!Number.isFinite(width) || width <= 0)
    ) {
      message('Vnesite pravilno širino.');
      return;
    }

    if (
      selected.includes('tampon') &&
      (!Number.isFinite(depth) || depth <= 0)
    ) {
      message('Vnesite pravilno debelino.');
      return;
    }

    const labels = {
      kanal: 'Kanal',
      tlakovci: 'Tlakovci',
      asfalt: 'Asfalt',
      tampon: 'Tampon'
    };

    lastResults = selected.map(type => {
      let quantity;
      let unit;

      if (type === 'kanal') {
        quantity = length;
        unit = 'm';
      } else if (type === 'tampon') {
        quantity = length * width * depth;
        unit = 'm³';
      } else {
        quantity = length * width;
        unit = 'm²';
      }

      return {
        type: labels[type],
        quantity,
        unit
      };
    });

    get('samResults').replaceChildren();

    lastResults.forEach(item => {
      const p = document.createElement('p');
      p.textContent =
        item.type + ': ' +
        item.quantity.toFixed(2) + ' ' + item.unit;
      get('samResults').appendChild(p);
    });

    message('Izračunano. Preverite meritve pred obračunom.');
  };

  get('samCopy').onclick = async () => {
    if (!lastResults.length) {
      message('Najprej izračunajte meritve.');
      return;
    }

    const text = lastResults
      .map(x => x.type + ': ' + x.quantity.toFixed(2) + ' ' + x.unit)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      message('Meritve kopirane.');
    } catch {
      message(text);
    }
  };

  window.addEventListener('pagehide', () => {
    closeCamera();
    stopGps(false);
  });

  function mount() {
    const target =
      document.getElementById('izmereView') ||
      document.getElementById('sylajWalkScan');

    if (target && !target.contains(panel)) {
      target.appendChild(panel);
    }
  }

  mount();

  new MutationObserver(mount).observe(document.body, {
    childList: true,
    subtree: true
  });
})();
