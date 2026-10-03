'use strict';
(() => {
  const workspace = document.querySelector('#demo-workspace');
  if (!workspace) return;
  const section = document.createElement('section');
  section.id = 'spotify-panel'; section.className = 'spotify-panel'; section.hidden = true;
  section.innerHTML = '<div class="spotify-head"><div><span class="spotify-kicker">SPOTIFY METADATA</span><h2>Compare with Spotify</h2><p>ค้นหา Album และ Track metadata เพื่อช่วยตรวจเทียบกับไฟล์ของคุณ</p></div><div class="spotify-actions"><button id="spotify-connect" type="button">Connect Spotify</button><button id="spotify-disconnect" type="button" hidden>Disconnect</button></div></div><div id="spotify-message" class="spotify-message"></div><form id="spotify-search-form" class="spotify-search" hidden><input id="spotify-query" type="search" maxlength="200" placeholder="Album หรือ Artist" aria-label="Search Spotify album"><button type="submit">Search Album</button></form><div id="spotify-results" class="spotify-results"></div>';
  workspace.appendChild(section);
  const connect = section.querySelector('#spotify-connect'), disconnect = section.querySelector('#spotify-disconnect');
  const form = section.querySelector('#spotify-search-form'), query = section.querySelector('#spotify-query');
  const message = section.querySelector('#spotify-message'), results = section.querySelector('#spotify-results');
  async function request(route, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.method && options.method !== 'GET' && window.demoAuth?.csrf) headers.set('X-CSRF-Token', window.demoAuth.csrf);
    const response = await fetch('/api' + route, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Spotify request failed'); return data;
  }
  function renderStatus(data) {
    section.hidden = false; connect.hidden = data.connected; disconnect.hidden = !data.connected; form.hidden = !data.connected;
    message.textContent = !data.configured ? 'Spotify module พร้อมแล้ว · รอ Client ID / Client Secret บนเครื่อง Server' : data.connected ? 'Spotify connected · พร้อมค้นหา Album metadata' : 'พร้อมเชื่อมต่อ Spotify';
  }
  async function refresh() {
    if (!window.demoAuth || window.demoAuth.user?.mustChange) { section.hidden = true; results.replaceChildren(); return; }
    try { renderStatus(await request('/spotify/status')); } catch { section.hidden = true; }
  }
  connect.addEventListener('click', async () => { try { const data = await request('/spotify/connect'); location.href = data.url; } catch (e) { message.textContent = e.message; } });
  disconnect.addEventListener('click', async () => { try { await request('/spotify/disconnect', { method: 'POST' }); results.replaceChildren(); await refresh(); } catch (e) { message.textContent = e.message; } });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const q = query.value.trim(); if (!q) return; message.textContent = 'กำลังค้นหา Spotify…'; results.replaceChildren();
    try {
      const data = await request('/spotify/search?q=' + encodeURIComponent(q));
      message.textContent = data.items.length ? data.items.length + ' album(s) found' : 'ไม่พบ Album';
      data.items.forEach(album => {
        const card = document.createElement('article'); card.className = 'spotify-album';
        const img = document.createElement('img'); img.src = album.image; img.alt = ''; img.loading = 'lazy';
        const info = document.createElement('div'), title = document.createElement('strong'), meta = document.createElement('span'), actions = document.createElement('div');
        title.textContent = album.name; meta.textContent = album.artists.join(', ') + ' · ' + album.totalTracks + ' tracks';
        const view = document.createElement('button'); view.type = 'button'; view.textContent = 'Track List';
        const open = document.createElement('a'); open.href = album.url; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Open in Spotify';
        view.addEventListener('click', () => loadAlbum(album.id, card)); actions.append(view, open); info.append(title, meta, actions); card.append(img, info); results.append(card);
      });
    } catch (err) { message.textContent = err.message; }
  });
  async function loadAlbum(id, card) {
    try {
      const data = await request('/spotify/album/' + encodeURIComponent(id)); let list = card.querySelector('.spotify-tracks');
      if (!list) { list = document.createElement('ol'); list.className = 'spotify-tracks'; card.append(list); }
      list.replaceChildren(); data.tracks.forEach(track => { const li = document.createElement('li'), a = document.createElement('a'); a.href = track.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = track.name; const d = document.createElement('span'); d.textContent = Math.floor(track.durationMs / 60000) + ':' + String(Math.floor(track.durationMs / 1000) % 60).padStart(2, '0'); li.append(a, d); list.append(li); });
    } catch (err) { message.textContent = err.message; }
  }
  window.addEventListener('demo-auth-changed', refresh);
  const state = new URLSearchParams(location.search).get('spotify');
  if (state) { history.replaceState({}, '', location.pathname); message.textContent = state === 'connected' ? 'Spotify connected' : 'Spotify connection: ' + state; }
  refresh();
})();