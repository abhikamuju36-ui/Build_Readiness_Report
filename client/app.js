/* ===== SDC Build Readiness — Frontend ===== */

let reportData = null;
let emailData = null;
let currentView = 'readiness';
let filterText = '';
let activeChip = null;   // null | 'ready' | 'close' | 'blocked' | 'nopo'
let projectionDate = null; // Date object or null

// ===== DOM refs =====
const projectForm = document.getElementById('project-form');
const projectInput = document.getElementById('project-input');
const loadBtn = document.getElementById('load-btn');
const projectInfo = document.getElementById('project-info');
const tabBar = document.getElementById('tab-bar');
const welcome = document.getElementById('welcome');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('error-msg');

// ===== Init =====
projectForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = projectInput.value.trim();
  if (id) loadProject(parseInt(id));
});

tabBar.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

// ===== API =====
async function loadProject(projectId) {
  welcome.classList.add('hidden');
  errorMsg.classList.add('hidden');
  loading.classList.remove('hidden');
  tabBar.classList.add('hidden');
  hideAllViews();
  loadBtn.disabled = true;

  try {
    const [readinessRes, emailRes] = await Promise.all([
      fetch(`/api/readiness/${projectId}`),
      fetch(`/api/emails/${projectId}`),
    ]);

    if (!readinessRes.ok) throw new Error((await readinessRes.json()).error || 'Failed to load');

    reportData = await readinessRes.json();
    emailData = await emailRes.json();

    loading.classList.add('hidden');
    tabBar.classList.remove('hidden');

    // Show project info in header
    const p = reportData.project;
    const bd = reportData.buildDates;
    let infoHtml = `<strong>Job ${projectId}</strong>`;
    if (p) infoHtml += `<br>${p.ProjectName || ''}`;
    if (bd && bd.buildStart) {
      const start = new Date(bd.buildStart);
      const now = new Date();
      const daysDiff = Math.ceil((now - start) / 86400000);
      if (daysDiff > 0) {
        infoHtml += `<br><span style="color:#FEF3C7">${daysDiff}d into build</span>`;
      } else {
        infoHtml += `<br><span style="color:#EAF3DE">${Math.abs(daysDiff)}d until build start</span>`;
      }
    }
    projectInfo.innerHTML = infoHtml;

    // Render all views
    renderReadinessView();
    renderBomTreeView();
    renderPoActionsView();
    renderEmailsView();
    switchView('readiness');

    // Demo mode banner
    if (reportData.demoMode) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#FEF3C7;color:#854F0B;padding:8px 16px;text-align:center;font-size:13px;font-weight:500;border-bottom:1px solid #F59E0B';
      banner.textContent = `Demo Mode — showing cached data for Job ${projectInput.value.trim()}. Configure .env with ETO credentials for live data.`;
      document.getElementById('tab-bar').after(banner);
    }

  } catch (err) {
    loading.classList.add('hidden');
    errorMsg.classList.remove('hidden');
    errorMsg.innerHTML = `<h2>Error</h2><p>${escHtml(err.message)}</p>`;
  } finally {
    loadBtn.disabled = false;
  }
}

function switchView(view) {
  currentView = view;
  tabBar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
}

function hideAllViews() {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
}

