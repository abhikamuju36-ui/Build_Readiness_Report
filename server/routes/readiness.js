const express = require('express');
const router = express.Router();
const eto = require('../eto');
const demo = require('../demoData');
const { getBuildDates } = require('../smartsheet');
const { buildTree, buildReadinessSummary, buildPoActionList, buildPoIndex, findNoPoParts } = require('../bomTree');

function db() { return demo.isDemoMode() ? demo : eto; }

// GET /api/readiness/:projectId — full readiness report
router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const src = db();

    const [project, specs, poRows, buildDates] = await Promise.all([
      src.getProjectInfo(projectId),
      src.getSpecs(projectId),
      src.getPoDetails(projectId),
      getBuildDates(projectId).catch(() => ({ buildStart: null, buildComplete: null })),
    ]);

    if (!specs || specs.length === 0) {
      return res.status(404).json({ error: demo.isDemoMode()
        ? `Demo mode — no cached data for project ${projectId}. Available: ${demo.getCachedProjects().join(', ')}`
        : `No specs found for project ${projectId}` });
    }

    // Build PO index (ItemID → PO detail lines)
    const poIndex = buildPoIndex(poRows);

    // Build readiness per spec
    const specReports = [];
    for (const spec of specs) {
      const [topNode, bomRows] = await Promise.all([
        src.getTopNode(projectId, spec.SpecID),
        src.getBomRows(projectId, spec.SpecID),
      ]);

      if (!topNode || bomRows.length === 0) continue;

      const { assemblyIds, childrenMap } = buildTree(bomRows);
      const summary = buildReadinessSummary(
        topNode.TopItemID, topNode.TopPN, topNode.TopDesc,
        childrenMap, assemblyIds, poIndex
      );
      const noPoParts = findNoPoParts(bomRows, assemblyIds);

      specReports.push({
        specId: spec.SpecID,
        specName: spec.SDescription,
        specQty: spec.SQuantity,
        topPN: topNode.TopPN,
        topDesc: topNode.TopDesc,
        machines: summary.machines,
        tree: summary.tree,
        noPoParts,
        totalParts: bomRows.length,
      });
    }

    // PO action list
    const poActions = buildPoActionList(poRows);

    res.json({
      project,
      specs: specReports,
      poActions,
      buildDates,
      demoMode: demo.isDemoMode(),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error building readiness report:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
