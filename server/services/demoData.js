/**
 * Demo/cached data provider — used when ETO DB credentials are not configured.
 * Serves pre-fetched data from server/cache/ so the app can be previewed immediately.
 * Supports any project that has cached JSON files (bom_{id}_{spec}.json, po_{id}.json).
 */
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache');

function loadJson(filename) {
  const fp = path.join(CACHE_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// Static project info (expand as needed)
const projectInfoMap = {
  1083: { ProjectID: 1083, ProjectName: 'SDC Show Room', DisplayName: '1083 - SDC Show Room' },
  1129: { ProjectID: 1129, ProjectName: 'Molex Duplex', DisplayName: '1129 - Molex Duplex' },
};

// Spec definitions per project (expand as needed)
const specsMap = {
  1083: [
    { SpecAutoID: 610, SpecID: 10, SDescription: 'Mechanical Design and Build', SQuantity: 1 },
    { SpecAutoID: 611, SpecID: 30, SDescription: 'Controls Design', SQuantity: 1 },
  ],
  1129: [
    { SpecAutoID: 894, SpecID: 10, SDescription: 'Mechanical Design and Build', SQuantity: 1 },
    { SpecAutoID: 888, SpecID: 30, SDescription: 'Controls Design', SQuantity: 1 },
  ],
};

module.exports = {
  isDemoMode() {
    return !process.env.ETO_HOST || process.env.ETO_HOST === 'your-server-here';
  },

  /** Detect which projects have cached data */
  getCachedProjects() {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.startsWith('bom_'));
    const ids = new Set(files.map(f => parseInt(f.split('_')[1])));
    return [...ids];
  },

  getProjectInfo(projectId) {
    return projectInfoMap[projectId] || { ProjectID: projectId, ProjectName: `Job ${projectId}`, DisplayName: `${projectId}` };
  },

  getSpecs(projectId) {
    if (specsMap[projectId]) return specsMap[projectId];
    // Auto-detect specs from cache files
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.startsWith(`bom_${projectId}_`));
    return files.map((f, i) => {
      const specId = parseInt(f.replace(`bom_${projectId}_`, '').replace('.json', ''));
      return { SpecAutoID: 900 + i, SpecID: specId, SDescription: `Spec ${specId}`, SQuantity: 1 };
    });
  },

  getTopNode(projectId, specId) {
    // Load BOM data and infer top node from the parent IDs
    const data = loadJson(`bom_${projectId}_${specId}.json`);
    if (!data || data.length === 0) return null;
    // Top node = parent ID that never appears as a child
    const childIds = new Set(data.map(r => r.ChildID));
    const topParentIds = [...new Set(data.map(r => r.ParentID))].filter(p => !childIds.has(p));
    if (topParentIds.length === 0) return null;
    const topId = topParentIds[0];
    // Get PN/Desc from first row that references this parent
    const ref = data.find(r => r.ParentID === topId);
    return {
      TopItemID: topId,
      TopPN: ref ? ref.ParentPN : `TOP ${projectId}-${specId}`,
      TopDesc: ref ? ref.ParentDesc : `Project:${projectId} and Section:${specId}`,
    };
  },

  getBomRows(projectId, specId) {
    return loadJson(`bom_${projectId}_${specId}.json`) || [];
  },

  getPoDetails(projectId) {
    return loadJson(`po_${projectId}.json`) || [];
  },

  getProjectCosting(projectId) {
    return {
      JobID: projectId,
      Description: 'Demo Project',
      CustomerCity: 'Demo City',
      EstEngHrs: 120,
      ActEngHrs: 115,
      EstMfgHrs: 400,
      ActMfgHrs: 380,
      EstEngLabor: 12000,
      ActEngLabor: 11500,
      EstMfgLabor: 24000,
      ActMfgLabor: 22800,
      EstMaterials: 85000,
      ActMaterials: 82000,
      TotalEstimate: 121000,
      TotalActualCost: 116300,
      SalesPrice: 150000,
      BudgetMargin: 19.3,
      ActualMargin: 22.4,
    };
  },

  getSpecCosting(projectId) {
    return [
      {
        JobID: projectId,
        SectionID: 10,
        SectionName: 'Mechanical Build',
        EngHours: 80,
        MfgHours: 300,
        TotalHours: 380,
        EngLabor: 8000,
        MfgLabor: 18000,
        TotalLabor: 26000,
        PurchasedMaterials: 60000,
        InventoryPulls: 5000,
        ExtraCosts: 0,
        TotalMaterials: 65000,
        TotalCost: 91000,
        Margin: 25.0,
      },
    ];
  },
};
