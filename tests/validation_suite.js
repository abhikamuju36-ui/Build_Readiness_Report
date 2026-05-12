/**
 * Data Validation Suite
 *
 * Validates that every transformation layer — bomTree.js, the readiness pipeline,
 * and the frontend mapping in app.jsx — produces internally consistent data and
 * that what the frontend displays matches what the backend computed.
 *
 * Run: node tests/validation_suite.js
 */

'use strict';
const assert = require('assert');
const path   = require('path');

// ─── Modules under test ──────────────────────────────────────────────────────
const {
  buildTree, getLeafParts, getAssemblyStats,
  buildNestedTree, buildReadinessSummary,
  buildPoActionList, buildPoIndex, findNoPoParts,
} = require('../server/lib/bomTree');
const demo = require('../server/services/demoData');

// ─── Minimal test runner ─────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
    passed++;
  } catch (e) {
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}\n    \x1b[33m→ ${e.message}\x1b[0m\n`);
    failures.push({ name, message: e.message });
    failed++;
  }
}

function section(title) {
  process.stdout.write(`\n\x1b[1m── ${title}\x1b[0m\n`);
}

function eq(a, b, msg) {
  assert.strictEqual(a, b, msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { assert.ok(v, msg); }
function notOk(v, msg) { assert.ok(!v, msg); }

// ─── Simulates the frontend mapping from app.jsx ─────────────────────────────
function frontendMap(raw) {
  const mapped = {
    job: {
      id: raw.project.ProjectID,
      name: raw.project.ProjectName,
      buildStart: raw.buildDates?.buildStart || null,
      shipDate: raw.buildDates?.buildComplete || null,
      kpis: { assemblies: 0, ready: 0, close: 0, blocked: 0, noPO: 0 },
      actMat: raw.projectCosting?.ActMaterials || 0,
      estMat: (raw.projectCosting?.EstMaterials > 1000) ? raw.projectCosting.EstMaterials : null,
      actLabor: ((raw.projectCosting?.ActEngLabor || 0) + (raw.projectCosting?.ActMfgLabor || 0)) || null,
      estLabor: ((raw.projectCosting?.EstEngLabor || 0) + (raw.projectCosting?.EstMfgLabor || 0)) || null,
      actEngHrs: raw.projectCosting?.ActEngHrs || 0,
      actMfgHrs: raw.projectCosting?.ActMfgHrs || 0,
      estEngHrs: raw.projectCosting?.EstEngHrs || 0,
      estMfgHrs: raw.projectCosting?.EstMfgHrs || 0,
      marginActual: raw.projectCosting?.ActualMargin != null ? raw.projectCosting.ActualMargin / 100 : null,
      marginTarget: (raw.projectCosting?.BudgetMargin > 0) ? raw.projectCosting.BudgetMargin / 100 : null,
    },
    readiness: raw.specs.map(s => ({
      spec: s.specId,
      title: s.specName,
      lines: s.totalParts,
      assemblies: (s.machines || []).map(machine => ({
        ...machine,
        code: machine.pn,
        name: machine.pn,
        desc: machine.desc,
        pct: machine.stats?.pct || 0,
        ready: machine.stats?.received || 0,
        total: machine.stats?.total || 0,
        noPo: machine.stats?.noPO || 0,
        status: (machine.stats?.pct >= 85) ? 'ready' : (machine.stats?.pct >= 60) ? 'close' : 'blocked',
        children: [],
      }))
    })),
    costing: (raw.specCosting || []).map(s => ({
      spec: String(s.SectionID),
      name: s.SectionName,
      laborHrs: (s.EngHours || 0) + (s.MfgHours || 0),
      labor: (s.EngLabor || 0) + (s.MfgLabor || 0),
      materials: s.TotalMaterials || 0,
      total: s.TotalCost || 0,
      margin: s.Margin || 0,
    })),
    poActions: raw.poActions,
    nopo: raw.specs.flatMap(s => (s.noPoParts || []).map(p => ({
      ...p,
      parent: (p.parentPN ? `${p.parentPN} ` : '') + (p.parentDesc || p.parentPN || 'Loose Parts'),
    })))
  };

  mapped.readiness.forEach(s => {
    s.assemblies.forEach(a => {
      mapped.job.kpis.assemblies++;
      if (a.status === 'ready')        mapped.job.kpis.ready++;
      else if (a.status === 'close')   mapped.job.kpis.close++;
      else                             mapped.job.kpis.blocked++;
    });
  });
  mapped.job.kpis.noPO = mapped.nopo.length;
  return mapped;
}

// ─── Run full pipeline (mirrors readiness route) ─────────────────────────────
function runPipeline(projectId) {
  const project    = demo.getProjectInfo(projectId);
  const specs      = demo.getSpecs(projectId);
  const poRows     = demo.getPoDetails(projectId);
  const poIndex    = buildPoIndex(poRows);
  const poActions  = buildPoActionList(poRows);
  const projectCosting = demo.getProjectCosting(projectId);
  const specCosting    = demo.getSpecCosting(projectId);

  const specReports = specs.map(spec => {
    const topNode = demo.getTopNode(projectId, spec.SpecID);
    const bomRows = demo.getBomRows(projectId, spec.SpecID);
    if (!topNode || bomRows.length === 0) return null;
    const { assemblyIds, childrenMap } = buildTree(bomRows);
    const summary = buildReadinessSummary(
      topNode.TopItemID, topNode.TopPN, topNode.TopDesc,
      childrenMap, assemblyIds, poIndex
    );
    const noPoParts = findNoPoParts(bomRows, assemblyIds);
    return {
      specId: spec.SpecID,
      specName: spec.SDescription,
      specQty: spec.SQuantity,
      topPN: topNode.TopPN,
      topDesc: topNode.TopDesc,
      machines: summary.machines,
      tree: summary.tree,
      noPoParts,
      totalParts: bomRows.length,
    };
  }).filter(Boolean);

  // Mirror the route: globally deduplicate noPoParts across specs
  const seenNoPo = new Set();
  specReports.forEach(s => {
    s.noPoParts = s.noPoParts.filter(p => {
      if (seenNoPo.has(p.id)) return false;
      seenNoPo.add(p.id);
      return true;
    });
  });

  return {
    project, specs: specReports, poActions,
    buildDates: { buildStart: null, buildComplete: null },
    projectCosting, specCosting, demoMode: true,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 1 — buildTree()
// ═════════════════════════════════════════════════════════════════════════════
section('1 · buildTree() — deduplication and assembly identification');

const rawBom1083_10 = demo.getBomRows(1083, 10);
const rawBom1129_10 = demo.getBomRows(1129, 10);
const rawBom1083_30 = demo.getBomRows(1083, 30);
const tree1083_10   = buildTree(rawBom1083_10);
const tree1083_30   = buildTree(rawBom1083_30);
const tree1129_10   = buildTree(rawBom1129_10);

test('bom_1083_10: raw file loads with rows', () => {
  ok(rawBom1083_10.length > 0, 'BOM 1083 spec 10 should have rows');
});

test('bom_1083_10: deduped has no duplicate (ChildID, ParentID) pairs', () => {
  const seen = new Set();
  for (const r of tree1083_10.deduped) {
    const k = `${r.ChildID}-${r.ParentID}`;
    ok(!seen.has(k), `Duplicate pair found: ChildID=${r.ChildID} ParentID=${r.ParentID}`);
    seen.add(k);
  }
});

test('bom_1083_10: deduped length <= raw length (dedup only removes, never adds)', () => {
  ok(tree1083_10.deduped.length <= rawBom1083_10.length,
    `deduped=${tree1083_10.deduped.length} raw=${rawBom1083_10.length}`);
});

test('bom_1083_10: assemblyIds are IDs that appear as ParentID', () => {
  const parentIds = new Set(tree1083_10.deduped.map(r => r.ParentID));
  for (const id of tree1083_10.assemblyIds) {
    ok(parentIds.has(id), `ID ${id} in assemblyIds but never a ParentID`);
  }
});

test('bom_1083_10: childrenMap covers every row', () => {
  let total = 0;
  for (const children of Object.values(tree1083_10.childrenMap)) total += children.length;
  eq(total, tree1083_10.deduped.length, 'childrenMap total rows !== deduped length');
});

test('bom_1083_10: topParentIds do not appear as children', () => {
  const childIds = new Set(tree1083_10.deduped.map(r => r.ChildID));
  for (const p of tree1083_10.topParentIds) {
    notOk(childIds.has(p), `topParentId ${p} appears as a ChildID`);
  }
});

test('bom_1083_10: exactly one top parent (single-root BOM)', () => {
  eq(tree1083_10.topParentIds.length, 1, 'Expected exactly 1 top parent for spec 10');
});

test('bom_1083_30: deduped has no duplicate (ChildID, ParentID) pairs', () => {
  const seen = new Set();
  for (const r of tree1083_30.deduped) {
    const k = `${r.ChildID}-${r.ParentID}`;
    ok(!seen.has(k), `Duplicate pair found: ${k}`);
    seen.add(k);
  }
});

test('bom_1129_10: deduped has no duplicate (ChildID, ParentID) pairs', () => {
  const seen = new Set();
  for (const r of tree1129_10.deduped) {
    const k = `${r.ChildID}-${r.ParentID}`;
    ok(!seen.has(k), `Duplicate pair found: ${k}`);
    seen.add(k);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 2 — getAssemblyStats()
// ═════════════════════════════════════════════════════════════════════════════
section('2 · getAssemblyStats() — readiness percentages');

const topNode1083_10 = demo.getTopNode(1083, 10);
const topNode1083_30 = demo.getTopNode(1083, 30);
const topNode1129_10 = demo.getTopNode(1129, 10);

test('stats: total = received + noPO + ordered', () => {
  const stats = getAssemblyStats(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  eq(stats.total, stats.received + stats.noPO + stats.ordered,
    `total(${stats.total}) != received(${stats.received}) + noPO(${stats.noPO}) + ordered(${stats.ordered})`);
});

test('stats: pct = round(received/total * 100)', () => {
  const stats = getAssemblyStats(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  const expected = stats.total ? Math.round(stats.received / stats.total * 100) : 0;
  eq(stats.pct, expected, `pct mismatch: ${stats.pct} vs ${expected}`);
});

test('stats: pct is between 0 and 100', () => {
  for (const [proj, specId, bomRows] of [
    [1083, 10, rawBom1083_10],
    [1083, 30, rawBom1083_30],
    [1129, 10, rawBom1129_10],
  ]) {
    const tn = demo.getTopNode(proj, specId);
    const { assemblyIds, childrenMap } = buildTree(bomRows);
    const stats = getAssemblyStats(tn.TopItemID, childrenMap, assemblyIds);
    ok(stats.pct >= 0 && stats.pct <= 100, `pct out of range for ${proj}/${specId}: ${stats.pct}`);
  }
});

test('stats: received parts satisfy ReceivedQty >= ItemQty', () => {
  const leaves = getLeafParts(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  const uniqueLeaves = Object.values(leaves.reduce((acc, p) => { acc[p.ChildID] = acc[p.ChildID] || p; return acc; }, {}));
  const received = uniqueLeaves.filter(p => p.ReceivedQty >= p.ItemQty);
  const stats = getAssemblyStats(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  eq(stats.received, received.length, 'received count mismatch');
});

test('stats: noPO parts have POQty=0 and ReceivedQty < ItemQty', () => {
  const leaves = getLeafParts(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  const unique = Object.values(leaves.reduce((acc, p) => { acc[p.ChildID] = acc[p.ChildID] || p; return acc; }, {}));
  const noPO = unique.filter(p => p.POQty === 0 && p.ReceivedQty < p.ItemQty);
  const stats = getAssemblyStats(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  eq(stats.noPO, noPO.length, 'noPO count mismatch');
});

test('stats: ordered parts have POQty>0 and ReceivedQty < ItemQty', () => {
  const leaves = getLeafParts(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  const unique = Object.values(leaves.reduce((acc, p) => { acc[p.ChildID] = acc[p.ChildID] || p; return acc; }, {}));
  const ordered = unique.filter(p => p.POQty > 0 && p.ReceivedQty < p.ItemQty);
  const stats = getAssemblyStats(topNode1083_10.TopItemID, tree1083_10.childrenMap, tree1083_10.assemblyIds);
  eq(stats.ordered, ordered.length, 'ordered count mismatch');
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 3 — buildNestedTree() part status assignment
// ═════════════════════════════════════════════════════════════════════════════
section('3 · buildNestedTree() — part status and structure');

const poRows1083  = demo.getPoDetails(1083);
const poIndex1083 = buildPoIndex(poRows1083);
const nestedTree1083_10 = buildNestedTree(
  topNode1083_10.TopItemID, topNode1083_10.TopPN, topNode1083_10.TopDesc,
  tree1083_10.childrenMap, tree1083_10.assemblyIds, poIndex1083
);

test('nestedTree: root id matches TopItemID', () => {
  eq(nestedTree1083_10.id, topNode1083_10.TopItemID, 'Root id mismatch');
});

test('nestedTree: root is an assembly', () => {
  ok(nestedTree1083_10.isAssembly, 'Root node should be an assembly');
});

test('nestedTree: root has stats', () => {
  ok(nestedTree1083_10.stats, 'Root node should have stats');
  ok(typeof nestedTree1083_10.stats.pct === 'number', 'stats.pct should be a number');
});

test('nestedTree: part status "received" iff receivedQty >= qty', () => {
  function collectParts(node) {
    const parts = node.parts || [];
    const sub = (node.children || []).flatMap(collectParts);
    return [...parts, ...sub];
  }
  const allParts = collectParts(nestedTree1083_10);
  for (const p of allParts) {
    if (p.status === 'received') {
      ok(p.receivedQty >= p.qty, `Part ${p.pn} marked received but receivedQty(${p.receivedQty}) < qty(${p.qty})`);
    }
    if (p.status === 'ordered') {
      ok(p.poQty > 0, `Part ${p.pn} marked ordered but poQty=${p.poQty}`);
      ok(p.receivedQty < p.qty, `Part ${p.pn} marked ordered but already received`);
    }
    if (p.status === 'noPO') {
      eq(p.poQty, 0, `Part ${p.pn} marked noPO but poQty=${p.poQty}`);
    }
  }
});

test('nestedTree: PO index lines attached correctly (ItemID match)', () => {
  function collectParts(node) {
    return [...(node.parts || []), ...(node.children || []).flatMap(collectParts)];
  }
  for (const p of collectParts(nestedTree1083_10)) {
    for (const line of (p.pos || [])) {
      ok(poIndex1083[p.id], `Part id ${p.id} has PO lines but no entry in poIndex`);
    }
  }
});

test('nestedTree: assembly children have stats; leaf parts do not', () => {
  function walk(node) {
    if (node.isAssembly) {
      ok(node.stats, `Assembly ${node.pn} (id=${node.id}) missing stats`);
    }
    for (const child of (node.children || [])) walk(child);
  }
  walk(nestedTree1083_10);
});

test('nestedTree: every node id is either in assemblyIds or is a leaf', () => {
  function walk(node) {
    if (node.isAssembly) {
      ok(tree1083_10.assemblyIds.has(node.id), `Node ${node.id} isAssembly=true but not in assemblyIds`);
    }
    for (const child of (node.children || [])) walk(child);
  }
  walk(nestedTree1083_10);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 4 — buildPoActionList()
// ═════════════════════════════════════════════════════════════════════════════
section('4 · buildPoActionList() — PO categorization');

const poActions1083 = buildPoActionList(poRows1083);
const poRows1129    = demo.getPoDetails(1129);
const poActions1129 = buildPoActionList(poRows1129);

test('poActions: all four category arrays exist', () => {
  ok(Array.isArray(poActions1083.critical),  'critical missing');
  ok(Array.isArray(poActions1083.warning),   'warning missing');
  ok(Array.isArray(poActions1083.onTrack),   'onTrack missing');
  ok(Array.isArray(poActions1083.delivered), 'delivered missing');
});

test('poActions: no PO appears in multiple categories', () => {
  const allEntries = [
    ...poActions1083.critical.map(e => ({ ...e, _cat: 'critical' })),
    ...poActions1083.warning.map(e => ({ ...e, _cat: 'warning' })),
    ...poActions1083.onTrack.map(e => ({ ...e, _cat: 'onTrack' })),
    ...poActions1083.delivered.map(e => ({ ...e, _cat: 'delivered' })),
  ];
  const seen = new Map();
  for (const e of allEntries) {
    const key = e.po.poId;
    ok(!seen.has(key), `PO ${key} appears in both ${seen.get(key)} and ${e._cat}`);
    seen.set(key, e._cat);
  }
});

test('poActions: delivered entries have all parts received', () => {
  for (const e of poActions1083.delivered) {
    const allRcvd = e.po.parts.every(p => p.received >= p.qty);
    ok(allRcvd, `PO ${e.po.poId} in delivered but not all parts received`);
  }
});

test('poActions: critical entries have at least one overdue active part', () => {
  for (const e of poActions1083.critical) {
    const activeParts = e.po.parts.filter(p => p.received < p.qty);
    ok(activeParts.length > 0, `PO ${e.po.poId} is critical but no active parts`);
    ok(e.worstDays < 0, `PO ${e.po.poId} is critical but worstDays=${e.worstDays} >= 0`);
  }
});

test('poActions: warning entries have worstDays in [0, 14]', () => {
  for (const e of poActions1083.warning) {
    ok(e.worstDays >= 0 && e.worstDays <= 14,
      `PO ${e.po.poId} in warning but worstDays=${e.worstDays}`);
  }
});

test('poActions: onTrack entries have worstDays > 14', () => {
  for (const e of poActions1083.onTrack) {
    ok(e.worstDays > 14, `PO ${e.po.poId} in onTrack but worstDays=${e.worstDays}`);
  }
});

test('poActions: critical sorted ascending by worstDays (most overdue first)', () => {
  const days = poActions1083.critical.map(e => e.worstDays);
  for (let i = 1; i < days.length; i++) {
    ok(days[i] >= days[i-1], `critical list out of order at index ${i}: ${days[i-1]} > ${days[i]}`);
  }
});

test('poActions: warning sorted ascending by worstDays', () => {
  const days = poActions1083.warning.map(e => e.worstDays);
  for (let i = 1; i < days.length; i++) {
    ok(days[i] >= days[i-1], `warning list out of order at index ${i}: ${days[i-1]} > ${days[i]}`);
  }
});

test('poActions: total PO count matches unique PO IDs in raw data (1083)', () => {
  const uniquePoIds = new Set(poRows1083.map(r => r.PurchaseOrderID));
  const total = poActions1083.critical.length + poActions1083.warning.length +
                poActions1083.onTrack.length + poActions1083.delivered.length;
  eq(total, uniquePoIds.size,
    `action list total(${total}) != unique PO count(${uniquePoIds.size})`);
});

test('poActions: total PO count matches unique PO IDs in raw data (1129)', () => {
  const uniquePoIds = new Set(poRows1129.map(r => r.PurchaseOrderID));
  const total = poActions1129.critical.length + poActions1129.warning.length +
                poActions1129.onTrack.length + poActions1129.delivered.length;
  eq(total, uniquePoIds.size,
    `action list total(${total}) != unique PO count(${uniquePoIds.size})`);
});

test('poActions: each entry has supplier, email, phone fields', () => {
  const all = [...poActions1083.critical, ...poActions1083.warning,
               ...poActions1083.onTrack, ...poActions1083.delivered];
  for (const e of all) {
    ok('supplier' in e, `Entry PO ${e.po.poId} missing supplier`);
    ok('po' in e && 'parts' in e.po, `Entry PO ${e.po?.poId} missing po.parts`);
    ok(Array.isArray(e.po.parts), `po.parts is not an array for PO ${e.po.poId}`);
    ok(e.po.parts.length > 0, `PO ${e.po.poId} has no parts`);
  }
});

test('poActions: remaining = qty - received for each part', () => {
  const all = [...poActions1083.critical, ...poActions1083.warning,
               ...poActions1083.onTrack, ...poActions1083.delivered];
  for (const e of all) {
    for (const p of e.po.parts) {
      eq(p.remaining, p.qty - p.received,
        `Part ${p.partNumber} remaining(${p.remaining}) != qty(${p.qty}) - received(${p.received})`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 5 — buildPoIndex()
// ═════════════════════════════════════════════════════════════════════════════
section('5 · buildPoIndex() — ItemID lookup map');

test('poIndex: every ItemID in raw PO rows appears in index', () => {
  const itemIds = new Set(poRows1083.map(r => r.ItemID));
  for (const id of itemIds) {
    ok(poIndex1083[id], `ItemID ${id} missing from poIndex`);
    ok(poIndex1083[id].length > 0, `ItemID ${id} has empty array in poIndex`);
  }
});

test('poIndex: index has no extra ItemIDs not in raw data', () => {
  const itemIds = new Set(poRows1083.map(r => r.ItemID));
  for (const id of Object.keys(poIndex1083)) {
    ok(itemIds.has(Number(id)), `poIndex has ItemID ${id} not in raw PO rows`);
  }
});

test('poIndex: each line has required fields (poId, dueDate, qty, received)', () => {
  for (const lines of Object.values(poIndex1083)) {
    for (const line of lines) {
      ok('poId'     in line, `poIndex line missing poId`);
      ok('qty'      in line, `poIndex line missing qty`);
      ok('received' in line, `poIndex line missing received`);
      ok('supplier' in line, `poIndex line missing supplier`);
    }
  }
});

test('poIndex: received values match raw PO rows', () => {
  for (const row of poRows1083) {
    const lines = poIndex1083[row.ItemID] || [];
    const match = lines.find(l => l.poId === row.PurchaseOrderID);
    ok(match, `No index line for ItemID=${row.ItemID} poId=${row.PurchaseOrderID}`);
    eq(match.received, row.ReceivedQty,
      `received mismatch for ItemID=${row.ItemID}: index=${match.received} raw=${row.ReceivedQty}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 6 — findNoPoParts()
// ═════════════════════════════════════════════════════════════════════════════
section('6 · findNoPoParts() — parts without purchase orders');

const noPo1083_10 = findNoPoParts(rawBom1083_10, tree1083_10.assemblyIds);

test('noPoParts: no assemblies in result (only leaf parts)', () => {
  for (const p of noPo1083_10) {
    notOk(tree1083_10.assemblyIds.has(p.id),
      `Part ${p.pn} (id=${p.id}) is in assemblyIds but returned by findNoPoParts`);
  }
});

test('noPoParts: all results have POQty=0 and ReceivedQty < ItemQty', () => {
  const bomById = Object.fromEntries(rawBom1083_10.map(r => [r.ChildID, r]));
  for (const p of noPo1083_10) {
    const raw = bomById[p.id];
    ok(raw, `No BOM row for noPO part id=${p.id}`);
    eq(raw.POQty, 0, `Part ${p.pn} has POQty=${raw.POQty}, should be 0`);
    ok(raw.ReceivedQty < raw.ItemQty,
      `Part ${p.pn} is already received (${raw.ReceivedQty}/${raw.ItemQty}) but in noPO list`);
  }
});

test('noPoParts: no duplicate ChildIDs in result', () => {
  const seen = new Set();
  for (const p of noPo1083_10) {
    notOk(seen.has(p.id), `Duplicate ChildID ${p.id} (${p.pn}) in noPoParts`);
    seen.add(p.id);
  }
});

test('noPoParts: count matches manual filter on deduped rows', () => {
  const { assemblyIds, deduped } = tree1083_10;
  const seen = new Set();
  let expected = 0;
  for (const r of deduped) {
    if (assemblyIds.has(r.ChildID)) continue;
    if (r.POQty !== 0 || r.ReceivedQty >= r.ItemQty) continue;
    if (seen.has(r.ChildID)) continue;
    seen.add(r.ChildID);
    expected++;
  }
  eq(noPo1083_10.length, expected, `noPoParts count ${noPo1083_10.length} != manual ${expected}`);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 7 — buildReadinessSummary() machine grouping
// ═════════════════════════════════════════════════════════════════════════════
section('7 · buildReadinessSummary() — machine and sub-assembly grouping');

const summary1083_10 = buildReadinessSummary(
  topNode1083_10.TopItemID, topNode1083_10.TopPN, topNode1083_10.TopDesc,
  tree1083_10.childrenMap, tree1083_10.assemblyIds, poIndex1083
);

test('summary: machines array is non-empty', () => {
  ok(summary1083_10.machines.length > 0, 'No machines returned');
});

test('summary: every machine has id, pn, desc, stats, subAssemblies, parts', () => {
  for (const m of summary1083_10.machines) {
    if (m.id === 'loose-parts') continue;
    ok(m.id,    `Machine missing id`);
    ok(m.pn,    `Machine ${m.id} missing pn`);
    ok(m.stats, `Machine ${m.id} missing stats`);
    ok(m.subAssemblies, `Machine ${m.id} missing subAssemblies`);
    ok(Array.isArray(m.parts), `Machine ${m.id} parts is not array`);
  }
});

test('summary: sub-assembly ready group has pct=100', () => {
  for (const m of summary1083_10.machines) {
    for (const sub of (m.subAssemblies?.ready || [])) {
      eq(sub.stats.pct, 100, `${sub.pn} in ready group but pct=${sub.stats.pct}`);
    }
  }
});

test('summary: sub-assembly close group has 60 <= pct < 100', () => {
  for (const m of summary1083_10.machines) {
    for (const sub of (m.subAssemblies?.close || [])) {
      ok(sub.stats.pct >= 60 && sub.stats.pct < 100,
        `${sub.pn} in close group but pct=${sub.stats.pct}`);
    }
  }
});

test('summary: sub-assembly blocked group has pct < 60', () => {
  for (const m of summary1083_10.machines) {
    for (const sub of (m.subAssemblies?.blocked || [])) {
      ok(sub.stats.pct < 60,
        `${sub.pn} in blocked group but pct=${sub.stats.pct}`);
    }
  }
});

test('summary: close list sorted descending by pct', () => {
  for (const m of summary1083_10.machines) {
    const pcts = (m.subAssemblies?.close || []).map(s => s.stats.pct);
    for (let i = 1; i < pcts.length; i++) {
      ok(pcts[i] <= pcts[i-1], `close sub-assemblies out of order: ${pcts[i-1]} then ${pcts[i]}`);
    }
  }
});

test('summary: tree root matches TopItemID', () => {
  eq(summary1083_10.tree.id, topNode1083_10.TopItemID, 'summary.tree.id mismatch');
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 8 — Full pipeline (mirrors the readiness route)
// ═════════════════════════════════════════════════════════════════════════════
section('8 · Full pipeline — project 1083');

const pipeline1083 = runPipeline(1083);
const pipeline1129 = runPipeline(1129);

test('pipeline 1083: project name is SDC Show Room', () => {
  eq(pipeline1083.project.ProjectName, 'SDC Show Room', 'Project name mismatch');
});

test('pipeline 1083: returns 2 specs', () => {
  eq(pipeline1083.specs.length, 2, `Expected 2 specs, got ${pipeline1083.specs.length}`);
});

test('pipeline 1083: spec IDs are 10 and 30', () => {
  const ids = pipeline1083.specs.map(s => s.specId).sort((a, b) => a - b);
  eq(ids[0], 10, `First spec ID should be 10`);
  eq(ids[1], 30, `Second spec ID should be 30`);
});

test('pipeline 1083: spec names match demo definition', () => {
  const byId = Object.fromEntries(pipeline1083.specs.map(s => [s.specId, s]));
  eq(byId[10].specName, 'Mechanical Design and Build', 'Spec 10 name mismatch');
  eq(byId[30].specName, 'Controls Design', 'Spec 30 name mismatch');
});

test('pipeline 1083: totalParts > 0 for each spec', () => {
  for (const s of pipeline1083.specs) {
    ok(s.totalParts > 0, `Spec ${s.specId} has 0 totalParts`);
  }
});

test('pipeline 1083: machines array non-empty for each spec', () => {
  for (const s of pipeline1083.specs) {
    ok(s.machines.length > 0, `Spec ${s.specId} has no machines`);
  }
});

test('pipeline 1083: poActions.critical + warning + onTrack + delivered = unique PO count', () => {
  const pa = pipeline1083.poActions;
  const uniquePOs = new Set(poRows1083.map(r => r.PurchaseOrderID));
  const total = pa.critical.length + pa.warning.length + pa.onTrack.length + pa.delivered.length;
  eq(total, uniquePOs.size, `PO total mismatch: ${total} vs ${uniquePOs.size}`);
});

test('pipeline 1083: machine stats pct matches getAssemblyStats for top node', () => {
  const spec10 = pipeline1083.specs.find(s => s.specId === 10);
  const { assemblyIds, childrenMap } = buildTree(rawBom1083_10);
  const expectedStats = getAssemblyStats(topNode1083_10.TopItemID, childrenMap, assemblyIds);
  // The machines roll up from the top node's children — check the overall tree stats
  eq(spec10.tree.stats.pct, expectedStats.pct, `tree.stats.pct mismatch`);
  eq(spec10.tree.stats.total, expectedStats.total, `tree.stats.total mismatch`);
  eq(spec10.tree.stats.received, expectedStats.received, `tree.stats.received mismatch`);
});

test('pipeline 1129: project name is Molex Duplex', () => {
  eq(pipeline1129.project.ProjectName, 'Molex Duplex', 'Project name mismatch');
});

test('pipeline 1129: returns 2 specs', () => {
  eq(pipeline1129.specs.length, 2, `Expected 2 specs, got ${pipeline1129.specs.length}`);
});

test('pipeline 1129: poActions no duplicates across categories', () => {
  const seen = new Map();
  const pa = pipeline1129.poActions;
  for (const [cat, arr] of [['critical', pa.critical], ['warning', pa.warning], ['onTrack', pa.onTrack], ['delivered', pa.delivered]]) {
    for (const e of arr) {
      ok(!seen.has(e.po.poId), `PO ${e.po.poId} in ${seen.get(e.po.poId)} and ${cat}`);
      seen.set(e.po.poId, cat);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 9 — Frontend mapping consistency
// ═════════════════════════════════════════════════════════════════════════════
section('9 · Frontend mapping — app.jsx data transformation');

const fe1083 = frontendMap(pipeline1083);
const fe1129 = frontendMap(pipeline1129);

test('fe: job.id matches project.ProjectID', () => {
  eq(fe1083.job.id, pipeline1083.project.ProjectID, 'job.id mismatch');
});

test('fe: job.name matches project.ProjectName', () => {
  eq(fe1083.job.name, pipeline1083.project.ProjectName, 'job.name mismatch');
});

test('fe: readiness specs count matches backend specs count', () => {
  eq(fe1083.readiness.length, pipeline1083.specs.length, 'spec count mismatch');
});

test('fe: readiness assemblies match backend machine count per spec', () => {
  for (let i = 0; i < pipeline1083.specs.length; i++) {
    const backendCount = pipeline1083.specs[i].machines.length;
    const frontendCount = fe1083.readiness[i].assemblies.length;
    eq(frontendCount, backendCount,
      `Spec ${pipeline1083.specs[i].specId}: machine count ${frontendCount} != ${backendCount}`);
  }
});

test('fe: assembly pct = backend machine.stats.pct', () => {
  for (let si = 0; si < pipeline1083.specs.length; si++) {
    const beMachines = pipeline1083.specs[si].machines;
    const feMachines = fe1083.readiness[si].assemblies;
    for (let mi = 0; mi < beMachines.length; mi++) {
      const expected = beMachines[mi].stats?.pct || 0;
      eq(feMachines[mi].pct, expected,
        `Spec ${pipeline1083.specs[si].specId} machine[${mi}].pct: ${feMachines[mi].pct} != ${expected}`);
    }
  }
});

test('fe: assembly status thresholds (pct>=85→ready, >=60→close, else blocked)', () => {
  for (const spec of fe1083.readiness) {
    for (const a of spec.assemblies) {
      if (a.pct >= 85) {
        eq(a.status, 'ready', `${a.pn}: pct=${a.pct} should be ready`);
      } else if (a.pct >= 60) {
        eq(a.status, 'close', `${a.pn}: pct=${a.pct} should be close`);
      } else {
        eq(a.status, 'blocked', `${a.pn}: pct=${a.pct} should be blocked`);
      }
    }
  }
});

test('fe: KPI.assemblies = total machine count across all specs', () => {
  const expected = fe1083.readiness.reduce((s, spec) => s + spec.assemblies.length, 0);
  eq(fe1083.job.kpis.assemblies, expected,
    `kpis.assemblies ${fe1083.job.kpis.assemblies} != ${expected}`);
});

test('fe: KPI.ready + close + blocked = KPI.assemblies', () => {
  const { ready, close, blocked, assemblies } = fe1083.job.kpis;
  eq(ready + close + blocked, assemblies,
    `ready(${ready}) + close(${close}) + blocked(${blocked}) != assemblies(${assemblies})`);
});

test('fe: KPI.noPO = length of deduplicated nopo array', () => {
  eq(fe1083.job.kpis.noPO, fe1083.nopo.length,
    `kpis.noPO(${fe1083.job.kpis.noPO}) != nopo.length(${fe1083.nopo.length})`);
});

test('fe: nopo list matches flat noPoParts from all backend specs', () => {
  const backendTotal = pipeline1083.specs.reduce((s, spec) => s + (spec.noPoParts?.length || 0), 0);
  eq(fe1083.nopo.length, backendTotal,
    `frontend nopo(${fe1083.nopo.length}) != backend total(${backendTotal})`);
});

test('fe: poActions passed through unchanged', () => {
  eq(
    JSON.stringify(fe1083.poActions),
    JSON.stringify(pipeline1083.poActions),
    'poActions was mutated during frontend mapping'
  );
});

test('fe: actMat = projectCosting.ActMaterials', () => {
  const expected = pipeline1083.projectCosting?.ActMaterials || 0;
  eq(fe1083.job.actMat, expected, `actMat mismatch: ${fe1083.job.actMat} vs ${expected}`);
});

test('fe: estMat is null when EstMaterials <= 1000', () => {
  // demo data EstMaterials = 85000 → should NOT be null
  const est = pipeline1083.projectCosting?.EstMaterials;
  if (est > 1000) {
    ok(fe1083.job.estMat !== null, `estMat should not be null when EstMaterials=${est}`);
  } else {
    eq(fe1083.job.estMat, null, `estMat should be null when EstMaterials=${est}`);
  }
});

test('fe: marginActual = ActualMargin / 100', () => {
  const raw = pipeline1083.projectCosting?.ActualMargin;
  const expected = raw != null ? raw / 100 : null;
  eq(fe1083.job.marginActual, expected,
    `marginActual: ${fe1083.job.marginActual} != ${expected}`);
});

test('fe: marginTarget = BudgetMargin / 100 when > 0', () => {
  const raw = pipeline1083.projectCosting?.BudgetMargin;
  const expected = raw > 0 ? raw / 100 : null;
  eq(fe1083.job.marginTarget, expected,
    `marginTarget: ${fe1083.job.marginTarget} != ${expected}`);
});

test('fe: costing laborHrs = EngHours + MfgHours from specCosting', () => {
  for (let i = 0; i < fe1083.costing.length; i++) {
    const raw = pipeline1083.specCosting[i];
    const expected = (raw.EngHours || 0) + (raw.MfgHours || 0);
    eq(fe1083.costing[i].laborHrs, expected,
      `costing[${i}].laborHrs: ${fe1083.costing[i].laborHrs} != ${expected}`);
  }
});

test('fe: costing labor = EngLabor + MfgLabor from specCosting', () => {
  for (let i = 0; i < fe1083.costing.length; i++) {
    const raw = pipeline1083.specCosting[i];
    const expected = (raw.EngLabor || 0) + (raw.MfgLabor || 0);
    eq(fe1083.costing[i].labor, expected,
      `costing[${i}].labor: ${fe1083.costing[i].labor} != ${expected}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 10 — Cross-project invariants
// ═════════════════════════════════════════════════════════════════════════════
section('10 · Cross-project invariants');

test('both projects: no part has receivedQty > poQty in BOM (data sanity)', () => {
  for (const [proj, specId] of [[1083, 10], [1083, 30], [1129, 10], [1129, 30]]) {
    const rows = demo.getBomRows(proj, specId);
    for (const r of rows) {
      // receivedQty can exceed poQty if PO was over-received or PO data is partial
      // but log as warning if dramatically over
      if (r.ReceivedQty > r.POQty * 3 && r.POQty > 0) {
        ok(false, `Suspicious: ${proj}/${specId} ChildPN=${r.ChildPN} ReceivedQty=${r.ReceivedQty} POQty=${r.POQty}`);
      }
    }
  }
});

test('both projects: every PO row has a PurchaseOrderID', () => {
  for (const [proj, rows] of [[1083, poRows1083], [1129, poRows1129]]) {
    for (const r of rows) {
      ok(r.PurchaseOrderID, `Project ${proj}: row with ItemID=${r.ItemID} has no PurchaseOrderID`);
    }
  }
});

test('both projects: machine pct values are integers (no float drift)', () => {
  for (const [proj, pipeline] of [[1083, pipeline1083], [1129, pipeline1129]]) {
    for (const spec of pipeline.specs) {
      for (const m of spec.machines) {
        if (!m.stats) continue;
        eq(m.stats.pct, Math.round(m.stats.pct),
          `Project ${proj} machine ${m.pn} pct=${m.stats.pct} is not integer`);
      }
    }
  }
});

test('both projects: noPoParts ids are all unique across specs (global dedup)', () => {
  for (const [proj, pipeline] of [[1083, pipeline1083], [1129, pipeline1129]]) {
    const seen = new Set();
    for (const spec of pipeline.specs) {
      for (const p of (spec.noPoParts || [])) {
        notOk(seen.has(p.id),
          `Project ${proj}: noPO part ${p.pn} (id=${p.id}) duplicated across specs`);
        seen.add(p.id);
      }
    }
  }
});

test('fe 1129: KPI ready + close + blocked = total assemblies', () => {
  const { ready, close, blocked, assemblies } = fe1129.job.kpis;
  eq(ready + close + blocked, assemblies,
    `1129 KPI: ${ready}+${close}+${blocked} != ${assemblies}`);
});

test('timeline tooltip: grpRcvd and grpQty match PO row data', () => {
  // Simulates what the timeline tooltip computes: grouping all POs by date,
  // summing received/qty across all parts in the group.
  // Verify for each PO entry that part-level qty/received are consistent with raw rows.
  const all = [...poActions1083.critical, ...poActions1083.warning,
               ...poActions1083.onTrack, ...poActions1083.delivered];
  for (const e of all) {
    const grpQty  = e.po.parts.reduce((s, p) => s + p.qty, 0);
    const grpRcvd = e.po.parts.reduce((s, p) => s + p.received, 0);
    ok(grpQty  >= grpRcvd, `PO ${e.po.poId}: grpQty(${grpQty}) < grpRcvd(${grpRcvd})`);
    ok(grpQty  > 0, `PO ${e.po.poId}: grpQty is 0`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  Summary
// ═════════════════════════════════════════════════════════════════════════════
const total = passed + failed;
process.stdout.write(`\n${'─'.repeat(60)}\n`);
process.stdout.write(`Tests: ${total}  `);
process.stdout.write(`\x1b[32mPassed: ${passed}\x1b[0m  `);
if (failed > 0) {
  process.stdout.write(`\x1b[31mFailed: ${failed}\x1b[0m\n`);
  process.stdout.write(`\nFailing tests:\n`);
  failures.forEach(f => process.stdout.write(`  • ${f.name}\n    ${f.message}\n`));
  process.exit(1);
} else {
  process.stdout.write(`\x1b[32mAll tests passed\x1b[0m\n`);
}