// ===== Utilities =====
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function statusClass(pct) {
  if (pct === 100) return 'ready';
  if (pct >= 60) return 'close';
  return 'blocked';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===== View 1: Build Readiness =====

/** Compute effective status for a part at a given projection date */
function partStatusAt(part, date) {
  if (!date) return part.status || (part.receivedQty >= part.qty ? 'received' : part.poQty > 0 ? 'ordered' : 'noPO');
  // Already received
  if (part.receivedQty >= part.qty) return 'received';
  // Check if any PO due date is <= projection date
  if (part.pos && part.pos.length > 0) {
    const willArrive = part.pos.some(po => {
      const due = po.dueDate ? new Date(po.dueDate) : null;
      return due && due <= date;
    });
    if (willArrive) return 'received'; // projected to arrive
  }
  if (part.poQty > 0) return 'ordered';
  return 'noPO';
}

/** Compute projected stats for an assembly node */
function projectedStats(node, date) {
  if (!date || !node.isAssembly) return node.stats;
  const allParts = collectLeafParts(node);
  const total = allParts.length;
  const received = allParts.filter(p => partStatusAt(p, date) === 'received').length;
  const noPO = allParts.filter(p => partStatusAt(p, date) === 'noPO').length;
  const ordered = allParts.filter(p => partStatusAt(p, date) === 'ordered').length;
  const pct = total ? Math.round((received / total) * 100) : 0;
  return { total, received, noPO, ordered, pct };
}

/** Collect all leaf parts under a node recursively */
function collectLeafParts(node) {
  const parts = [];
  if (node.parts) parts.push(...node.parts);
  if (node.children) node.children.forEach(c => parts.push(...collectLeafParts(c)));
  return parts;
}

/** Check if a node or any descendant matches the search filter */
function nodeMatchesFilter(node, text) {
  if (!text) return true;
  const t = text.toLowerCase();
  if ((node.pn || '').toLowerCase().includes(t)) return true;
  if ((node.desc || '').toLowerCase().includes(t)) return true;
  // Check PO suppliers on leaf parts
  if (node.pos) {
    if (node.pos.some(po => (po.supplier || '').toLowerCase().includes(t))) return true;
  }
  // Check children
  if (node.children && node.children.some(c => nodeMatchesFilter(c, text))) return true;
  if (node.parts && node.parts.some(p => nodeMatchesFilter(p, text))) return true;
  return false;
}

/** Check if a machine matches the active chip filter */
function machineMatchesChip(machine, chip, date) {
  if (!chip) return true;
  const stats = projectedStats(machine.node || machine, date);
  if (!stats) return false;
  if (chip === 'ready') return stats.pct === 100;
  if (chip === 'close') return stats.pct >= 60 && stats.pct < 100;
  if (chip === 'blocked') return stats.pct < 60;
  if (chip === 'nopo') return stats.noPO > 0;
  return true;
}

function renderReadinessView() {
  const el = document.getElementById('view-readiness');
  if (!reportData) return;

  // Aggregate summary stats
  let totalMachines = 0, totalReady = 0, totalClose = 0, totalBlocked = 0, totalNoPo = 0;
  reportData.specs.forEach(s => {
    (s.machines || []).forEach(m => {
      const stats = projectedStats(m.node || m, projectionDate);
      if (!stats) return;
      totalMachines++;
      if (stats.pct === 100) totalReady++;
      else if (stats.pct >= 60) totalClose++;
      else totalBlocked++;
    });
    totalNoPo += (s.noPoParts || []).length;
  });

  let html = '';

  // Summary banner
  html += `<div class="summary-banner">
    <div class="summary-stat"><div class="val blue">${totalMachines}</div><div class="lbl">Assemblies</div></div>
    <div class="summary-stat"><div class="val green">${totalReady}</div><div class="lbl">Ready to Build</div></div>
    <div class="summary-stat"><div class="val amber">${totalClose}</div><div class="lbl">Close (60-99%)</div></div>
    <div class="summary-stat"><div class="val red">${totalBlocked}</div><div class="lbl">Blocked (&lt;60%)</div></div>
    <div class="summary-stat"><div class="val red">${totalNoPo}</div><div class="lbl">Parts — No PO</div></div>
  </div>`;

  // Toolbar
  html += `<div class="toolbar">
    <div class="search-wrap"><input type="text" id="readiness-search" placeholder="Search parts, assemblies, suppliers..." value="${escHtml(filterText)}"></div>
    <button class="chip c-ready ${activeChip === 'ready' ? 'active' : ''}" data-chip="ready">Ready (${totalReady})</button>
    <button class="chip c-close ${activeChip === 'close' ? 'active' : ''}" data-chip="close">Close (${totalClose})</button>
    <button class="chip c-blocked ${activeChip === 'blocked' ? 'active' : ''}" data-chip="blocked">Blocked (${totalBlocked})</button>
    <button class="chip c-nopo ${activeChip === 'nopo' ? 'active' : ''}" data-chip="nopo">No PO (${totalNoPo})</button>
    <button class="tbtn" id="btn-expand-all">Expand All</button>
    <button class="tbtn" id="btn-collapse-all">Collapse All</button>
    <div class="date-picker-wrap">
      <label>Project to:</label>
      <input type="date" id="projection-date" value="${projectionDate ? projectionDate.toISOString().slice(0,10) : ''}">
      ${projectionDate ? '<span class="proj-label">Projected</span>' : ''}
    </div>
  </div>`;

  // Render specs > machines
  reportData.specs.forEach(spec => {
    const machines = spec.machines || [];
    // Filter machines
    const filtered = machines.filter(m => {
      if (!machineMatchesChip(m, activeChip, projectionDate)) return false;
      if (filterText) {
        const node = m.node || m;
        // Also search direct machine.parts for loose parts nodes
        const extraParts = (!m.node && m.parts) ? m.parts : [];
        if (!nodeMatchesFilter(node, filterText) &&
            !extraParts.some(p => nodeMatchesFilter(p, filterText))) return false;
      }
      return true;
    });
    if (filtered.length === 0) return;

    html += `<div class="spec-section">`;
    html += `<div class="spec-header">Spec ${spec.specId} — ${escHtml(spec.specName)} (${spec.totalParts} BOM lines)</div>`;

    filtered.forEach(machine => {
      const node = machine.node || machine;
      const stats = projectedStats(node, projectionDate) || machine.stats;
      const cls = statusClass(stats ? stats.pct : 0);
      // For loose parts (node is the machine itself), check machine.parts directly
      const nodeChildren = node.children || [];
      const nodeParts = node.parts || machine.parts || [];
      const hasContent = nodeChildren.length > 0 || nodeParts.length > 0;

      html += `<div class="machine-block">`;
      // Machine header
      html += `<div class="machine-hdr ${cls}" data-expandable="${hasContent}">`;
      html += `<span class="m-arrow${hasContent ? '' : ' hidden'}">&#9654;</span>`;
      html += `<span class="m-icon">&#9881;</span>`;
      html += `<span class="m-pn">${escHtml(node.pn || machine.pn)}</span>`;
      if ((node.qty || machine.qty) > 1) html += `<span class="m-qty">&times;${node.qty || machine.qty}</span>`;
      html += `<span class="m-desc">${escHtml(node.desc || machine.desc)}</span>`;
      if (stats) {
        html += `<span class="m-stats">`;
        html += `<span class="m-bar"><span class="m-bar-fill ${cls}" style="width:${stats.pct}%"></span></span>`;
        html += `<span class="m-pct ${cls}">${stats.pct}%</span>`;
        html += `<span class="m-count">${stats.received}/${stats.total}</span>`;
        if (stats.noPO > 0) html += `<span class="m-nopo">${stats.noPO} no PO</span>`;
        html += `</span>`;
      }
      html += `</div>`;

      // Machine body (collapsed by default)
      if (hasContent) {
        html += `<div class="machine-body collapsed">`;
        const allItems = [...nodeChildren, ...nodeParts];
        const totalItems = allItems.length;
        let itemIdx = 0;
        // Sub-assemblies
        nodeChildren.forEach(c => {
          itemIdx++;
          html += renderTreeRow(c, 0, [], itemIdx === totalItems);
        });
        // Direct parts
        nodeParts.forEach(p => {
          itemIdx++;
          html += renderPartRow(p, 0, [], itemIdx === totalItems);
        });
        html += `</div>`;
      }
      html += `</div>`; // machine-block
    });

    html += `</div>`; // spec-section
  });

  if (!html.includes('machine-block')) {
    html += `<div class="center-message"><p>No assemblies match the current filters.</p></div>`;
  }

  el.innerHTML = html;
  wireReadinessEvents(el);
}

/**
 * Build a "guide prefix" — an array of segment types for tree connector lines.
 * Each segment is 'line' (vertical pass-through), 'blank' (no line), 'fork' (T-connector),
 * or 'branch' (L-connector, last child).
 *
 * @param {string[]} ancestorGuides — guide segments inherited from parent
 * @param {boolean} isLast — is this node the last child of its parent?
 */
function buildGuideHtml(ancestorGuides, isLast) {
  // Ancestor segments (vertical lines or blanks from higher levels)
  let html = '<span class="tr-guide">';
  ancestorGuides.forEach(seg => {
    html += `<span class="tr-guide-seg ${seg}"></span>`;
  });
  // This node's own connector
  html += `<span class="tr-guide-seg ${isLast ? 'branch' : 'fork'}"></span>`;
  html += '</span>';
  return html;
}

/** Get child guides to pass down to children (for ancestor lines) */
function childGuides(ancestorGuides, isLast) {
  return [...ancestorGuides, isLast ? 'blank' : 'line'];
}

/** Render an assembly row inside a machine (recursive) with tree connector lines */
function renderTreeRow(node, depth, ancestorGuides, isLast) {
  if (!node) return '';
  if (!node.isAssembly) return renderPartRow(node, depth, ancestorGuides, isLast);

  // Filter check
  if (filterText && !nodeMatchesFilter(node, filterText)) return '';

  const stats = projectedStats(node, projectionDate);
  const cls = statusClass(stats ? stats.pct : 0);
  const allItems = [...(node.children || []), ...(node.parts || [])];
  const hasChildren = allItems.length > 0;

  let html = `<div class="tr-node">`;
  html += `<div class="tr-row asm depth-${Math.min(depth, 2)}" data-expandable="${hasChildren}">`;
  html += buildGuideHtml(ancestorGuides, isLast);
  if (hasChildren) {
    html += `<span class="tr-arrow">&#9654;</span>`;
  } else {
    html += `<span class="tr-arrow-spacer"></span>`;
  }
  html += `<span class="tr-icon asm-icon">&#9634;</span>`;
  html += `<span class="tr-pn">${escHtml(node.pn)}</span>`;
  html += `<span class="tr-desc">${escHtml(node.desc)}</span>`;
  if (node.qty > 1) html += `<span class="tr-qty">&times;${node.qty}</span>`;
  if (stats) {
    html += `<span class="tr-stats">`;
    html += `<span class="tr-bar"><span class="tr-bar-fill ${cls}" style="width:${stats.pct}%"></span></span>`;
    html += `<span class="tr-pct ${cls}">${stats.pct}%</span>`;
    html += `<span class="tr-count">${stats.received}/${stats.total}</span>`;
    if (stats.noPO > 0) html += `<span class="m-nopo">${stats.noPO} no PO</span>`;
    html += `</span>`;
  }
  html += `</div>`;

  if (hasChildren) {
    const guides = childGuides(ancestorGuides, isLast);
    html += `<div class="tr-children collapsed">`;
    const filteredChildren = (node.children || []).filter(c => !filterText || nodeMatchesFilter(c, filterText));
    const filteredParts = (node.parts || []).filter(p => {
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return (p.pn||'').toLowerCase().includes(t) || (p.desc||'').toLowerCase().includes(t) ||
             (p.pos||[]).some(po => (po.supplier||'').toLowerCase().includes(t));
    });
    const totalFiltered = filteredChildren.length + filteredParts.length;
    let idx = 0;
    filteredChildren.forEach(c => { idx++; html += renderTreeRow(c, depth + 1, guides, idx === totalFiltered); });
    filteredParts.forEach(p => { idx++; html += renderPartRow(p, depth + 1, guides, idx === totalFiltered); });
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

/** Render a leaf part row with PO details and tree connector lines */
function renderPartRow(part, depth, ancestorGuides, isLast) {
  if (!part) return '';
  const st = partStatusAt(part, projectionDate);
  const statusLabel = st === 'received' ? 'Received' : st === 'ordered' ? 'On Order' : 'No PO';

  // Filter check
  if (filterText) {
    const t = filterText.toLowerCase();
    const match = (part.pn || '').toLowerCase().includes(t) ||
                  (part.desc || '').toLowerCase().includes(t) ||
                  (part.pos || []).some(po => (po.supplier || '').toLowerCase().includes(t));
    if (!match) return '';
  }

  // Chip filter for parts
  if (activeChip === 'nopo' && st !== 'noPO') return '';

  let html = `<div class="tr-row part">`;
  html += buildGuideHtml(ancestorGuides, isLast);
  html += `<span class="tr-arrow-spacer"></span>`;
  html += `<span class="tr-icon part-icon ${st}">&#9679;</span>`;
  html += `<span class="tr-pn">${escHtml(part.pn)}</span>`;
  html += `<span class="tr-desc">${escHtml(part.desc)}</span>`;
  if (part.qty > 1) html += `<span class="tr-qty">&times;${part.qty}</span>`;

  // Status + PO details on the right
  html += `<span class="tr-status">`;
  html += `<span class="tr-status-badge ${st}">${statusLabel}</span>`;
  if (part.pos && part.pos.length > 0) {
    const po = part.pos[0]; // primary PO line
    if (po.supplier) html += `<span class="tr-supplier" title="${escHtml(po.supplier)}">${escHtml(po.supplier)}</span>`;
    if (po.poId) html += `<span class="tr-po">PO#${po.poId}</span>`;
    if (po.dueDate) {
      const due = new Date(po.dueDate);
      const now = new Date();
      const days = Math.ceil((due - now) / 86400000);
      const dueCls = days < 0 ? 'overdue' : days <= 14 ? 'soon' : '';
      html += `<span class="tr-due ${dueCls}">${fmtDate(po.dueDate)}</span>`;
    }
  }
  html += `</span>`;
  html += `</div>`;
  return html;
}

/** Wire up all interactivity for the readiness view */
function wireReadinessEvents(container) {
  // Machine header expand/collapse
  container.querySelectorAll('.machine-hdr[data-expandable="true"]').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const arrow = hdr.querySelector('.m-arrow');
      const body = hdr.nextElementSibling;
      if (body && body.classList.contains('machine-body')) {
        body.classList.toggle('collapsed');
        arrow?.classList.toggle('open');
      }
    });
  });

  // Tree row expand/collapse
  container.querySelectorAll('.tr-row.asm[data-expandable="true"]').forEach(row => {
    row.addEventListener('click', () => {
      const arrow = row.querySelector('.tr-arrow');
      const children = row.nextElementSibling;
      if (children && children.classList.contains('tr-children')) {
        children.classList.toggle('collapsed');
        arrow?.classList.toggle('open');
      }
    });
  });

  // Search box
  const searchInput = container.querySelector('#readiness-search');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        filterText = searchInput.value.trim();
        renderReadinessView();
      }, 250);
    });
  }

  // Filter chips
  container.querySelectorAll('.chip[data-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.chip;
      activeChip = activeChip === val ? null : val;
      renderReadinessView();
    });
  });

  // Expand all
  const btnExpand = container.querySelector('#btn-expand-all');
  if (btnExpand) {
    btnExpand.addEventListener('click', () => {
      container.querySelectorAll('.machine-body.collapsed').forEach(b => b.classList.remove('collapsed'));
      container.querySelectorAll('.tr-children.collapsed').forEach(c => c.classList.remove('collapsed'));
      container.querySelectorAll('.m-arrow, .tr-arrow').forEach(a => a.classList.add('open'));
    });
  }

  // Collapse all
  const btnCollapse = container.querySelector('#btn-collapse-all');
  if (btnCollapse) {
    btnCollapse.addEventListener('click', () => {
      container.querySelectorAll('.machine-body').forEach(b => b.classList.add('collapsed'));
      container.querySelectorAll('.tr-children').forEach(c => c.classList.add('collapsed'));
      container.querySelectorAll('.m-arrow, .tr-arrow').forEach(a => a.classList.remove('open'));
    });
  }

  // Date projection picker
  const datePicker = container.querySelector('#projection-date');
  if (datePicker) {
    datePicker.addEventListener('change', () => {
      projectionDate = datePicker.value ? new Date(datePicker.value + 'T23:59:59') : null;
      renderReadinessView();
    });
  }
}

