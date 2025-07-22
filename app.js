// app.js — vanilla JS for fetch, state, render, URL sync
'use strict';

// In-memory array of hero objects loaded from the API
let heroes = [];
let races = [], genders = [], eyeColors = [], hairColors = [];
const defaultState = {
  searchTerm: '',
  searchField: 'name',
  pageSize: 20,
  page: 1,
  sortField: 'name',
  sortDir: 'asc',
  alignment: '',
  selectedId: null,
  viewMode: 'list',
  race: '',
  gender: '',
  eyeColor: '',
  hairColor: ''
};
const state = { ...defaultState };

// Update the toggle button text based on current view
function updateViewButton() {
  const btn = document.getElementById('viewToggleBtn');
  if (btn)
    btn.textContent = state.viewMode === 'cards' ? 'Cards' : 'List';
}

// Which fields are available for searching/sorting
// Fields that can be used for sorting
const allFields = [
  { key: 'images.xs', label: 'Icon' },
  { key: 'name', label: 'Name' },
  { key: 'powerstats.intelligence', label: 'Int' },
  { key: 'powerstats.strength', label: 'Str' },
  { key: 'powerstats.speed', label: 'Spd' },
  { key: 'powerstats.durability', label: 'Dur' },
  { key: 'powerstats.power', label: 'Pow' },
  { key: 'powerstats.combat', label: 'Cmb' },
  { key: 'appearance.height[1]', label: 'Height' },
  { key: 'appearance.weight[1]', label: 'Weight' },
  { key: 'appearance.race', label: 'Race' },
  { key: 'appearance.eyeColor', label: 'Eyes' },
  { key: 'appearance.hairColor', label: 'Hair' },
  { key: 'biography.alignment', label: 'Align' },
  { key: 'work.occupation', label: 'Occupation' },
  { key: 'connections.groupAffiliation', label: 'Affiliation' }
];

// Fields used when rendering the table (powerstats grouped together)
const tableFields = [
  { key: 'images.xs', label: 'Icon' },
  { key: 'name', label: 'Name' },
  { key: 'powerstats', label: 'Powerstats' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'biography', label: 'Biography' },
  { key: 'connections.groupAffiliation', label: 'Affiliation' }
];

// Search options are derived from the visible table columns so the dropdown
// always mirrors the headers displayed in the list view. For the dropdown
// labels we use more descriptive text than the terse table headers so the
// options are clearer to users. Searching a column containing an object
// (e.g. "appearance" or "biography") will match any of the values shown in
// that column because the object is stringified when filtering.
const searchFields = tableFields.map(f => {
  const friendly = {
    Powerstats: 'Power Stats',
    Appearance: 'Appearance details',
    Biography: 'Biography / alignment',
    Affiliation: 'Group affiliation'
  }[f.label];
  return { ...f, label: friendly || f.label };
});

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
  if (typeof a === 'object') a = JSON.stringify(a);
  if (typeof b === 'object') b = JSON.stringify(b);
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.toString().localeCompare(b);
};

// Build lists of appearance options for the modal
function computeAppearanceOptions() {
  const r = new Set(), g = new Set(), e = new Set(), h = new Set();
  heroes.forEach(hero => {
    const a = hero.appearance;
    if (a.race && a.race !== '-') r.add(a.race);
    if (a.gender && a.gender !== '-') g.add(a.gender);
    if (a.eyeColor && a.eyeColor !== '-') e.add(a.eyeColor);
    if (a.hairColor && a.hairColor !== '-') h.add(a.hairColor);
  });
  races = Array.from(r).sort();
  genders = Array.from(g).sort();
  eyeColors = Array.from(e).sort();
  hairColors = Array.from(h).sort();
}

// Reset all filters and sorting to default state
function resetFilters() {
  Object.assign(state, defaultState);
  renderControls();
  document.getElementById('search').value = state.searchTerm;
  updateViewButton();
  state.page = 1;
  syncURL();
  renderCards();
}

