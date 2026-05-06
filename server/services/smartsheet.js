/**
 * Smartsheet integration — fetches build schedule dates for a project.
 * Uses the Smartsheet REST API directly (no SDK dependency).
 */

const API_BASE = 'https://api.smartsheet.com/2.0';

async function smartsheetFetch(path) {
  const apiKey = process.env.SMARTSHEET_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      console.error(`Smartsheet API error: ${res.status} ${res.statusText}`);
      return null;
    }
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find the schedule sheet for a project by searching sheet names.
 */
async function findScheduleSheet(projectId) {
  const data = await smartsheetFetch(`/search?query=${projectId}`);
  if (!data || !data.results) return null;

  const match = data.results.find(r =>
    r.objectType === 'sheet' &&
    r.text && (
      r.text.toLowerCase().includes('schedule') || 
      r.text.toLowerCase().includes('assembly') ||
      r.text.toLowerCase().includes(projectId.toString())
    )
  );
  return match ? { id: match.objectId, name: match.text } : null;
}

/**
 * Get build dates and milestones from a schedule sheet.
 * Returns { buildStart, buildComplete, milestones, permalink, source }
 */
async function getBuildDates(projectId) {
  const sheetInfo = await findScheduleSheet(projectId);
  if (!sheetInfo) return { buildStart: null, buildComplete: null, milestones: [], permalink: null, source: null };

  const sheet = await smartsheetFetch(`/sheets/${sheetInfo.id}`);
  if (!sheet || !sheet.rows) return { buildStart: null, buildComplete: null, milestones: [], permalink: null, source: null };

  // Find column indices
  const cols = {};
  (sheet.columns || []).forEach(c => {
    const name = (c.title || '').toLowerCase();
    if (name.includes('task name')) cols.taskName = c.id;
    if (name.includes('start')) cols.start = c.id;
    if (name.includes('finish') || name.includes('end')) cols.finish = c.id;
    if (name.includes('% complete')) cols.percent = c.id;
    if (name.includes('health')) cols.health = c.id;
  });

  let buildStart = null;
  let buildComplete = null;
  const milestones = [];

  (sheet.rows || []).forEach(row => {
    const cellMap = {};
    (row.cells || []).forEach(c => { cellMap[c.columnId] = { value: c.value, display: c.displayValue }; });

    const taskName = (cellMap[cols.taskName]?.value || '').toString();
    const taskNameLower = taskName.toLowerCase();

    // Specific build dates
    if (taskNameLower.includes('builder 1') || taskNameLower.includes('build start')) {
      buildStart = cellMap[cols.start]?.value || buildStart;
    }
    if (taskNameLower.includes('build complete')) {
      buildComplete = cellMap[cols.finish]?.value || buildComplete;
    }

    // Key Milestones (BOM, Assembly, Design, etc.)
    const isMilestone = ['bom', 'assembly', 'design', 'test', 'ship', 'machine'].some(k => taskNameLower.includes(k)) && 
                        !row.summary && taskName.length < 50;
    
    if (isMilestone && milestones.length < 6) {
      milestones.push({
        name: taskName,
        percent: cellMap[cols.percent]?.value || 0,
        health: cellMap[cols.health]?.display || cellMap[cols.health]?.value || 'Green',
        finish: cellMap[cols.finish]?.value
      });
    }
  });

  return {
    buildStart,
    buildComplete,
    milestones,
    permalink: sheet.permalink,
    source: sheet.name,
  };
}

module.exports = { getBuildDates };
