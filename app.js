// app.js — vanilla JS for fetch, state, render, URL sync
'use strict';

// In-memory array of hero objects loaded from the API
let heroes = [];
const state = {
  searchTerm: '',
  searchField: 'name',
  pageSize: 20,
  page: 1,
  sortField: 'name',
  sortDir: 'asc',
  selectedId: null,
  viewMode: 'cards'
};

// Which fields show in table (use metric units by default)
const fields = [
  { key: 'images.xs',            label: 'Icon' },
  { key: 'name',                 label: 'Name' },
  { key: 'biography.fullName',   label: 'Full Name' },
  { key: 'powerstats.intelligence', label: 'Intelligence' },
  { key: 'powerstats.strength',     label: 'Strength' },
  { key: 'powerstats.speed',        label: 'Speed' },
  { key: 'powerstats.durability',   label: 'Durability' },
  { key: 'powerstats.power',        label: 'Power' },
  { key: 'powerstats.combat',       label: 'Combat' },
  { key: 'appearance.race',       label: 'Race' },
  { key: 'appearance.gender',     label: 'Gender' },
  { key: 'appearance.height[1]',  label: 'Height' },
  { key: 'appearance.weight[1]',  label: 'Weight' },
  { key: 'biography.placeOfBirth', label: 'Birthplace' },
  { key: 'biography.alignment',    label: 'Alignment' }
];

// Helper to safely drill into nested props (with array index)
// rewritten recursively for clarity
const getNested = (obj, path) => {
  if (obj == null) return 'unknown';
  const [part, ...rest] = Array.isArray(path) ? path : path.split('.');
  const match = part.match(/(\w+)\[(\d+)\]/);
  const next = match ? obj[match[1]]?.[+match[2]] : obj[part];
  return rest.length ? getNested(next, rest) : (next ?? 'unknown');
};

// Compare function that handles numeric strings like "180 cm"
const compare = (a,b) => {
  if (a == null) return 1;
  if (b == null) return -1;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.toString().localeCompare(b);
};

// Populate field selector dropdown based on the available field list
function renderControls() {
  const sf = document.getElementById('searchField');
  sf.innerHTML = fields.map(f =>
    `<option value="${f.key}">${f.label}</option>`
  ).join('');
  sf.value = state.searchField;

  const sortF = document.getElementById('sortField');
  sortF.innerHTML = fields.map(f =>
    `<option value="${f.key}">${f.label}</option>`
  ).join('');
  sortF.value = state.sortField;

  document.getElementById('sortDir').value = state.sortDir;
  document.getElementById('viewMode').value = state.viewMode;
}