// ===== View 2: Full BOM Tree =====
function renderBomTreeView() {
  const el = document.getElementById('view-bom-tree');
  if (!reportData) return;

  let html = '';
  reportData.specs.forEach(spec => {
    html += `<div class="spec-section">`;
    html += `<div class="spec-header">Spec ${spec.specId} — ${escHtml(spec.specName)}</div>`;
    html += `<div class="bom-tree">`;
    if (spec.tree) {
      html += renderTreeNode(spec.tree, true);
    }
    html += `</div></div>`;
  });

  el.innerHTML = html;

  // Wire up toggles
  el.querySelectorAll('.tree-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const children = toggle.parentElement.querySelector('.tree-children');
      const arrow = toggle.querySelector('.tree-arrow');
      if (children) {
        children.classList.toggle('collapsed');
        arrow.classList.toggle('open');
      }
    });
  });
}

function renderTreeNode(node, expanded = false) {
  if (!node.isAssembly) {
    // Leaf part
    const dotClass = node.status || (node.receivedQty >= node.qty ? 'received' : node.poQty > 0 ? 'ordered' : 'noPO');
    let html = `<div class="tree-leaf">`;
    html += `<span class="status-dot ${dotClass}"></span>`;
    html += `<span class="tree-pn">${escHtml(node.pn)}</span>`;
    html += `<span class="tree-desc">${escHtml(node.desc)}</span>`;
    if (node.qty > 1) html += `<span class="card-qty">&times;${node.qty}</span>`;
    html += `</div>`;
    return html;
  }

  const cls = statusClass(node.stats.pct);
  let html = `<div class="tree-node">`;
  html += `<div class="tree-toggle">`;
  html += `<span class="tree-arrow ${expanded ? 'open' : ''}">&#9654;</span>`;
  html += `<span class="tree-pn">${escHtml(node.pn)}</span>`;
  html += `<span class="tree-desc">${escHtml(node.desc)}</span>`;
  if (node.qty > 1) html += `<span class="card-qty">&times;${node.qty}</span>`;
  html += `<span class="tree-tag asm">asm</span>`;
  html += `<span class="tree-tag pct card-pct ${cls}">${node.stats.pct}%</span>`;
  html += `</div>`;

  html += `<div class="tree-children ${expanded ? '' : 'collapsed'}">`;
  // Sub-assemblies first, then parts
  if (node.children) node.children.forEach(c => { html += renderTreeNode(c, false); });
  if (node.parts) node.parts.forEach(p => { html += renderTreeNode(p, false); });
  html += `</div></div>`;

  return html;
}