// Populate field selector dropdown based on the available field list
function renderControls() {
  const sf = document.getElementById('searchField');
  sf.innerHTML = searchFields.map(f =>
    `<option value="${f.key}">${f.label}</option>`
  ).join('');
  sf.value = state.searchField;

  const sortF = document.getElementById('sortField');
  sortF.innerHTML = allFields.map(f =>
    `<option value="${f.key}">${f.label}</option>`
  ).join('');
  sortF.value = state.sortField;

  document.getElementById('sortDir').value = state.sortDir;
  document.getElementById('alignmentFilter').value = state.alignment;
  document.getElementById('viewMode').value = state.viewMode;
}

// Render card list with filtering, sorting and pagination
function renderCards() {
  let data = heroes.slice();

  if (state.alignment) {
    data = data.filter(h => h.biography.alignment === state.alignment);
  }

  if (state.gender) {
    data = data.filter(h => h.appearance.gender === state.gender);
  }
  if (state.race) {
    data = data.filter(h => h.appearance.race === state.race);
  }
  if (state.eyeColor) {
    data = data.filter(h => h.appearance.eyeColor === state.eyeColor);
  }
  if (state.hairColor) {
    data = data.filter(h => h.appearance.hairColor === state.hairColor);
  }

  // Filter by search term in chosen field
  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    data = data.filter(h => {
      const raw = getNested(h, state.searchField);
      const v = (typeof raw === 'object' ? JSON.stringify(raw) : raw)
                  .toString().toLowerCase();
      return v.includes(term);
    });

    // Sort so items starting with the term appear first
    data.sort((a,b) => {
      const aRaw = getNested(a, state.searchField);
      const bRaw = getNested(b, state.searchField);
      const vaSearch = (typeof aRaw === 'object' ? JSON.stringify(aRaw) : aRaw)
                        .toString().toLowerCase();
      const vbSearch = (typeof bRaw === 'object' ? JSON.stringify(bRaw) : bRaw)
                        .toString().toLowerCase();
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
    const header = tableFields.map(f => {
      const sortable = !['images.xs','connections.groupAffiliation'].includes(f.key);
      const arrow = (f.key === 'powerstats' && state.sortField.startsWith('powerstats.')) ||
                    (f.key === 'appearance' && state.sortField.startsWith('appearance.')) ||
                    (f.key === 'biography' && (state.sortField.startsWith('biography.') || state.sortField === 'work.occupation')) ||
                    state.sortField === f.key ?
        (state.sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
      const attr = sortable ? ` data-sort="${f.key}"` : '';
      return `<th${attr}>${f.label}${arrow}</th>`;
    }).join('');
    const rows = pageItems.map(h => {
      const cells = tableFields.map(f => {
        if (f.key === 'powerstats') {
          const ps = h.powerstats;
          const display = `Int:${ps.intelligence} Str:${ps.strength} Spd:${ps.speed} Dur:${ps.durability} Pow:${ps.power} Cmb:${ps.combat}`;
          return `<td>${display}</td>`;
        }
        if (f.key === 'appearance') {
          const a = h.appearance;
          const display = `Race:${a.race} Gender:${a.gender} Height:${a.height?.[1]} Weight:${a.weight?.[1]} Eyes:${a.eyeColor} Hair:${a.hairColor}`;
          return `<td>${display}</td>`;
        }
        if (f.key === 'biography') {
          const display = `Align:${h.biography.alignment} Occ:${h.work.occupation}`;
          return `<td>${display}</td>`;
        }
        const val = getNested(h, f.key);
        if (f.key === 'images.xs')
          return `<td><img src="${val}" alt="${h.name}" /></td>`;
        const display = Array.isArray(val) ? val.join(', ') : (val ?? '');
        return `<td>${display}</td>`;
      }).join('');
      return `<tr data-id="${h.id}">${cells}</tr>`;
    }).join('');
    cardsEl.innerHTML = `<table class="list-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  } else {
    cardsEl.innerHTML = pageItems.map(h => `
      <div class="card" data-id="${h.id}">
        <img src="${h.images.lg}" alt="${h.name}" />
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
          <li>Eyes: ${h.appearance.eyeColor}</li>
          <li>Hair: ${h.appearance.hairColor}</li>
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
  document.querySelectorAll('.list-table th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.onclick = () => {
      const key = th.dataset.sort;
      if (key === 'powerstats') {
        openSortModal();
        return;
      }
      if (key === 'appearance') {
        openAppearanceModal();
        return;
      }
      if (key === 'biography') {
        openBiographyModal();
        return;
      }
      if (state.sortField === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = key;
        state.sortDir = 'asc';
      }
      document.getElementById('sortField').value = state.sortField;
      document.getElementById('sortDir').value = state.sortDir;
      state.page = 1;
      syncURL();
      renderCards();
    };
  });
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
    <p><strong>Eye Color:</strong> ${h.appearance.eyeColor}</p>
    <p><strong>Hair Color:</strong> ${h.appearance.hairColor}</p>
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

// Modal for choosing how to sort the powerstats column
function openSortModal() {
  document.getElementById('statSelect').value = state.sortField.startsWith('powerstats.')
    ? state.sortField.split('.')[1] : 'intelligence';
  document.getElementById('statOrder').value = state.sortDir;
  document.getElementById('sortModal').style.display = 'flex';
}
document.getElementById('sortCancel').onclick = () => {
  document.getElementById('sortModal').style.display = 'none';
};
document.getElementById('sortConfirm').onclick = () => {
  const stat = document.getElementById('statSelect').value;
  const order = document.getElementById('statOrder').value;
  state.sortField = `powerstats.${stat}`;
  state.sortDir = order;
  document.getElementById('sortField').value = state.sortField;
  document.getElementById('sortDir').value = state.sortDir;
  document.getElementById('sortModal').style.display = 'none';
  state.page = 1;
  syncURL();
  renderCards();
};
document.getElementById('sortDefault').onclick = () => {
  document.getElementById('sortModal').style.display = 'none';
  resetFilters();
};
document.getElementById('sortModal').onclick = e => {
  if (e.target.id==='sortModal')
    document.getElementById('sortCancel').click();
};

// Modal for filtering appearance and sorting height/weight
function openAppearanceModal() {
  const raceSel = document.getElementById('raceSelect');
  raceSel.innerHTML = '<option value="">Any</option>' +
    races.map(r=>`<option value="${r}">${r}</option>`).join('');
  raceSel.value = state.race;

  const genderSel = document.getElementById('genderSelect');
  genderSel.innerHTML = '<option value="">Any</option>' +
    genders.map(g=>`<option value="${g}">${g}</option>`).join('');
  genderSel.value = state.gender;

  const eyeSel = document.getElementById('eyeSelect');
  eyeSel.innerHTML = '<option value="">Any</option>' +
    eyeColors.map(e=>`<option value="${e}">${e}</option>`).join('');
  eyeSel.value = state.eyeColor;

  const hairSel = document.getElementById('hairSelect');
  hairSel.innerHTML = '<option value="">Any</option>' +
    hairColors.map(h=>`<option value="${h}">${h}</option>`).join('');
  hairSel.value = state.hairColor;

  const sortFieldSel = document.getElementById('appearanceSortField');
  sortFieldSel.value = state.sortField === 'appearance.weight[1]' ? 'weight'
                    : state.sortField === 'appearance.height[1]' ? 'height'
                    : '';
  document.getElementById('appearanceSortDir').value = state.sortDir;
  document.getElementById('appearanceModal').style.display = 'flex';
}
document.getElementById('appearanceCancel').onclick = () => {
  document.getElementById('appearanceModal').style.display = 'none';
};
document.getElementById('appearanceConfirm').onclick = () => {
  state.race = document.getElementById('raceSelect').value;
  state.gender = document.getElementById('genderSelect').value;
  state.eyeColor = document.getElementById('eyeSelect').value;
  state.hairColor = document.getElementById('hairSelect').value;
  const sf = document.getElementById('appearanceSortField').value;
  state.sortField = sf ? `appearance.${sf}[1]` : state.sortField;
  state.sortDir = document.getElementById('appearanceSortDir').value;
  document.getElementById('sortField').value = state.sortField;
  document.getElementById('sortDir').value = state.sortDir;
  document.getElementById('appearanceModal').style.display = 'none';
  state.page = 1;
  syncURL();
  renderCards();
};
document.getElementById('appearanceDefault').onclick = () => {
  document.getElementById('appearanceModal').style.display = 'none';
  resetFilters();
};
document.getElementById('appearanceModal').onclick = e => {
  if (e.target.id==='appearanceModal')
    document.getElementById('appearanceCancel').click();
};

// Modal for filtering alignment only
function openBiographyModal() {
  document.getElementById("alignmentSelect").value = state.alignment;
  document.getElementById("biographyModal").style.display = "flex";
}
document.getElementById('biographyCancel').onclick = () => {
  document.getElementById('biographyModal').style.display = 'none';
};
document.getElementById('biographyConfirm').onclick = () => {
  state.alignment = document.getElementById('alignmentSelect').value;
  document.getElementById("alignmentFilter").value = state.alignment;
  document.getElementById("biographyModal").style.display = "none";
  state.page = 1;
  syncURL();
  renderCards();
};
document.getElementById('biographyDefault').onclick = () => {
  document.getElementById('biographyModal').style.display = 'none';
  resetFilters();
};
document.getElementById('biographyModal').onclick = e => {
  if (e.target.id==='biographyModal')
    document.getElementById('biographyCancel').click();
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
  if (state.alignment)    p.set('align', state.alignment);
  if (state.race)        p.set('race', state.race);
  if (state.gender)      p.set('gender', state.gender);
  if (state.eyeColor)    p.set('eye', state.eyeColor);
  if (state.hairColor)   p.set('hair', state.hairColor);
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
  if (p.get('align'))
    state.alignment = p.get('align');
  if (p.get('race'))
    state.race = p.get('race');
  if (p.get('gender'))
    state.gender = p.get('gender');
  if (p.get('eye'))
    state.eyeColor = p.get('eye');
  if (p.get('hair'))
    state.hairColor = p.get('hair');
  if (p.get('view'))
    state.viewMode = p.get('view');
}

// Fetch data and initialize everything
async function init() {
  const res = await fetch(
    "https://rawcdn.githack.com/akabab/superhero-api/0.2.0/api/all.json"
  );
  const rawHeroes = await res.json();
  heroes = rawHeroes.filter(h => {
    const a = h.biography?.alignment?.toLowerCase();
    return ['good', 'bad', 'neutral'].includes(a);
  });
  computeAppearanceOptions();
  loadFromURL();
  renderControls();
  document.getElementById('search').value = state.searchTerm;
  document.getElementById('viewMode').value = state.viewMode;
  document.getElementById('alignmentFilter').value = state.alignment;
  updateViewButton();
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
  document.getElementById('alignmentFilter').addEventListener('change', e => {
    state.alignment = e.target.value;
    state.page = 1; syncURL(); renderCards();
  });
  document.getElementById('viewMode').addEventListener('change', e => {
    state.viewMode = e.target.value;
    state.page = 1; syncURL(); renderCards();
    updateViewButton();
  });
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('menu').classList.toggle('show');
  });
  document.getElementById('viewToggleBtn').addEventListener('click', () => {
    state.viewMode = state.viewMode === 'cards' ? 'list' : 'cards';
    document.getElementById('viewMode').value = state.viewMode;
    state.page = 1; syncURL(); renderCards();
    updateViewButton();
  });
  renderCards();
  if (state.selectedId) openDetail(state.selectedId);
}

// kick everything off
init();