// Render card list with filtering, sorting and pagination
function renderCards() {
  let data = heroes.slice();

  // Filter by search term in chosen field
  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    data = data.filter(h => {
      const v = getNested(h, state.searchField).toString().toLowerCase();
      return v.includes(term);
    });

    // Sort so items starting with the term appear first
    data.sort((a,b) => {
      const vaSearch = getNested(a, state.searchField).toString().toLowerCase();
      const vbSearch = getNested(b, state.searchField).toString().toLowerCase();
      const startsA = vaSearch.startsWith(term);
      const startsB = vbSearch.startsWith(term);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;
      const va = getNested(a, state.sortField);
      const vb = getNested(b, state.sortField);
      const res = compare(va, vb);
      return state.sortDir==='asc' ? res : -res;
    });
  } else {
    // Sort by field & direction
    data.sort((a,b) => {
      const va = getNested(a, state.sortField);
      const vb = getNested(b, state.sortField);
      const res = compare(va, vb);
      return state.sortDir==='asc' ? res : -res;
    });
  }

  // Pagination logic
  const total = data.length;
  const size = state.pageSize==='all' ? total : state.pageSize;
  const pages = state.pageSize==='all' ? 1 : Math.ceil(total/size);
  state.page = Math.min(state.page, pages) || 1;
  const start = (state.page-1)*size;
  const pageItems = data.slice(start, start+size);

  const cardsEl = document.getElementById('cards');
  if (state.viewMode === 'list') {
    const header = fields.map(f => `<th>${f.label}</th>`).join('');
    const rows = pageItems.map(h => {
      const cells = fields.map(f => {
        const val = getNested(h, f.key);
        if (f.key === 'images.xs')
          return `<td><img src="${val}" alt="${h.name}" /></td>`;
        return `<td>${val}</td>`;
      }).join('');
      return `<tr data-id="${h.id}">${cells}</tr>`;
    }).join('');
    cardsEl.innerHTML = `<table class="list-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  } else {
    cardsEl.innerHTML = pageItems.map(h => `
      <div class="card" data-id="${h.id}">
        <img src="${h.images.sm}" alt="${h.name}" />
        <h2>${h.name}</h2>
        <p><strong>Alias:</strong> ${h.biography.aliases?.[0] || h.name}</p>
        <p><strong>Full Name:</strong> ${h.biography.fullName || 'Unknown'}</p>
        <h3>Power Stats</h3>
        <ul>
          <li>Intelligence: ${h.powerstats.intelligence}</li>
          <li>Strength: ${h.powerstats.strength}</li>
          <li>Speed: ${h.powerstats.speed}</li>
          <li>Durability: ${h.powerstats.durability}</li>
          <li>Power: ${h.powerstats.power}</li>
          <li>Combat: ${h.powerstats.combat}</li>
        </ul>
        <h3>Appearance</h3>
        <ul>
          <li>Race: ${h.appearance.race}</li>
          <li>Gender: ${h.appearance.gender}</li>
          <li>Height: ${h.appearance.height?.[1]}</li>
          <li>Weight: ${h.appearance.weight?.[1]}</li>
        </ul>
        <h3>Biography</h3>
        <p>Place of Birth: ${h.biography.placeOfBirth}</p>
        <p>Alignment: ${h.biography.alignment}</p>
      </div>
    `).join('');
  }

  renderPagination(pages);
  bindCardEvents();
}

// Build pagination buttons (prev/next and individual pages)
function renderPagination(pages) {
  const el = document.getElementById('pagination');
  let html = `<button ${state.page===1?'disabled':''} data-dir="prev">&lt;</button>`;
  for (let i=1; i<=pages; i++) {
    html += `<button data-page="${i}" ${i===state.page?'style="font-weight:bold"':''}>${i}</button>`;
  }
  html += `<button ${state.page===pages?'disabled':''} data-dir="next">&gt;</button>`;
  el.innerHTML = html;
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.page;
      if (p) state.page = +p;
      else if (btn.dataset.dir==='prev') state.page--;
      else state.page++;
      syncURL(); renderCards();
    });
  });
}

// Attach click handlers for sorting table headers and selecting rows
function bindCardEvents() {
  document.querySelectorAll('.card, tr[data-id]').forEach(el =>
    el.onclick = () => openDetail(+el.dataset.id)
  );
}

// Show overlay with a larger image and selected hero details
function openDetail(id) {
  const h = heroes.find(x=>x.id===id);
  if (!h) return;
  state.selectedId = id; syncURL();
  const c = document.getElementById('detailContent');
  c.innerHTML = `
    <h2>${h.name}</h2>
    <img src="${h.images.lg}" />
    <p><strong>Full Name:</strong> ${h.biography.fullName || 'Unknown'}</p>
    <p><strong>Race:</strong> ${h.appearance.race}</p>
    <p><strong>Gender:</strong> ${h.appearance.gender}</p>
    <p><strong>Height:</strong> ${h.appearance.height[1]}</p>
    <p><strong>Weight:</strong> ${h.appearance.weight[1]}</p>
    <h3>Power Stats</h3>
    <div class="stats">
      <div><strong>Intelligence:</strong> ${h.powerstats.intelligence}</div>
      <div><strong>Strength:</strong> ${h.powerstats.strength}</div>
      <div><strong>Speed:</strong> ${h.powerstats.speed}</div>
      <div><strong>Durability:</strong> ${h.powerstats.durability}</div>
      <div><strong>Power:</strong> ${h.powerstats.power}</div>
      <div><strong>Combat:</strong> ${h.powerstats.combat}</div>
    </div>
  `;
  document.getElementById('overlay').style.display = 'flex';
}

// Close overlay when the X is clicked and reset selected hero
document.getElementById('closeBtn').onclick = () => {
  document.getElementById('overlay').style.display = 'none';
  state.selectedId = null; syncURL();
};
// Clicking outside the detail box also closes the overlay
document.getElementById('overlay').onclick = e => {
  if (e.target.id==='overlay')
    document.getElementById('closeBtn').click();
};

// Update browser URL so the current state can be bookmarked or shared
function syncURL() {
  const p = new URLSearchParams();
  if (state.searchTerm)   p.set('q', state.searchTerm);
  if (state.searchField)  p.set('field', state.searchField);
  if (state.pageSize)     p.set('size', state.pageSize);
  if (state.page)         p.set('page', state.page);
  if (state.sortField)    p.set('sort', `${state.sortField},${state.sortDir}`);
  if (state.selectedId)   p.set('hero', state.selectedId);
  if (state.viewMode && state.viewMode !== 'cards')
    p.set('view', state.viewMode);
  history.replaceState(null,'',`?${p}`);
}

// On load, pull any values from URL
// Restore state from the URL query parameters on initial load
function loadFromURL() {
  const p = new URLSearchParams(location.search);
  if (p.get('q'))      state.searchTerm = p.get('q');
  if (p.get('field'))  state.searchField = p.get('field');
  if (p.get('size'))
    state.pageSize = p.get('size')==='all'?'all':+p.get('size');
  if (p.get('page'))
    state.page = +p.get('page');
  if (p.get('sort')) {
    const [f,d] = p.get('sort').split(',');
    state.sortField = f; state.sortDir = d;
  }
  if (p.get('hero'))
    state.selectedId = +p.get('hero');
  if (p.get('view'))
    state.viewMode = p.get('view');
}

// Fetch data and initialize everything
async function init() {
  const res = await fetch(
    "https://rawcdn.githack.com/akabab/superhero-api/0.2.0/api/all.json"
  );
  heroes = await res.json();
  loadFromURL();
  renderControls();
  document.getElementById('search').value = state.searchTerm;
  document.getElementById('viewMode').value = state.viewMode;
  document.getElementById('search').addEventListener('input', e => {
    state.searchTerm = e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('searchField').addEventListener('change', e => {
    state.searchField = e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('pageSize').addEventListener('change', e => {
    state.pageSize = e.target.value==='all'?'all':+e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('sortField').addEventListener('change', e => {
    state.sortField = e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('sortDir').addEventListener('change', e => {
    state.sortDir = e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('viewMode').addEventListener('change', e => {
    state.viewMode = e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('menu').classList.toggle('show');
  });
  renderCards();
  if (state.selectedId) openDetail(state.selectedId);
}

// kick everything off
init();