// ===== View 3: PO Action List =====
function renderPoActionsView() {
  const el = document.getElementById('view-po-actions');
  if (!reportData) return;

  const pa = reportData.poActions;
  let html = '';

  // No PO parts (highest urgency)
  const allNoPo = reportData.specs.flatMap(s => s.noPoParts || []);
  if (allNoPo.length > 0) {
    html += `<div class="po-section">`;
    html += `<div class="po-section-header"><span class="badge nopo">${allNoPo.length} PARTS</span> No Purchase Order</div>`;
    html += `<div class="nopo-list">`;
    allNoPo.forEach(p => {
      html += `<div class="nopo-item">`;
      html += `<div class="pn">${escHtml(p.pn)}</div>`;
      html += `<div class="desc">${escHtml(p.desc)}</div>`;
      if (p.qty > 1) html += `<div class="desc">Qty: ${p.qty}</div>`;
      html += `<div class="parent">Used in: ${escHtml(p.parentPN)} — ${escHtml(p.parentDesc)}</div>`;
      html += `</div>`;
    });
    html += `</div></div>`;
  }

  // Critical (overdue)
  if (pa.critical.length > 0) {
    html += renderPoSection('Critical — Overdue', 'critical', pa.critical);
  }
  // Warning
  if (pa.warning.length > 0) {
    html += renderPoSection('Warning — Due Within 14 Days', 'warning', pa.warning);
  }
  // On track
  if (pa.onTrack.length > 0) {
    html += renderPoSection('On Track', 'ontrack', pa.onTrack);
  }

  el.innerHTML = html || '<div class="center-message"><p>No outstanding POs found.</p></div>';

  // Wire up expand/collapse
  el.querySelectorAll('.po-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const details = header.parentElement.querySelector('.po-card-details');
      if (details) details.classList.toggle('hidden');
    });
  });
}

