// GutGEM Explorer v1.0 - Unified API Client & Dual-Mode Execution Framework

let executionMode = 'live'; // Default to Mode 2 (Live Backend); fall back to 'static' (Mode 1)

let globalData = {
  strainsIndex: [],
  metabolitesIndex: [],
  scfaSummary: [],
  scfaMatrix: [],
  strainFluxMap: {},
  metaboliteStrainMap: {}
};

// Inorganic ions list for filter
const INORGANIC_IONS = [
  "magnesium", "mg2+", "potassium", "k+", "calcium", "ca2+", "sodium", "na+",
  "chloride", "cl-", "water", "h2o", "h+", "proton", "phosphate", "pi", 
  "sulfate", "so4", "ammonium", "nh4", "fe2+", "fe3+", "zinc", "zn2+", "cobalt2+"
];

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
  
  // Setup Theme Selector
  setupThemeSelector();

  // Setup Tab Navigation
  setupTabs();
  
  // Setup Modal & Uploader (Supports CSV, JSON, XLSX, XLS)
  setupUploader();

  // Initialize Dual-Mode Health Check & Data Layer
  await initExecutionModeAndData();
  
  // Initialize Modules
  initHomeOverview();
  initStrainExplorer();
  initMetaboliteExplorer();
  initSCFAExplorer();
  initCompareStrains();
  initExchangeomeExplorer();
  initHeatmapExplorer();
  initFBASimulator();
});

// Dual-Mode Execution Initialization & Health Check
async function initExecutionModeAndData() {
  const modeBadge = document.querySelector('.brand-title-group span');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout for health check
    
    const res = await fetch('/api/v1/status', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        executionMode = 'live';
        if (modeBadge) {
          modeBadge.textContent = "v1.0 Live API";
          modeBadge.style.background = "rgba(16, 185, 129, 0.15)";
          modeBadge.style.color = "var(--primary)";
        }
        console.log("GutGEM Explorer: Operating in Live Backend Mode");
      } else {
        throw new Error("Backend degraded");
      }
    } else {
      throw new Error("Backend response error");
    }
  } catch (err) {
    executionMode = 'static';
    if (modeBadge) {
      modeBadge.textContent = "v1.0 Static JSON Cache";
      modeBadge.style.background = "rgba(2, 132, 199, 0.15)";
      modeBadge.style.color = "var(--secondary)";
    }
    console.warn("GutGEM Explorer: Fallback to Static JSON Cache. Reason:", err.message);
  }

  // Load JSON indices for Mode 1 fallback or fast client-side indexing
  await loadStaticCache();
}

// Load pre-indexed JSON data (Mode 1 & Local Fallbacks)
async function loadStaticCache() {
  try {
    const [strainsRes, metabRes, scfaSumRes, scfaMatRes, strainFluxRes, metabStrainRes] = await Promise.all([
      fetch('./data/strains_index.json'),
      fetch('./data/metabolites_index.json'),
      fetch('./data/scfa_summary.json'),
      fetch('./data/scfa_matrix.json'),
      fetch('./data/strain_flux_map.json'),
      fetch('./data/metabolite_strain_map.json')
    ]);

    globalData.strainsIndex = await strainsRes.json();
    globalData.metabolitesIndex = await metabRes.json();
    globalData.scfaSummary = await scfaSumRes.json();
    globalData.scfaMatrix = await scfaMatRes.json();
    globalData.strainFluxMap = await strainFluxRes.json();
    globalData.metaboliteStrainMap = await metabStrainRes.json();

    console.log("GutGEM Explorer: Cache initialized!", globalData);
  } catch (err) {
    console.error("Failed to load static JSON cache:", err);
  }
}

// Setup Live Theme Switcher
function setupThemeSelector() {
  const selector = document.getElementById('theme-selector');
  if (!selector) return;

  const savedTheme = localStorage.getItem('gutgem_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  selector.value = savedTheme;

  selector.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('gutgem_theme', newTheme);
    setTimeout(renderHeatmap, 50);
  });
}

// Setup Navigation Tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
      
      if (targetId === 'heatmap-explorer') {
        setTimeout(renderHeatmap, 50);
      }
    });
  });
}

// Module 1: Home Overview Charts
function initHomeOverview() {
  if (!globalData.metabolitesIndex.length) return;

  const filtered = globalData.metabolitesIndex.filter(m => 
    !INORGANIC_IONS.some(ion => m.Metabolite.toLowerCase().includes(ion))
  );

  // Top 10 Uptake
  const topUptake = [...filtered].sort((a, b) => b.Uptake_By_Strains - a.Uptake_By_Strains).slice(0, 10);
  const ctxUptake = document.getElementById('chart-top-uptake').getContext('2d');
  new Chart(ctxUptake, {
    type: 'bar',
    data: {
      labels: topUptake.map(d => d.Metabolite),
      datasets: [{
        label: 'Uptaking Strains Count',
        data: topUptake.map(d => d.Uptake_By_Strains),
        backgroundColor: 'rgba(6, 182, 212, 0.75)',
        borderColor: '#06b6d4',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } } }
      }
    }
  });

  // Top 10 Secretion
  const topSecretion = [...filtered].sort((a, b) => b.Secreted_By_Strains - a.Secreted_By_Strains).slice(0, 10);
  const ctxSecretion = document.getElementById('chart-top-secretion').getContext('2d');
  new Chart(ctxSecretion, {
    type: 'bar',
    data: {
      labels: topSecretion.map(d => d.Metabolite),
      datasets: [{
        label: 'Secreting Strains Count',
        data: topSecretion.map(d => d.Secreted_By_Strains),
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } } }
      }
    }
  });
}

