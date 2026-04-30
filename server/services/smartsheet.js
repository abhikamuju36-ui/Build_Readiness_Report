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
    r.text && r.text.toLowerCase().includes('schedule')
  );
  return match ? match.objectId : null;
}

/**
 * Get build dates from a schedule sheet.
 * Returns { buildStart, buildComplete } as ISO date strings or null.
 */
async function getBuildDates(projectId) {
  const sheetId = await findScheduleSheet(projectId);
  if (!sheetId) return { buildStart: null, buildComplete: null, source: null };

  const sheet = await smartsheetFetch(`/sheets/${sheetId}`);
  if (!sheet || !sheet.rows) return { buildStart: null, buildComplete: null, source: null };

  // Find column indices
  const cols = {};
  (sheet.columns || []).forEach(c => {
    const name = (c.title || '').toLowerCase();
    if (name.includes('task name') || name === 'task name') cols.taskName = c.id;
    if (name.includes('start')) cols.start = c.id;
    if (name.includes('finish') || name.includes('end')) cols.finish = c.id;
  });

  let buildStart = null;
  let buildComplete = null;

  (sheet.rows || []).forEach(row => {
    const cellMap = {};
    (row.cells || []).forEach(c => { cellMap[c.columnId] = c.value; });

    const taskName = (cellMap[cols.taskName] || '').toString().toLowerCase();
    if (taskName.includes('builder 1') || taskName.includes('build start')) {
      buildStart = cellMap[cols.start] || buildStart;
    }
    if (taskName.includes('build complete')) {
      buildComplete = cellMap[cols.finish] || buildComplete;
    }
  });

  return {
    buildStart,
    buildComplete,
    source: sheet.name,
  };
}

module.exports = { getBuildDates };