function renderPoSection(title, cls, entries) {
  let html = `<div class="po-section">`;
  html += `<div class="po-section-header"><span class="badge ${cls}">${entries.length}</span> ${title}</div>`;
  entries.forEach(entry => {
    const po = entry.po;
    const daysText = entry.worstDays < 0
      ? `${Math.abs(entry.worstDays)}d overdue`
      : entry.worstDays === 0
        ? 'Due today'
        : `Due in ${entry.worstDays}d`;
    const dueClass = entry.worstDays < 0 ? 'overdue' : entry.worstDays <= 14 ? 'soon' : '';

    html += `<div class="po-card ${cls}">`;
    html += `<div class="po-card-header">`;
    html += `<div><span class="po-supplier">${escHtml(entry.supplier)}</span> <span class="po-id">PO #${po.poId}</span></div>`;
    html += `<span class="po-due ${dueClass}">${daysText}</span>`;
    html += `</div>`;

    html += `<div class="po-card-details hidden">`;
    if (entry.email || entry.phone) {
      html += `<div class="supplier-contact">`;
      if (entry.email) html += `<a href="mailto:${escHtml(entry.email)}">${escHtml(entry.email)}</a> `;
      if (entry.phone) html += `<span>${escHtml(entry.phone)}</span>`;
      html += `</div>`;
    }
    html += `<div style="font-size:12px;color:var(--gray-500);margin-bottom:6px">Placed: ${fmtDate(po.poDate)}</div>`;
    html += `<table class="parts-table"><thead><tr><th>Part #</th><th>Description</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Due</th></tr></thead><tbody>`;
    po.parts.forEach(p => {
      html += `<tr>`;
      html += `<td class="pn">${escHtml(p.partNumber)}</td>`;
      html += `<td>${escHtml(p.partDesc)}</td>`;
      html += `<td>${p.qty}</td>`;
      html += `<td>${p.received}</td>`;
      html += `<td><strong>${p.remaining}</strong></td>`;
      html += `<td>${fmtDate(p.dueDate)}</td>`;
      html += `</tr>`;
    });
    html += `</tbody></table></div>`; // po-card-details
    html += `</div>`; // po-card
  });
  html += `</div>`;
  return html;
}