// Module 2: Strain Explorer
function initStrainExplorer() {
  const select = document.getElementById('strain-select');
  select.innerHTML = '';
  
  globalData.strainsIndex.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.Strain;
    opt.textContent = item.Strain.replace(/_/g, ' ');
    select.appendChild(opt);
  });

  const updateStrainView = async () => {
    const strainName = select.value;
    if (!strainName) return;

    let meta = null;
    let fluxData = { uptake: [], secretion: [] };

    // Check in-memory custom loaded dataset first
    if (globalData.strainFluxMap[strainName]) {
      meta = globalData.strainsIndex.find(s => s.Strain === strainName);
      fluxData = globalData.strainFluxMap[strainName];
    } else if (executionMode === 'live') {
      try {
        const res = await fetch(`/api/v1/strains/${encodeURIComponent(strainName)}`);
        if (res.ok) {
          const apiData = await res.json();
          meta = {
            Uptake_Reactions: apiData.metadata.uptake_reactions,
            Secretion_Reactions: apiData.metadata.secretion_reactions,
            Total_Exchanged: apiData.metadata.total_exchanged
          };
          fluxData.uptake = apiData.uptake.map(r => ({ rxn_id: r.exchange_id, met_name: r.metabolite_name, flux: r.flux }));
          fluxData.secretion = apiData.secretion.map(r => ({ rxn_id: r.exchange_id, met_name: r.metabolite_name, flux: r.flux }));
        }
      } catch (err) {
        console.warn("Live API call failed, using static cache fallback");
      }
    }

    // Static Fallback Mode 1
    if (!meta) {
      meta = globalData.strainsIndex.find(s => s.Strain === strainName);
      fluxData = globalData.strainFluxMap[strainName] || { uptake: [], secretion: [] };
    }

    // Update Meta Box
    const metaBox = document.getElementById('strain-meta-box');
    metaBox.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--primary);"><i data-lucide="dna"></i></div>
        <div>
          <div class="stat-number" style="font-size:1.1rem;">${strainName.replace(/_/g, ' ')}</div>
          <div class="stat-label">Selected Strain</div>
        </div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-icon" style="color:var(--secondary);"><i data-lucide="arrow-down-left"></i></div>
        <div>
          <div class="stat-number">${meta ? meta.Uptake_Reactions : fluxData.uptake.length}</div>
          <div class="stat-label">Uptake Reactions</div>
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon" style="color:var(--primary);"><i data-lucide="arrow-up-right"></i></div>
        <div>
          <div class="stat-number">${meta ? meta.Secretion_Reactions : fluxData.secretion.length}</div>
          <div class="stat-label">Secretion Reactions</div>
        </div>
      </div>
      <div class="stat-card amber">
        <div class="stat-icon" style="color:var(--warning);"><i data-lucide="repeat"></i></div>
        <div>
          <div class="stat-number">${meta ? meta.Total_Exchanged : (fluxData.uptake.length + fluxData.secretion.length)}</div>
          <div class="stat-label">Total Exchanged</div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    // Tables
    document.getElementById('count-uptake').textContent = fluxData.uptake.length;
    document.getElementById('tbl-strain-uptake').innerHTML = fluxData.uptake.map(item => `
      <tr>
        <td><code>${item.rxn_id}</code></td>
        <td><strong>${item.met_name}</strong></td>
        <td class="flux-uptake">${item.flux}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">No uptake reactions</td></tr>';

    document.getElementById('count-secretion').textContent = fluxData.secretion.length;
    document.getElementById('tbl-strain-secretion').innerHTML = fluxData.secretion.map(item => `
      <tr>
        <td><code>${item.rxn_id}</code></td>
        <td><strong>${item.met_name}</strong></td>
        <td class="flux-secretion">+${item.flux}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">No secretion reactions</td></tr>';
  };

  select.addEventListener('change', updateStrainView);
  if (globalData.strainsIndex.length > 0) updateStrainView();
}

// Module 3: Metabolite Explorer
function initMetaboliteExplorer() {
  const select = document.getElementById('metabolite-select');
  select.innerHTML = '';
  
  globalData.metabolitesIndex.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.Metabolite;
    opt.textContent = item.Metabolite;
    select.appendChild(opt);
  });

  const updateMetabView = async () => {
    const metabName = select.value;
    let meta = null;
    let data = { uptake_strains: [], secretion_strains: [] };

    if (executionMode === 'live') {
      try {
        const res = await fetch(`/api/v1/metabolites/${encodeURIComponent(metabName)}`);
        if (res.ok) {
          const apiData = await res.json();
          meta = {
            Uptake_By_Strains: apiData.metadata.uptake_by_strains,
            Secreted_By_Strains: apiData.metadata.secreted_by_strains
          };
          data.uptake_strains = apiData.uptake_strains.map(s => ({ strain: s.strain_name, flux: s.flux }));
          data.secretion_strains = apiData.secretion_strains.map(s => ({ strain: s.strain_name, flux: s.flux }));
        }
      } catch (err) {
        console.warn("Live API call failed, using static fallback");
      }
    }

    if (!meta) {
      meta = globalData.metabolitesIndex.find(m => m.Metabolite === metabName);
      data = globalData.metaboliteStrainMap[metabName] || { uptake_strains: [], secretion_strains: [] };
    }

    const metaBox = document.getElementById('metab-meta-box');
    metaBox.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--secondary);"><i data-lucide="flask-conical"></i></div>
        <div>
          <div class="stat-number" style="font-size:1.1rem;">${metabName}</div>
          <div class="stat-label">Selected Metabolite</div>
        </div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-icon" style="color:var(--secondary);"><i data-lucide="arrow-down-left"></i></div>
        <div>
          <div class="stat-number">${meta ? meta.Uptake_By_Strains : data.uptake_strains.length}</div>
          <div class="stat-label">Uptaking Strains</div>
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon" style="color:var(--primary);"><i data-lucide="arrow-up-right"></i></div>
        <div>
          <div class="stat-number">${meta ? meta.Secreted_By_Strains : data.secretion_strains.length}</div>
          <div class="stat-label">Secreting Strains</div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    document.getElementById('count-metab-uptake').textContent = data.uptake_strains.length;
    document.getElementById('tbl-metab-uptake').innerHTML = data.uptake_strains.map(item => `
      <tr>
        <td><strong>${item.strain.replace(/_/g, ' ')}</strong></td>
        <td class="flux-uptake">${item.flux}</td>
      </tr>
    `).join('') || '<tr><td colspan="2" style="text-align:center; color:var(--text-dim);">No uptaking strains</td></tr>';

    document.getElementById('count-metab-secretion').textContent = data.secretion_strains.length;
    document.getElementById('tbl-metab-secretion').innerHTML = data.secretion_strains.map(item => `
      <tr>
        <td><strong>${item.strain.replace(/_/g, ' ')}</strong></td>
        <td class="flux-secretion">+${item.flux}</td>
      </tr>
    `).join('') || '<tr><td colspan="2" style="text-align:center; color:var(--text-dim);">No secreting strains</td></tr>';
  };

  select.addEventListener('change', updateMetabView);
  if (globalData.metabolitesIndex.length > 0) updateMetabView();
}

