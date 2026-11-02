/* SYLAJ - Kamera dhe matjet */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  if ($('walkScanPanel')) return;

  const panel = document.createElement('div');
  panel.id = 'walkScanPanel';
  panel.innerHTML = `
    <hr>
    <h2>📷 SYLAJ – Walk Scan</h2>
    <p>En skeniran segment – več vrst del.</p>

    <button type="button" id="wsOpen">
      📷 Odpri kamero
    </button>
    <button type="button" id="wsPhoto">
      📸 Fotografiraj
    </button>
    <button type="button" id="wsClose">
      ⏹️ Zapri kamero
    </button>

    <video id="wsVideo" autoplay playsinline
      muted style="display:none;width:100%"></video>

    <label>📁 Dodaj fotografijo
      <input id="wsFile" type="file"
        accept="image/*" multiple>
    </label>
    <div id="wsPictures"></div>

    <h3>📐 Dodaj postavko</h3>

    <label>Vrsta dela
      <select id="wsType">
        <option value="kanal">📏 Kanal</option>
        <option value="tlakovci">🧱 Tlakovci</option>
        <option value="asfalt">🛣️ Asfalt</option>
        <option value="tampon">🪨 Tampon</option>
      </select>
    </label>

    <label>Dolžina (m)
      <input id="wsLength" type="number"
        min="0" step="any">
    </label>

    <label>Širina (m)
      <input id="wsWidth" type="number"
        min="0" step="any">
    </label>

    <label>Debelina (m)
      <input id="wsDepth" type="number"
        min="0" step="any">
    </label>

    <button type="button" id="wsAdd">
      ➕ Dodaj postavko
    </button>

    <div id="wsList"></div>

    <button type="button" id="wsSave">
      💾 Shrani izmere
    </button>

    <p id="wsStatus" role="status"></p>
    <small>
      Dimenzije je treba preveriti na terenu.
      AI in LiDAR še nista aktivna.
      Fotografije se še ne shranjujejo v Supabase.
    </small>
  `;

  let stream = null;
  let photos = [];
  let items = [];

  function message(s) {
    $('wsStatus').textContent = s;
  }

  function mount() {
    const view = $('izmereView');
    if (view && !view.contains(panel)) {
      view.appendChild(panel);
    }
  }

  mount();

  const observer = new MutationObserver(mount);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  function render() {
    const list = $('wsList');
    list.replaceChildren();

    items.forEach((item, i) => {
      const line = document.createElement('p');
      line.textContent =
        item.vrsta + ': ' +
        item.kolicina.toLocaleString('sl-SI') +
        ' ' + item.enota + ' ';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '🗑️';
      remove.onclick = () => {
        items.splice(i, 1);
        render();
      };

      line.append(remove);
      list.append(line);
    });
  }

  function addPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const url = URL.createObjectURL(file);
    photos.push({file, url});

    const img = document.createElement('img');
    img.src = url;
    img.style.cssText =
      'width:100px;height:90px;object-fit:cover;margin:5px';
    $('wsPictures').append(img);
  }

  $('wsFile').onchange = e => {
    Array.from(e.target.files || []).forEach(addPhoto);
    e.target.value = '';
  };

  $('wsOpen').onclick = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Error('Kamera ni na voljo.');
      }

      stream?.getTracks().forEach(t => t.stop());

      stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal:'environment'}},
        audio: false
      });

      const video = $('wsVideo');
      video.srcObject = stream;
      video.style.display = 'block';
      await video.play();

      message('✅ Kamera je odprta.');
    } catch (e) {
      message('Napaka kamere: ' + e.message);
    }
  };

  $('wsPhoto').onclick = () => {
    const video = $('wsVideo');

    if (!stream || !video.videoWidth) {
      message('Najprej odprite kamero.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext('2d').drawImage(
      video, 0, 0
    );

    canvas.toBlob(blob => {
      if (!blob) return;

      addPhoto(new File(
        [blob],
        'sylaj-' + Date.now() + '.jpg',
        {type:'image/jpeg'}
      ));

      message('📸 Fotografija dodana.');
    }, 'image/jpeg', 0.85);
  };

  $('wsClose').onclick = () => {
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    $('wsVideo').srcObject = null;
    $('wsVideo').style.display = 'none';
    message('Kamera zaprta.');
  };

  $('wsAdd').onclick = () => {
    const type = $('wsType').value;
    const l = Number($('wsLength').value);
    const w = Number($('wsWidth').value);
    const d = Number($('wsDepth').value);

    if (!$('wsLength').value || l <= 0 ||
        !Number.isFinite(l)) {
      message('Vnesite dolžino.');
      return;
    }

    if (type !== 'kanal' &&
        (!$('wsWidth').value || w <= 0 ||
         !Number.isFinite(w))) {
      message('Vnesite širino.');
      return;
    }

    if (type === 'tampon' &&
        (!$('wsDepth').value || d <= 0 ||
         !Number.isFinite(d))) {
      message('Vnesite debelino.');
      return;
    }

    const unit =
      type === 'kanal' ? 'm' :
      type === 'tampon' ? 'm3' : 'm2';

    const q =
      type === 'kanal' ? l :
      type === 'tampon' ? l*w*d : l*w;

    items.push({
      vrsta: type,
      dolzina: l,
      sirina: type === 'kanal' ? null : w,
      debelina: type === 'tampon' ? d : null,
      kolicina: Math.round(q*1000)/1000,
      enota: unit
    });

    render();
    message('✅ Postavka dodana.');
  };

  $('wsSave').onclick = async () => {
    const button = $('wsSave');

    try {
      if (!items.length) {
        throw Error('Dodajte vsaj eno postavko.');
      }

      if (!user || !db) {
        throw Error('Prijava ni aktivna.');
      }

      const site = $('izSite')?.value;
      const team = $('izTeam')?.value;
      const day = $('izDate')?.value;
      const segment = Number($('izSegment')?.value);

      if (!site || !team || !day ||
          !Number.isSafeInteger(segment) ||
          segment < 1) {
        throw Error(
          'Izberite gradbišče, ekipo, datum in segment.'
        );
      }

      if (!teams.some(t =>
        String(t.id) === String(team)
      )) {
        throw Error('Ekipa ni dovoljena.');
      }

      button.disabled = true;
      const scanId = crypto.randomUUID();

      const rows = items.map(item => ({
        ...item,
        gradbisce_id: Number(site),
        ekipa_id: Number(team),
        datum: day,
        segment_nr: segment,
        skanim_id: scanId,
        vnesel_id: user.id,
        nacin: 'rocno',
        burimi_matjes: 'rocno',
        opomba: $('izNote')?.value || null
      }));

      const {error} = await db
        .from('izmere')
        .insert(rows);

      if (error) throw error;

      items = [];
      render();

      message(
        '✅ Izmere shranjene v Supabase. ' +
        'Fotografije še niso shranjene na strežnik.'
      );

    } catch (e) {
      message('Napaka: ' + e.message);
    } finally {
      button.disabled = false;
    }
  };

  window.addEventListener('pagehide', () => {
    stream?.getTracks().forEach(t => t.stop());
    photos.forEach(p => URL.revokeObjectURL(p.url));
  });
})();
