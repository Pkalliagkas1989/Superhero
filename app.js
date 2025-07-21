// app.js — vanilla JS for fetch, state, render, URL sync
let heroes = [];
const state = {
  searchTerm: '',
  searchField: 'name',
  pageSize: 20,
  page: 1,
  sortField: 'name',
  sortDir: 'asc',
  selectedId: null
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
const getNested = (obj, path) =>
  path.split('.').reduce((o,p) => {
    if (!o) return null;
    const m = p.match(/(\w+)\[(\d+)\]/);
    if (m) return o[m[1]]?.[+m[2]];
    return o[p];
  }, obj) || 'unknown';

// Compare function that handles numeric strings like "180 cm"
const compare = (a,b) => {
  if (a == null) return 1;
  if (b == null) return -1;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.toString().localeCompare(b);
};

// Populate field‑selector dropdown
function renderControls() {
  const sf = document.getElementById('searchField');
  sf.innerHTML = fields.map(f =>
    `<option value="${f.key}">${f.label}</option>`
  ).join('');
  sf.value = state.searchField;
}

// Main render: filter, sort, paginate, then draw table & pagination
function renderTable() {
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

  // Header row with sort arrows
  const thead = document.getElementById('tableHead');
  thead.innerHTML = fields.map(f => {
    const arrow = f.key===state.sortField
      ? (state.sortDir==='asc' ? ' ↑' : ' ↓') : '';
    return `<th data-key="${f.key}">${f.label}${arrow}</th>`;
  }).join('');

  // Body rows
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = pageItems.map(h => {
    const cells = fields.map(f => {
      let v = getNested(h, f.key);
      if (f.key==='images.xs')
        v = `<img class="icon" src="${v}" />`;
      return `<td>${v}</td>`;
    }).join('');
    return `<tr data-id="${h.id}">${cells}</tr>`;
  }).join('');

  renderPagination(pages);
  bindTableEvents();
}

// Build page‑number buttons + prev/next
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
      syncURL(); renderTable();
    });
  });
}

// Attach clicks for sorting headers & opening detail overlay
function bindTableEvents() {
  document.querySelectorAll('th').forEach(th =>
    th.onclick = () => {
      const k = th.dataset.key;
      if (state.sortField===k)
        state.sortDir = state.sortDir==='asc'?'desc':'asc';
      else {
        state.sortField = k;
        state.sortDir = 'asc';
      }
      state.page = 1;
      syncURL(); renderTable();
    }
  );
  document.querySelectorAll('tbody tr').forEach(tr =>
    tr.onclick = () => openDetail(+tr.dataset.id)
  );
}

// Show overlay with large image + full JSON details
function openDetail(id) {
  const h = heroes.find(x=>x.id===id);
  if (!h) return;
  state.selectedId = id; syncURL();
  const c = document.getElementById('detailContent');
  c.innerHTML = `
    <h2>${h.name} (${h.id})</h2>
    <img src="${h.images.lg}" />
    <pre>${JSON.stringify(h, null, 2)}</pre>
  `;
  document.getElementById('overlay').style.display = 'flex';
}

// Close overlay
document.getElementById('closeBtn').onclick = () => {
  document.getElementById('overlay').style.display = 'none';
  state.selectedId = null; syncURL();
};
document.getElementById('overlay').onclick = e => {
  if (e.target.id==='overlay')
    document.getElementById('closeBtn').click();
};

// Keep all state in the URL query (q, field, size, page, sort, hero)
function syncURL() {
  const p = new URLSearchParams();
  if (state.searchTerm)   p.set('q', state.searchTerm);
  if (state.searchField)  p.set('field', state.searchField);
  if (state.pageSize)     p.set('size', state.pageSize);
  if (state.page)         p.set('page', state.page);
  if (state.sortField)    p.set('sort', `${state.sortField},${state.sortDir}`);
  if (state.selectedId)   p.set('hero', state.selectedId);
  history.replaceState(null,'',`?${p}`);
}

// On load, pull any values from URL
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
}

// Fetch data and initialize everything
fetch("https://rawcdn.githack.com/akabab/superhero-api/0.2.0/api/all.json")
  .then(r => r.json())
  .then(data => {
    heroes = data;
    loadFromURL();
    renderControls();
    document.getElementById('search').value = state.searchTerm;
    document.getElementById('search').addEventListener('input', e => {
      state.searchTerm = e.target.value;
      state.page = 1; syncURL(); renderTable();
    });
    document.getElementById('searchField').addEventListener('change', e => {
      state.searchField = e.target.value;
      state.page = 1; syncURL(); renderTable();
    });
    document.getElementById('pageSize').addEventListener('change', e => {
      state.pageSize = e.target.value==='all'?'all':+e.target.value;
      state.page = 1; syncURL(); renderTable();
    });
    renderTable();
    if (state.selectedId) openDetail(state.selectedId);
  });