// ===== View 4: Draft Emails =====
function renderEmailsView() {
  const el = document.getElementById('view-emails');
  if (!emailData || !emailData.emails) return;

  const emails = emailData.emails;
  if (emails.length === 0) {
    el.innerHTML = '<div class="center-message"><p>No outstanding POs — no emails to draft.</p></div>';
    return;
  }

  let html = `<p style="margin-bottom:16px;color:var(--gray-500);font-size:13px">${emails.length} supplier follow-up emails ready to send</p>`;

  emails.forEach((em, idx) => {
    html += `<div class="email-card ${em.isOverdue ? 'overdue' : ''}">`;
    html += `<div class="email-header" data-idx="${idx}">`;
    html += `<div>`;
    html += `<span class="email-supplier-name">${escHtml(em.supplier)}</span>`;
    if (em.isOverdue) html += ` <span class="badge critical">Overdue</span>`;
    html += `</div>`;
    html += `<div class="email-meta">`;
    html += `<span>${em.poCount} PO${em.poCount > 1 ? 's' : ''}</span>`;
    if (em.email) html += `<span>${escHtml(em.email)}</span>`;
    html += `</div>`;
    html += `</div>`;

    html += `<div class="email-body-wrapper hidden" id="email-body-${idx}">`;
    html += `<div class="email-subject">Subject: ${escHtml(em.subject)}</div>`;
    html += `<div class="email-body" id="email-text-${idx}">${escHtml(em.body)}</div>`;
    html += `<div class="email-actions">`;
    html += `<button class="btn btn-copy" data-idx="${idx}">Copy to clipboard</button>`;
    if (em.email) {
      const mailto = `mailto:${encodeURIComponent(em.email)}?subject=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}`;
      html += `<a href="${mailto}" class="btn btn-primary">Open in Email</a>`;
    }
    html += `</div></div>`; // email-body-wrapper
    html += `</div>`; // email-card
  });

  el.innerHTML = html;

  // Wire up expand/collapse
  el.querySelectorAll('.email-header').forEach(header => {
    header.addEventListener('click', () => {
      const idx = header.dataset.idx;
      const body = document.getElementById(`email-body-${idx}`);
      if (body) body.classList.toggle('hidden');
    });
  });

  // Wire up copy buttons
  el.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = btn.dataset.idx;
      const text = document.getElementById(`email-text-${idx}`).textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy to clipboard';
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        btn.textContent = 'Copy failed';
      }
    });
  });
}