// Module 4: SCFA Explorer
function initSCFAExplorer() {
  const select = document.getElementById('scfa-select');
  select.innerHTML = '';
  
  globalData.scfaSummary.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.SCFA;
    opt.textContent = item.SCFA;
    select.appendChild(opt);
  });

  const updateSCFAView = () => {
    const scfaName = select.value;
    const sum = globalData.scfaSummary.find(s => s.SCFA === scfaName);
    if (!sum) return;

    const cards = document.getElementById('scfa-summary-cards');
    cards.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--primary);"><i data-lucide="arrow-up-right"></i></div>
        <div>
          <div class="stat-number">${sum.Producer_Strains}</div>
          <div class="stat-label">Producer Strains</div>
        </div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-icon" style="color:var(--secondary);"><i data-lucide="arrow-down-left"></i></div>
        <div>
          <div class="stat-number">${sum.Consumer_Strains}</div>
          <div class="stat-label">Consumer Strains</div>
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon" style="color:var(--accent);"><i data-lucide="activity"></i></div>
        <div>
          <div class="stat-number">${sum.Total_Exchange}</div>
          <div class="stat-label">Total Events</div>
        </div>
      </div>
      <div class="stat-card amber">
        <div class="stat-icon" style="color:var(--warning);"><i data-lucide="trending-up"></i></div>
        <div>
          <div class="stat-number">${sum.Max_Secretion}</div>
          <div class="stat-label">Max Secretion Flux</div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    const metabData = globalData.metaboliteStrainMap[scfaName] || { uptake_strains: [], secretion_strains: [] };
    const allStrains = [
      ...metabData.secretion_strains.map(s => ({ ...s, role: 'Producer', dir: 'secretion' })),
      ...metabData.uptake_strains.map(s => ({ ...s, role: 'Consumer', dir: 'uptake' }))
    ];

    const dirFilter = document.getElementById('scfa-filter-dir').value;
    const filtered = allStrains.filter(s => {
      if (dirFilter === 'producers') return s.role === 'Producer';
      if (dirFilter === 'consumers') return s.role === 'Consumer';
      return true;
    });

    document.getElementById('tbl-scfa-strains').innerHTML = filtered.slice(0, 100).map(s => `
      <tr>
        <td><strong>${s.strain.replace(/_/g, ' ')}</strong></td>
        <td><span class="badge ${s.role === 'Producer' ? 'badge-primary' : 'badge-cyan'}">${s.role}</span></td>
        <td class="${s.dir === 'secretion' ? 'flux-secretion' : 'flux-uptake'}">
          ${s.dir === 'secretion' ? '+' : ''}${s.flux}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">No strains found</td></tr>';
  };

  select.addEventListener('change', updateSCFAView);
  document.getElementById('scfa-filter-dir').addEventListener('change', updateSCFAView);
  if (globalData.scfaSummary.length > 0) updateSCFAView();
}

// Module 5: Compare Strains & Multi-Strain Groups
function initCompareStrains() {
  const selectA = document.getElementById('compare-strain-a');
  const selectB = document.getElementById('compare-strain-b');
  const metricSelect = document.getElementById('compare-metric-select');

  const btnModePair = document.getElementById('btn-mode-pair');
  const btnModeGroup = document.getElementById('btn-mode-group');
  const containerPair = document.getElementById('container-compare-pair');
  const containerGroup = document.getElementById('container-compare-group');

  // Populate 1-vs-1 Dropdowns
  selectA.innerHTML = '';
  selectB.innerHTML = '';

  globalData.strainsIndex.forEach(item => {
    const optA = document.createElement('option');
    optA.value = item.Strain;
    optA.textContent = item.Strain.replace(/_/g, ' ');
    selectA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = item.Strain;
    optB.textContent = item.Strain.replace(/_/g, ' ');
    selectB.appendChild(optB);
  });

  if (globalData.strainsIndex.length > 1) {
    selectB.selectedIndex = 1;
  }

  // Populate Multi-Strain Checkbox Lists for Group A and Group B
  const listGroupA = document.getElementById('list-group-a');
  const listGroupB = document.getElementById('list-group-b');
  listGroupA.innerHTML = '';
  listGroupB.innerHTML = '';

  const sampleStrains = globalData.strainsIndex.slice(0, 40); // 40 representative strains for multi-select
  sampleStrains.forEach((item, idx) => {
    const name = item.Strain;
    const labelText = name.replace(/_/g, ' ');

    // Checkbox Group A
    const divA = document.createElement('div');
    divA.style.margin = '0.2rem 0';
    divA.innerHTML = `
      <label style="font-size:0.83rem; cursor:pointer; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
        <input type="checkbox" class="chk-group-a" value="${name}" ${idx < 5 ? 'checked' : ''}>
        <span>${labelText}</span>
      </label>
    `;
    listGroupA.appendChild(divA);

    // Checkbox Group B
    const divB = document.createElement('div');
    divB.style.margin = '0.2rem 0';
    divB.innerHTML = `
      <label style="font-size:0.83rem; cursor:pointer; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
        <input type="checkbox" class="chk-group-b" value="${name}" ${idx >= 5 && idx < 10 ? 'checked' : ''}>
        <span>${labelText}</span>
      </label>
    `;
    listGroupB.appendChild(divB);
  });

  // Update Checkbox Count Badges
  const updateGroupCounts = () => {
    const countA = document.querySelectorAll('.chk-group-a:checked').length;
    const countB = document.querySelectorAll('.chk-group-b:checked').length;
    document.getElementById('count-group-a').textContent = `${countA} Selected`;
    document.getElementById('count-group-b').textContent = `${countB} Selected`;
  };

  listGroupA.addEventListener('change', updateGroupCounts);
  listGroupB.addEventListener('change', updateGroupCounts);
  updateGroupCounts();

  // Mode Toggle Events
  btnModePair.addEventListener('click', () => {
    btnModePair.classList.add('active');
    btnModeGroup.classList.remove('active');
    containerPair.style.display = 'block';
    containerGroup.style.display = 'none';
  });

  btnModeGroup.addEventListener('click', () => {
    btnModeGroup.classList.add('active');
    btnModePair.classList.remove('active');
    containerGroup.style.display = 'block';
    containerPair.style.display = 'none';
  });

  // 1-VS-1 CALCULATION
  const runPairwiseCalculation = async () => {
    const stA = selectA.value;
    const stB = selectB.value;
    const metric = metricSelect.value;

    let resData = null;

    if (executionMode === 'live' && !globalData.strainFluxMap[stA]) {
      try {
        const res = await fetch('/api/v1/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strain_a: stA, strain_b: stB, metric: metric })
        });
        if (res.ok) {
          resData = await res.json();
        }
      } catch (err) {
        console.warn("Compare API call failed, using static fallback");
      }
    }

    if (!resData) {
      // Local JS calculation fallback
      const dataA = globalData.strainFluxMap[stA] || { uptake: [], secretion: [] };
      const dataB = globalData.strainFluxMap[stB] || { uptake: [], secretion: [] };

      const mapA = {};
      dataA.uptake.forEach(i => mapA[i.met_name] = i.flux);
      dataA.secretion.forEach(i => mapA[i.met_name] = i.flux);

      const mapB = {};
      dataB.uptake.forEach(i => mapB[i.met_name] = i.flux);
      dataB.secretion.forEach(i => mapB[i.met_name] = i.flux);

      const allMets = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)]));

      let manhattanSum = 0;
      let euclideanSum = 0;
      let brayAbsDiffSum = 0;
      let brayAbsTotalSum = 0;

      allMets.forEach(m => {
        const valA = mapA[m] || 0.0;
        const valB = mapB[m] || 0.0;
        const diff = valA - valB;
        manhattanSum += Math.abs(diff);
        euclideanSum += diff * diff;

        const absA = Math.abs(valA);
        const absB = Math.abs(valB);
        brayAbsDiffSum += Math.abs(absA - absB);
        brayAbsTotalSum += (absA + absB);
      });

      const setUptakeA = new Set(dataA.uptake.map(i => i.met_name));
      const setUptakeB = new Set(dataB.uptake.map(i => i.met_name));
      const setSecA = new Set(dataA.secretion.map(i => i.met_name));
      const setSecB = new Set(dataB.secretion.map(i => i.met_name));

      const calcJ = (s1, s2) => {
        const u = new Set([...s1, ...s2]);
        return u.size === 0 ? 0 : new Set([...s1].filter(x => s2.has(x))).size / u.size;
      };

      const bray = brayAbsTotalSum > 0 ? (brayAbsDiffSum / brayAbsTotalSum) : 0;
      const jaccSim = calcJ(new Set([...setUptakeA, ...setSecA]), new Set([...setUptakeB, ...setSecB]));

      let calcDist = bray;
      if (metric === "manhattan") calcDist = manhattanSum;
      else if (metric === "euclidean") calcDist = Math.sqrt(euclideanSum);
      else if (metric === "jaccard_similarity") calcDist = jaccSim;

      resData = {
        strain_a: stA,
        strain_b: stB,
        selected_metric: metric,
        calculated_distance: calcDist,
        metrics_summary: {
          jaccard_similarity: jaccSim,
          bray_curtis: bray,
          manhattan_distance: manhattanSum,
          euclidean_distance: Math.sqrt(euclideanSum)
        },
        common_uptake: [...setUptakeA].filter(x => setUptakeB.has(x)),
        common_secretion: [...setSecA].filter(x => setSecB.has(x))
      };
    }

    // Update Main Primary Answer Card
    const metricText = metricSelect.options[metricSelect.selectedIndex].text;
    document.getElementById('pair-metric-label').textContent = `${metricText.toUpperCase()} CALCULATED ANSWER`;
    document.getElementById('pair-metric-answer').textContent = Number(resData.calculated_distance).toFixed(4);
    document.getElementById('pair-metric-desc').textContent = `Pairwise distance between ${stA.replace(/_/g, ' ')} and ${stB.replace(/_/g, ' ')}`;

    // Update Secondary Cards
    const summary = resData.metrics_summary || {};
    if (document.getElementById('jaccard-uptake')) document.getElementById('jaccard-uptake').textContent = Number(summary.jaccard_similarity || 0).toFixed(3);
    if (document.getElementById('jaccard-secretion')) document.getElementById('jaccard-secretion').textContent = Number(summary.jaccard_similarity || 0).toFixed(3);
    if (document.getElementById('jaccard-combined')) document.getElementById('jaccard-combined').textContent = Number(summary.jaccard_similarity || 0).toFixed(3);
    if (document.getElementById('dist-braycurtis')) document.getElementById('dist-braycurtis').textContent = Number(summary.bray_curtis || 0).toFixed(3);
    if (document.getElementById('dist-manhattan')) document.getElementById('dist-manhattan').textContent = Number(summary.manhattan_distance || 0).toFixed(1);
    if (document.getElementById('dist-euclidean')) document.getElementById('dist-euclidean').textContent = Number(summary.euclidean_distance || 0).toFixed(1);

    document.getElementById('tbl-common-uptake').innerHTML = resData.common_uptake.map(m => `
      <tr><td><strong>${m}</strong></td></tr>
    `).join('') || '<tr><td style="color:var(--text-dim); text-align:center;">No common uptake metabolites</td></tr>';

    document.getElementById('tbl-common-secretion').innerHTML = resData.common_secretion.map(m => `
      <tr><td><strong>${m}</strong></td></tr>
    `).join('') || '<tr><td style="color:var(--text-dim); text-align:center;">No common secretion metabolites</td></tr>';
  };

  document.getElementById('btn-compare-strains').addEventListener('click', runPairwiseCalculation);

  // MULTI-STRAIN GROUP CALCULATION (GROUP A vs GROUP B)
  document.getElementById('btn-calc-group').addEventListener('click', async () => {
    const selectedA = Array.from(document.querySelectorAll('.chk-group-a:checked')).map(cb => cb.value);
    const selectedB = Array.from(document.querySelectorAll('.chk-group-b:checked')).map(cb => cb.value);
    const metric = metricSelect.value;

    if (selectedA.length === 0 || selectedB.length === 0) {
      alert("Please select at least 1 strain in Group A and 1 strain in Group B!");
      return;
    }

    let groupRes = null;

    if (executionMode === 'live') {
      try {
        const res = await fetch('/api/v1/compare/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_a: selectedA, group_b: selectedB, metric: metric })
        });
        if (res.ok) {
          groupRes = await res.json();
        }
      } catch (err) {
        console.warn("Group compare API call failed, running local calculation");
      }
    }

    if (!groupRes) {
      // Local calculation fallback
      const matrix = [];
      const allDists = [];

      selectedA.forEach(sA => {
        const row = [];
        const dataA = globalData.strainFluxMap[sA] || { uptake: [], secretion: [] };
        const mapA = {};
        dataA.uptake.forEach(i => mapA[i.met_name] = i.flux);
        dataA.secretion.forEach(i => mapA[i.met_name] = i.flux);

        selectedB.forEach(sB => {
          const dataB = globalData.strainFluxMap[sB] || { uptake: [], secretion: [] };
          const mapB = {};
          dataB.uptake.forEach(i => mapB[i.met_name] = i.flux);
          dataB.secretion.forEach(i => mapB[i.met_name] = i.flux);

          const allMets = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)]));

          let manhattanSum = 0;
          let brayAbsDiffSum = 0;
          let brayAbsTotalSum = 0;

          allMets.forEach(m => {
            const valA = mapA[m] || 0.0;
            const valB = mapB[m] || 0.0;
            manhattanSum += Math.abs(valA - valB);

            const absA = Math.abs(valA);
            const absB = Math.abs(valB);
            brayAbsDiffSum += Math.abs(absA - absB);
            brayAbsTotalSum += (absA + absB);
          });

          const d = metric === 'manhattan' ? manhattanSum : (brayAbsTotalSum > 0 ? (brayAbsDiffSum / brayAbsTotalSum) : 0);
          row.push(Number(d.toFixed(4)));
          allDists.push(d);
        });

        matrix.push(row);
      });

      const meanD = allDists.length > 0 ? (allDists.reduce((a,b)=>a+b,0) / allDists.length) : 0;
      const minD = allDists.length > 0 ? Math.min(...allDists) : 0;
      const maxD = allDists.length > 0 ? Math.max(...allDists) : 0;

      groupRes = {
        selected_metric: metric,
        group_a: selectedA,
        group_b: selectedB,
        mean_distance: meanD,
        min_distance: minD,
        max_distance: maxD,
        pairwise_matrix: matrix
      };
    }

    // Render Group Summary Cards
    document.getElementById('group-summary-cards').style.display = 'grid';
    document.getElementById('group-matrix-container').style.display = 'block';

    document.getElementById('group-mean-dist').textContent = Number(groupRes.mean_distance).toFixed(4);
    document.getElementById('group-min-dist').textContent = Number(groupRes.min_distance).toFixed(4);
    document.getElementById('group-max-dist').textContent = Number(groupRes.max_distance).toFixed(4);

    // Build Inter-Group Distance Matrix Table
    let tableHtml = `
      <thead>
        <tr>
          <th>Group A \\ Group B</th>
          ${groupRes.group_b.map(sB => `<th style="font-size:0.78rem;">${sB.replace(/_/g, ' ')}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
    `;

    groupRes.group_a.forEach((sA, rowIdx) => {
      tableHtml += `<tr><td><strong style="font-size:0.78rem;">${sA.replace(/_/g, ' ')}</strong></td>`;
      groupRes.group_b.forEach((sB, colIdx) => {
        const distVal = groupRes.pairwise_matrix[rowIdx][colIdx];
        tableHtml += `<td style="font-family:var(--font-mono); font-weight:700; color:var(--primary);">${distVal}</td>`;
      });
      tableHtml += `</tr>`;
    });

    tableHtml += `</tbody>`;
    document.getElementById('tbl-group-matrix').innerHTML = tableHtml;
  });
}

