const statusEl = document.getElementById('status');
const appEl = document.getElementById('app');

let DATA = null;

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeTabFromHash() {
  const hash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  if (!hash) return 'red';
  if (hash === 'red' || hash === 'white' || hash === 'sparkling') return hash;
  return 'red';
}

function updateActiveTabUI(activeTabId) {
  document.querySelectorAll('.tab').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === activeTabId);
  });
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '';
  if (typeof price === 'string') return price.trim().toLowerCase() === 'mp' ? 'MP' : price;
  if (typeof price === 'number') return `$${price}`;
  return String(price);
}

function binSort(a, b) {
  // Sort by numeric bin when possible; otherwise fallback to string compare
  const an = Number(a.bin);
  const bn = Number(b.bin);

  const aIsNum = Number.isFinite(an);
  const bIsNum = Number.isFinite(bn);

  if (aIsNum && bIsNum) return an - bn;
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  return String(a.bin).localeCompare(String(b.bin));
}

function renderTable(wines, options = {}) {
  const { showHeader = true } = options;

  const table = document.createElement('div');
  table.className = 'table';

  if (showHeader) {
    const header = document.createElement('div');
    header.className = 'row header-row';
    header.innerHTML = `
      <div class="row-grid">
        <div class="cell bin">Bin</div>
        <div class="cell name">Name</div>
        <div class="cell vintage">Vintage</div>
        <div class="cell price">Price</div>
      </div>
    `;
    table.appendChild(header);
  }

  wines.forEach(w => {
    const row = document.createElement('div');
    row.className = 'row clickable';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-expanded', 'false');

    const isStaffPick = !!w.staffPick;
    const star = isStaffPick ? `<span class="star">*</span>` : '';

    const bin = escapeHtml(w.bin);
    const name = escapeHtml(w.name);
    const vintage = escapeHtml(w.vintage || '');
    const price = escapeHtml(formatPrice(w.price));

    row.innerHTML = `
      <div class="row-grid">
        <div class="cell bin">${bin}</div>
        <div class="cell name">${star}${name}</div>
        <div class="cell vintage">${vintage}</div>
        <div class="cell price">${price}</div>
      </div>
      <div class="drawer" hidden>
        <p>${escapeHtml(w.note || '')}</p>
        <div class="meta">
          ${escapeHtml([w.region, w.grapes].filter(Boolean).join(' · '))}
        </div>
      </div>
    `;

    const drawer = row.querySelector('.drawer');

    function toggle() {
      const open = drawer.hasAttribute('hidden') === false;
      if (open) {
        drawer.setAttribute('hidden', '');
        row.setAttribute('aria-expanded', 'false');
      } else {
        drawer.removeAttribute('hidden');
        row.setAttribute('aria-expanded', 'true');
      }
    }

    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    table.appendChild(row);
  });

  return table;
}

function renderTab(tabId) {
  if (!DATA) return;

  const tabConfig = DATA.tabs.find(t => t.id === tabId);
  if (!tabConfig) return;

  updateActiveTabUI(tabId);
  appEl.innerHTML = '';

  // Staff Picks (auto)
  const staffPicks = DATA.wines
    .filter(w => w.tab === tabId && w.staffPick)
    .slice()
    .sort(binSort);

  if (staffPicks.length) {
    const sec = document.createElement('section');
    sec.className = 'section';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <div class="staff-picks-title">
        <div class="section-title">Staff Picks</div>
        <span class="badge">* starred</span>
      </div>
      <div class="section-subtitle">${tabConfig.label}</div>
    `;
    sec.appendChild(header);

    sec.appendChild(renderTable(staffPicks, { showHeader: true }));
    appEl.appendChild(sec);

    const div = document.createElement('div');
    div.className = 'divider';
    appEl.appendChild(div);
  }

  // Category sections in manager-defined order
  tabConfig.categories.forEach((cat, idx) => {
    const winesInCat = DATA.wines
      .filter(w => w.tab === tabId && w.category === cat.id)
      .slice()
      .sort(binSort);

    if (!winesInCat.length) return;

    const sec = document.createElement('section');
    sec.className = 'section';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <div class="section-title">${escapeHtml(cat.label)}</div>
      <div class="section-subtitle">${escapeHtml(tabConfig.label)}</div>
    `;
    sec.appendChild(header);

    sec.appendChild(renderTable(winesInCat, { showHeader: true }));
    appEl.appendChild(sec);

    // Divider between sections (not after last visible one)
    const div = document.createElement('div');
    div.className = 'divider';
    appEl.appendChild(div);
  });

  setStatus('');
}

async function init() {
  try {
    setStatus('Loading wine list...');
    const res = await fetch('wines.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load wines.json (${res.status})`);
    const json = await res.json();

    // Basic validation
    if (!json || !Array.isArray(json.tabs) || !Array.isArray(json.wines)) {
      throw new Error('wines.json is missing required "tabs" or "wines" arrays.');
    }

    DATA = json;

    // Ensure a default hash
    if (!window.location.hash) window.location.hash = '#red';

    const tabId = normalizeTabFromHash();
    renderTab(tabId);

    window.addEventListener('hashchange', () => {
      const nextTab = normalizeTabFromHash();
      renderTab(nextTab);
    });

  } catch (err) {
    console.error(err);
    setStatus('Wine list failed to load. Check wines.json formatting.');
    appEl.innerHTML = '';
  }
}

init();