// Module 6: Exchangeome Explorer
function initExchangeomeExplorer() {
  const chkIons = document.getElementById('chk-exclude-ions');
  
  const updateExchangeomeView = () => {
    let list = [...globalData.metabolitesIndex];

    if (chkIons.checked) {
      list = list.filter(m => 
        !INORGANIC_IONS.some(ion => m.Metabolite.toLowerCase().includes(ion))
      );
    }

    list.sort((a, b) => b.Total_Exchange - a.Total_Exchange);

    const totalStrains = 3464;
    document.getElementById('tbl-exchangeome').innerHTML = list.slice(0, 150).map((m, idx) => {
      const prev = ((m.Total_Exchange / totalStrains) * 100).toFixed(1);
      const isCore = prev >= 50.0;
      return `
        <tr>
          <td><span style="font-weight:700; color:var(--text-dim);">#${idx + 1}</span></td>
          <td><strong>${m.Metabolite}</strong></td>
          <td class="flux-uptake">${m.Uptake_By_Strains}</td>
          <td class="flux-secretion">${m.Secreted_By_Strains}</td>
          <td><strong>${m.Total_Exchange}</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span>${prev}%</span>
              <div style="flex:1; height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                <div style="width:${prev}%; height:100%; background:${isCore ? 'var(--primary)' : 'var(--secondary)'}"></div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${isCore ? 'badge-primary' : 'badge-cyan'}">
              ${isCore ? 'Core (>50%)' : 'Variable'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  };

  chkIons.addEventListener('change', updateExchangeomeView);
  updateExchangeomeView();
}

// Module 7: Heatmap Explorer (High-Contrast Visual Renderer)
let heatmapLastRenderData = null;

function initHeatmapExplorer() {
  const containerStrains = document.getElementById('heatmap-list-strains');
  const containerMets = document.getElementById('heatmap-list-mets');
  const searchStrains = document.getElementById('heatmap-strain-search');
  const searchMets = document.getElementById('heatmap-metab-search');

  // Populate Heatmap Strains Checkboxes
  const populateHeatmapStrains = (filterText = '') => {
    containerStrains.innerHTML = '';
    const filtered = globalData.strainsIndex.filter(s => 
      s.Strain.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.slice(0, 50).forEach((item, idx) => {
      const name = item.Strain;
      const labelText = name.replace(/_/g, ' ');
      const div = document.createElement('div');
      div.style.margin = '0.18rem 0';
      div.innerHTML = `
        <label style="font-size:0.8rem; cursor:pointer; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
          <input type="checkbox" class="chk-heatmap-strain" value="${name}" ${idx < 10 ? 'checked' : ''}>
          <span>${labelText}</span>
        </label>
      `;
      containerStrains.appendChild(div);
    });
  };

  // Populate Heatmap Metabolites Checkboxes
  const populateHeatmapMets = (filterText = '') => {
    containerMets.innerHTML = '';
    const filtered = globalData.metabolitesIndex.filter(m => 
      m.Metabolite.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.slice(0, 50).forEach((item, idx) => {
      const name = item.Metabolite;
      const div = document.createElement('div');
      div.style.margin = '0.18rem 0';
      div.innerHTML = `
        <label style="font-size:0.8rem; cursor:pointer; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
          <input type="checkbox" class="chk-heatmap-metab" value="${name}" ${idx < 12 ? 'checked' : ''}>
          <span>${name}</span>
        </label>
      `;
      containerMets.appendChild(div);
    });
  };

  if (globalData.strainsIndex.length > 0) populateHeatmapStrains();
  if (globalData.metabolitesIndex.length > 0) populateHeatmapMets();

  searchStrains.addEventListener('input', (e) => populateHeatmapStrains(e.target.value));
  searchMets.addEventListener('input', (e) => populateHeatmapMets(e.target.value));

  // Quick Select Buttons
  document.getElementById('btn-heatmap-select-strains-10').addEventListener('click', () => {
    document.querySelectorAll('.chk-heatmap-strain').forEach((cb, idx) => cb.checked = (idx < 10));
  });
  document.getElementById('btn-heatmap-clear-strains').addEventListener('click', () => {
    document.querySelectorAll('.chk-heatmap-strain').forEach(cb => cb.checked = false);
  });

  document.getElementById('btn-heatmap-select-scfa').addEventListener('click', () => {
    const scfas = ["Acetate", "Propionate", "Butyrate", "Formate", "Isobutyrate, 2-Methylpropanoate", "2-methylbutyrate", "Isovalerate, 3-Methylbutanoate"];
    document.querySelectorAll('.chk-heatmap-metab').forEach(cb => {
      cb.checked = scfas.includes(cb.value);
    });
  });
  document.getElementById('btn-heatmap-select-mets-15').addEventListener('click', () => {
    document.querySelectorAll('.chk-heatmap-metab').forEach((cb, idx) => cb.checked = (idx < 15));
  });
  document.getElementById('btn-heatmap-clear-mets').addEventListener('click', () => {
    document.querySelectorAll('.chk-heatmap-metab').forEach(cb => cb.checked = false);
  });

  document.getElementById('btn-render-custom-heatmap').addEventListener('click', renderHeatmap);
  document.getElementById('heatmap-matrix-type').addEventListener('change', renderHeatmap);

  // Setup Heatmap Hover Tooltip Event
  setupHeatmapHoverTooltip();

  renderHeatmap();
}

async function renderHeatmap() {
  const canvas = document.getElementById('heatmap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const matrixType = document.getElementById('heatmap-matrix-type').value;

  // Selected Strains and Metabolites
  const selectedStrains = Array.from(document.querySelectorAll('.chk-heatmap-strain:checked')).map(cb => cb.value);
  const selectedMetabs = Array.from(document.querySelectorAll('.chk-heatmap-metab:checked')).map(cb => cb.value);

  const strains = selectedStrains.length > 0 ? selectedStrains : globalData.strainsIndex.slice(0, 15).map(s => s.Strain);
  const metabolites = selectedMetabs.length > 0 ? selectedMetabs : globalData.metabolitesIndex.slice(0, 15).map(m => m.Metabolite);

  let gridData = null;

  if (executionMode === 'live' && !strains.some(s => globalData.strainFluxMap[s])) {
    try {
      const res = await fetch('/api/v1/heatmap/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrix_table: matrixType,
          strains: strains,
          metabolites: metabolites
        })
      });
      if (res.ok) {
        gridData = await res.json();
      }
    } catch (err) {
      console.warn("Heatmap API call failed, using static renderer");
    }
  }

  if (!gridData) {
    // Local static calculation fallback
    const grid = [];
    strains.forEach(s => {
      const row = [];
      const fluxData = globalData.strainFluxMap[s] || { uptake: [], secretion: [] };
      const uptakeMap = {};
      fluxData.uptake.forEach(u => uptakeMap[u.met_name] = u.flux);
      const secMap = {};
      fluxData.secretion.forEach(sec => secMap[sec.met_name] = sec.flux);

      metabolites.forEach(m => {
        if (matrixType === 'binary_matrix') {
          if (secMap[m]) row.push(1);
          else if (uptakeMap[m]) row.push(-1);
          else row.push(0);
        } else if (matrixType === 'secretion_matrix') {
          row.push(secMap[m] || 0.0);
        } else if (matrixType === 'uptake_matrix') {
          row.push(uptakeMap[m] || 0.0);
        } else {
          row.push(secMap[m] || uptakeMap[m] || 0.0);
        }
      });
      grid.push(row);
    });

    gridData = {
      matrix_type: matrixType,
      strains: strains,
      metabolites: metabolites,
      grid: grid
    };
  }

  heatmapLastRenderData = gridData;

  // Render Canvas Grid - High Contrast Dimensions & Text
  const marginX = 280;
  const marginY = 160;
  const gridWidth = canvas.width - marginX - 20;
  const gridHeight = canvas.height - marginY - 20;

  const cellW = gridWidth / strains.length;
  const cellH = gridHeight / metabolites.length;

  // Render Crisp Row Labels (Metabolites)
  ctx.fillStyle = '#f8fafc'; // Crisp bright white font
  ctx.font = 'bold 12px Inter, sans-serif';

  metabolites.forEach((m, i) => {
    const y = marginY + i * cellH + cellH / 1.4;
    const displayName = m.length > 32 ? m.substring(0,32) + '...' : m;
    ctx.fillText(displayName, 10, y);
  });

  // Render Crisp Column Labels (Strains - Rotated -45deg)
  strains.forEach((s, colIdx) => {
    const x = marginX + colIdx * cellW + cellW / 2;
    ctx.save();
    ctx.translate(x, marginY - 12);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#38bdf8'; // High contrast cyan text for strain names
    ctx.font = 'bold 11px Inter, sans-serif';
    const displayName = s.length > 22 ? s.substring(0,22) + '...' : s.replace(/_/g, ' ');
    ctx.fillText(displayName, 0, 0);
    ctx.restore();
  });

  // Render High-Contrast Cell Rectangles with Crisp Grid Borders
  strains.forEach((s, colIdx) => {
    metabolites.forEach((m, rowIdx) => {
      const val = gridData.grid[colIdx][rowIdx];
      const x = marginX + colIdx * cellW;
      const y = marginY + rowIdx * cellH;

      // Draw Cell Background Color
      if (matrixType === 'binary_matrix') {
        if (val === 1) ctx.fillStyle = '#10b981'; // Vibrant Emerald Green (Secreted)
        else if (val === -1) ctx.fillStyle = '#06b6d4'; // Vibrant Cyan Blue (Uptaken)
        else ctx.fillStyle = '#1e293b'; // High Contrast Dark Slate (Inactive)
      } else {
        // Continuous Flux Gradient
        if (val > 0) ctx.fillStyle = `rgba(16, 185, 129, ${Math.min(1.0, val / 1000 + 0.2)})`;
        else if (val < 0) ctx.fillStyle = `rgba(6, 182, 212, ${Math.min(1.0, Math.abs(val) / 1000 + 0.2)})`;
        else ctx.fillStyle = '#1e293b';
      }

      ctx.fillRect(x, y, cellW - 1.5, cellH - 1.5);

      // Draw Grid Cell Border Line for High Visibility
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(x, y, cellW - 1.5, cellH - 1.5);
    });
  });
}

// Canvas Hover Cell Tooltip
function setupHeatmapHoverTooltip() {
  const canvas = document.getElementById('heatmap-canvas');
  const infoBar = document.getElementById('heatmap-cell-info');
  if (!canvas || !infoBar) return;

  canvas.addEventListener('mousemove', (e) => {
    if (!heatmapLastRenderData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const marginX = 280;
    const marginY = 160;
    const cellW = (canvas.width - marginX - 20) / heatmapLastRenderData.strains.length;
    const cellH = (canvas.height - marginY - 20) / heatmapLastRenderData.metabolites.length;

    if (x >= marginX && y >= marginY) {
      const colIdx = Math.floor((x - marginX) / cellW);
      const rowIdx = Math.floor((y - marginY) / cellH);

      if (colIdx >= 0 && colIdx < heatmapLastRenderData.strains.length &&
          rowIdx >= 0 && rowIdx < heatmapLastRenderData.metabolites.length) {
        
        const sName = heatmapLastRenderData.strains[colIdx].replace(/_/g, ' ');
        const mName = heatmapLastRenderData.metabolites[rowIdx];
        const val = heatmapLastRenderData.grid[colIdx][rowIdx];

        let statusText = "";
        let badgeColor = "";

        if (val === 1) {
          statusText = "EMERALD GREEN = Secreted / Produced (+1)";
          badgeColor = "background:#10b981; color:#000000;";
        } else if (val === -1) {
          statusText = "CYAN BLUE = Uptaken / Consumed (-1)";
          badgeColor = "background:#06b6d4; color:#000000;";
        } else if (val === 0) {
          statusText = "DARK SLATE = Inactive / No Exchange (0)";
          badgeColor = "background:#334155; color:#ffffff;";
        } else {
          statusText = `FLUX = ${val} mmol/gDW/h`;
          badgeColor = val > 0 ? "background:#10b981; color:#000;" : "background:#06b6d4; color:#000;";
        }

        infoBar.innerHTML = `
          🦠 Bacteria: <strong style="color:var(--primary); font-size:1rem;">${sName}</strong> &nbsp;|&nbsp; 
          🧪 Metabolite: <strong style="color:var(--secondary); font-size:1rem;">${mName}</strong> &nbsp;|&nbsp; 
          <span style="padding:0.25rem 0.65rem; border-radius:15px; font-weight:800; font-size:0.85rem; ${badgeColor}">${statusText}</span>
        `;
        return;
      }
    }

    infoBar.innerHTML = "💡 Hover over heatmap cells to inspect strain exchange fluxes and color interpretations.";
  });
}

// Ingest Custom Uploaded Dataset into Memory & Refresh All Views
function ingestCustomDataset(records, filename) {
  if (!Array.isArray(records) || records.length === 0) {
    alert("Warning: Uploaded file contains no data rows.");
    return;
  }

  // Extract Strain Name from records or fallback to clean filename
  let detectedStrain = filename.replace(/\.(xlsx|xls|csv|json)$/i, '');
  for (let r of records) {
    const s = r.strain_name || r.Strain || r.strain || r['Strain Name'] || r['strain_name'] || r.model || r.Model;
    if (s) {
      detectedStrain = String(s).trim();
      break;
    }
  }

  const uptakeList = [];
  const secretionList = [];

  records.forEach((r, idx) => {
    const rxn_id = r.exchange_id || r.Exchange_ID || r.rxn_id || r.Reaction || r.reaction || r['Exchange ID'] || r['Reaction ID'] || `EX_custom_${idx + 1}`;
    const met_name = r.metabolite_name || r.Metabolite_Name || r.metabolite || r.Metabolite || r['Metabolite Name'] || r['metabolite_name'] || 'Unknown_Metabolite';
    const raw_flux = r.flux_value !== undefined ? r.flux_value : (r.Flux_Value !== undefined ? r.Flux_Value : (r.flux !== undefined ? r.flux : (r.Flux !== undefined ? r.Flux : (r['Flux Value'] !== undefined ? r['Flux Value'] : 0))));
    
    const flux = parseFloat(raw_flux) || 0.0;
    const direction = (r.direction || r.Direction || r.type || r.Type || '').toLowerCase();

    if (flux < 0 || direction === 'uptake' || direction === 'consumer') {
      uptakeList.push({ rxn_id, met_name, flux: Math.abs(flux) });
    } else if (flux > 0 || direction === 'secretion' || direction === 'producer') {
      secretionList.push({ rxn_id, met_name, flux: Math.abs(flux) });
    }
  });

  const totalExchanged = uptakeList.length + secretionList.length;

  // Update global strain flux map in memory
  globalData.strainFluxMap[detectedStrain] = {
    uptake: uptakeList,
    secretion: secretionList
  };

  // Upsert into strains index
  const existingIdx = globalData.strainsIndex.findIndex(s => s.Strain === detectedStrain);
  const strainEntry = {
    Strain: detectedStrain,
    Uptake_Reactions: uptakeList.length,
    Secretion_Reactions: secretionList.length,
    Total_Exchanged: totalExchanged
  };

  if (existingIdx >= 0) {
    globalData.strainsIndex[existingIdx] = strainEntry;
  } else {
    globalData.strainsIndex.unshift(strainEntry);
  }

  // Update Metabolites Index & Metabolite-Strain Lookup Map
  [...uptakeList, ...secretionList].forEach(item => {
    if (!globalData.metaboliteStrainMap[item.met_name]) {
      globalData.metaboliteStrainMap[item.met_name] = { uptake_strains: [], secretion_strains: [] };
    }
    const mapEntry = globalData.metaboliteStrainMap[item.met_name];
    if (uptakeList.includes(item)) {
      if (!mapEntry.uptake_strains.some(s => s.strain === detectedStrain)) {
        mapEntry.uptake_strains.push({ strain: detectedStrain, flux: item.flux });
      }
    } else {
      if (!mapEntry.secretion_strains.some(s => s.strain === detectedStrain)) {
        mapEntry.secretion_strains.push({ strain: detectedStrain, flux: item.flux });
      }
    }

    if (!globalData.metabolitesIndex.some(m => m.Metabolite === item.met_name)) {
      globalData.metabolitesIndex.push({
        Metabolite: item.met_name,
        Uptake_By_Strains: mapEntry.uptake_strains.length,
        Secreted_By_Strains: mapEntry.secretion_strains.length,
        Total_Exchange: mapEntry.uptake_strains.length + mapEntry.secretion_strains.length
      });
    }
  });

  // Re-populate Modules
  initStrainExplorer();
  initCompareStrains();
  initHeatmapExplorer();

  // Automatically select loaded strain in Strain Explorer
  const strainSelect = document.getElementById('strain-select');
  if (strainSelect) {
    strainSelect.value = detectedStrain;
    strainSelect.dispatchEvent(new Event('change'));
  }

  // Switch tab to Strain Explorer so the user immediately sees their dataset
  const strainTabBtn = document.querySelector('.nav-tab[data-tab="strain-explorer"]');
  if (strainTabBtn) strainTabBtn.click();

  alert(`🎉 Successfully ingested dataset for strain:\n"${detectedStrain}"\n• ${uptakeList.length} Uptake Reactions\n• ${secretionList.length} Secretion Reactions\n\nViewing updated profile in Strain Explorer & Heatmap!`);
}

// Uploader Modal Setup (Supports CSV, JSON, XLSX, XLS)
function setupUploader() {
  const modal = document.getElementById('modal-uploader');
  const btnOpen = document.getElementById('btn-open-uploader');
  const btnClose = document.getElementById('btn-close-modal');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  btnOpen.addEventListener('click', () => modal.style.display = 'flex');
  btnClose.addEventListener('click', () => modal.style.display = 'none');

  dropzone.addEventListener('click', () => fileInput.click());

  // Drag and Drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--primary)';
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-subtle)';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-subtle)';
    if (e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      processUploadedFile(file);
    }
  });

  function processUploadedFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const records = XLSX.utils.sheet_to_json(worksheet);
          
          modal.style.display = 'none';
          ingestCustomDataset(records, file.name);
        } catch (err) {
          alert(`Error reading Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          modal.style.display = 'none';
          ingestCustomDataset(results.data, file.name);
        }
      });
    } else if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const records = JSON.parse(e.target.result);
          const recArray = Array.isArray(records) ? records : [records];
          modal.style.display = 'none';
          ingestCustomDataset(recArray, file.name);
        } catch (err) {
          alert(`Error parsing JSON: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      alert("Unsupported file format! Please upload a .csv, .json, .xlsx, or .xls file.");
    }
  }
}

// --- LIVE FBA SIMULATOR CONTROLLER ---
let lastFBASimulationData = null;

function initFBASimulator() {
  const dropzone = document.getElementById('fba-dropzone');
  const fileInput = document.getElementById('fba-file-input');
  const dropzoneText = document.getElementById('fba-dropzone-text');
  const btnRun = document.getElementById('btn-run-fba');
  const loadingIndicator = document.getElementById('fba-loading');
  const resultsPanel = document.getElementById('fba-results-panel');
  const btnDownloadCsv = document.getElementById('btn-fba-download-csv');
  const btnIngest = document.getElementById('btn-fba-ingest');

  if (!dropzone || !fileInput || !btnRun) return;

  let selectedFile = null;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--primary)';
    dropzone.style.background = 'var(--primary-bg)';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border-subtle)';
    dropzone.style.background = 'var(--bg-card)';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-subtle)';
    dropzone.style.background = 'var(--bg-card)';
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xml' && ext !== 'sbml') {
      alert("Invalid file format! Please select an SBML XML (.xml or .sbml) model file.");
      return;
    }
    selectedFile = file;
    dropzoneText.innerHTML = `📄 <strong style="color:var(--primary);">${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
  }

  btnRun.addEventListener('click', async () => {
    if (!selectedFile) {
      alert("Please select or drop an SBML XML model file (.xml or .sbml) first!");
      return;
    }

    const mediumBound = parseFloat(document.getElementById('fba-medium-bound').value || '-1000.0');
    const objectiveId = document.getElementById('fba-objective-input').value.trim();

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('medium_bound', mediumBound);
    if (objectiveId) formData.append('objective_reaction_id', objectiveId);

    loadingIndicator.style.display = 'block';
    resultsPanel.style.display = 'none';

    try {
      const response = await fetch('/api/v1/fba/simulate', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();

      if (!response.ok || resData.status === 'error') {
        throw new Error(resData.detail || resData.message || "Simulation failed.");
      }

      lastFBASimulationData = resData;
      renderFBAResults(resData);
    } catch (err) {
      alert(`FBA Simulation Error: ${err.message}`);
    } finally {
      loadingIndicator.style.display = 'none';
    }
  });

  function renderFBAResults(data) {
    const growthVal = data.biomass_growth_rate > 10 ? data.biomass_growth_rate.toFixed(2) : data.biomass_growth_rate.toFixed(4);
    document.getElementById('fba-val-growth').textContent = growthVal;
    document.getElementById('fba-val-total').textContent = data.total_exchanges;
    document.getElementById('fba-val-secretion').textContent = data.secretion_count;
    document.getElementById('fba-val-uptake').textContent = data.uptake_count;
    document.getElementById('fba-val-time').textContent = `${data.execution_time_ms.toFixed(0)} ms`;
    document.getElementById('fba-val-cached').textContent = data.cached ? "⚡ Instant MD5 Cache" : "Fresh Execution";

    // Populate Secretion Table
    const tbodySec = document.getElementById('tbody-fba-secretion');
    tbodySec.innerHTML = '';
    const secretions = data.exchange_fluxes.filter(e => e.Direction === 'Secretion');
    if (secretions.length === 0) {
      tbodySec.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">No secretion reactions detected</td></tr>';
    } else {
      secretions.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${s.Metabolite_Name}</strong></td><td><code>${s.Exchange_ID}</code></td><td style="color:var(--emerald); font-weight:700;">+${s.Flux.toFixed(4)}</td>`;
        tbodySec.appendChild(tr);
      });
    }

    // Populate Uptake Table
    const tbodyUpt = document.getElementById('tbody-fba-uptake');
    tbodyUpt.innerHTML = '';
    const uptakes = data.exchange_fluxes.filter(e => e.Direction === 'Uptake');
    if (uptakes.length === 0) {
      tbodyUpt.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">No uptake reactions detected</td></tr>';
    } else {
      uptakes.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${u.Metabolite_Name}</strong></td><td><code>${u.Exchange_ID}</code></td><td style="color:var(--cyan); font-weight:700;">${u.Flux.toFixed(4)}</td>`;
        tbodyUpt.appendChild(tr);
      });
    }

    resultsPanel.style.display = 'block';
  }

  // Wire Download CSV Button
  if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', async () => {
      if (!lastFBASimulationData) return;
      try {
        const response = await fetch('/api/v1/fba/download-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lastFBASimulationData)
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${lastFBASimulationData.strain_name}_fba_exchange_fluxes.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        alert(`Download Error: ${err.message}`);
      }
    });
  }

  // Wire Ingest into Knowledgebase Button
  if (btnIngest) {
    btnIngest.addEventListener('click', () => {
      if (!lastFBASimulationData || !lastFBASimulationData.exchange_fluxes) return;
      ingestCustomDataset(lastFBASimulationData.exchange_fluxes, `${lastFBASimulationData.strain_name}.xml`);
    });
  }
}

