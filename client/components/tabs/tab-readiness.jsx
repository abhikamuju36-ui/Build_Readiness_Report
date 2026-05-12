// Build Readiness Tab — Premium SDC Design
const { useState, useMemo, useEffect } = React;

function useColResize(initial) {
  const [widths, setWidths] = useState(initial);
  const drag = React.useRef(null);
  const startDrag = (idx, e) => {
    e.preventDefault();
    drag.current = { idx, x: e.clientX, w: widths[idx] };
    const onMove = ev => {
      if (!drag.current) return;
      const { idx, x, w } = drag.current;
      setWidths(prev => { const n = [...prev]; n[idx] = Math.max(40, w + (ev.clientX - x)); return n; });
    };
    const onUp = () => {
      drag.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const template = widths.map(w => `${w}px`).join(' ');
  return { template, startDrag };
}

const ColHandle = ({ onMouseDown }) => (
  <div
    onMouseDown={onMouseDown}
    style={{ position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 3, cursor: 'col-resize', zIndex: 1, background: 'var(--border-strong)', opacity: 0.35, borderRadius: 2, transition: 'opacity 0.15s' }}
    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
    onMouseLeave={e => e.currentTarget.style.opacity = '0.35'}
  />
);

function RiskPartsPanel({ nopo, poActions }) {
  const [slipCollapsed, setSlipCollapsed] = useState(false);
  const [nopCollapsed,  setNopCollapsed]  = useState(false);
  const slip = useColResize([110, 200, 68, 68, 72, 70]);
  const nop  = useColResize([110, 200, 70, 40, 70]);

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const slipping = useMemo(() => {
    const windowStart = new Date(todayStart); windowStart.setDate(windowStart.getDate() - 7);
    const windowEnd   = new Date(todayStart); windowEnd.setDate(windowEnd.getDate() + 8);
    const parts = [];
    [...(poActions?.critical || []), ...(poActions?.warning || []), ...(poActions?.onTrack || [])].forEach(entry => {
      entry.po.parts.forEach(p => {
        if (p.received >= p.qty) return;
        const dueDate = p.dueDate ? new Date(p.dueDate) : null;
        if (!dueDate || dueDate < windowStart || dueDate >= windowEnd) return;
        parts.push({ ...p, supplier: entry.supplier, poId: entry.po.poId, poDate: entry.po.poDate });
      });
    });
    return parts.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [poActions, todayStart]);

  const slipStats = useMemo(() => {
    let totalLate = 0, lateCount = 0, oldestReq = null;
    slipping.forEach(p => {
      const due = new Date(p.dueDate);
      if (due < todayStart) { totalLate += Math.round((todayStart - due) / 86400000); lateCount++; }
      const req = p.requiredDate ? new Date(p.requiredDate) : null;
      if (req && (!oldestReq || req < oldestReq)) oldestReq = req;
    });
    return {
      avgLate:   lateCount > 0 ? `+${Math.round(totalLate / lateCount)}d` : '—',
      hasLate:   lateCount > 0,
      oldestReq: oldestReq ? oldestReq.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—',
    };
  }, [slipping, todayStart]);

  const nopStats = useMemo(() => {
    const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);
    let thisWeek = 0, oldestReq = null;
    nopo.forEach(p => {
      const req = p.requiredDate ? new Date(p.requiredDate) : null;
      if (!req) return;
      if (req <= weekEnd) thisWeek++;
      if (!oldestReq || req < oldestReq) oldestReq = req;
    });
    return {
      thisWeek,
      oldestReq: oldestReq ? oldestReq.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—',
    };
  }, [nopo, todayStart]);

  const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

  const CARD   = { background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' };
  const HDR_BASE = { display: 'grid', gap: 10, padding: '8px 14px 7px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border-subtle)' };
  const ROW_BASE = { display: 'grid', gap: 10, padding: '7px 14px', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 };
  const CELL_H   = { position: 'relative', overflow: 'hidden' };

  const Stat = ({ label, value, valueColor }) => (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase' }}>{label}</span>
      <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: valueColor || 'var(--ink)', letterSpacing: '-0.01em' }}>{value}</span>
    </span>
  );

  const HideBtn = ({ collapsed, onToggle }) => (
    <button onClick={onToggle} style={{ height: 26, padding: '0 10px', border: '1px solid var(--border)', background: 'var(--bg-raised)', borderRadius: 6, color: 'var(--ink-4)', fontSize: 11, fontWeight: 500, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {collapsed ? 'Show' : 'Hide'} <span style={{ fontSize: 9 }}>{collapsed ? '↓' : '↑'}</span>
    </button>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>

      {/* ── Delivery Slip Card ── */}
      <div style={CARD}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', alignItems: 'center', gap: 20, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b8861b' }}>
            <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fbf1d6', color: '#b8861b', borderRadius: 4, fontWeight: 800, fontSize: 12 }}>!</span>
            Delivery Slip
          </span>
          <span />
          <Stat label="Parts"    value={slipping.length} valueColor="#b8861b" />
          <Stat label="Avg Late" value={slipStats.avgLate} valueColor={slipStats.hasLate ? '#c43e1c' : 'var(--ink-3)'} />
          <Stat label="Oldest Req" value={slipStats.oldestReq} />
          <HideBtn collapsed={slipCollapsed} onToggle={() => setSlipCollapsed(c => !c)} />
        </div>
        {!slipCollapsed && (
          <>
            <div style={{ ...HDR_BASE, gridTemplateColumns: slip.template }}>
              {['Part #','Description','Req Date','Exp Date','Order Date','Cost'].map((lbl, i) => (
                <span key={i} style={{ ...CELL_H, textAlign: i === 5 ? 'right' : 'left' }}>{lbl}<ColHandle onMouseDown={e => slip.startDrag(i, e)} /></span>
              ))}
            </div>
            <div style={{ maxHeight: 150, overflowY: 'auto' }}>
              {slipping.length === 0
                ? <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>No parts due within ±7 days</div>
                : slipping.map((p, i) => (
                  <div key={i} className="row-hover" style={{ ...ROW_BASE, gridTemplateColumns: slip.template }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--sdc-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.partNumber}</span>
                    <span style={{ fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.partDesc}</span>
                    <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(p.requiredDate)}</span>
                    <span className="mono" style={{ fontWeight: 600, color: new Date(p.dueDate) < todayStart ? '#c43e1c' : 'var(--ink-2)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(p.dueDate)}</span>
                    <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, whiteSpace: 'nowrap' }}>{p.poDate ? fmtDate(p.poDate) : '—'}</span>
                    <span className="mono" style={{ textAlign: 'right', fontSize: 11, color: p.price > 0 ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                      {p.price > 0 ? `$${Number(p.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>

      {/* ── No PO Card ── */}
      <div style={CARD}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', alignItems: 'center', gap: 20, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c43e1c' }}>
            <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fbeae3', color: '#c43e1c', borderRadius: 4, fontWeight: 800, fontSize: 13 }}>×</span>
            No Purchase Order
          </span>
          <span />
          <Stat label="Parts"     value={nopo.length}       valueColor="#c43e1c" />
          <Stat label="This Week" value={nopStats.thisWeek} />
          <Stat label="Oldest Req" value={nopStats.oldestReq} />
          <HideBtn collapsed={nopCollapsed} onToggle={() => setNopCollapsed(c => !c)} />
        </div>
        {!nopCollapsed && (
          <>
            <div style={{ ...HDR_BASE, gridTemplateColumns: nop.template }}>
              {['Part #','Description','Req Date','Qty','Cost'].map((lbl, i) => (
                <span key={i} style={{ ...CELL_H, textAlign: i >= 3 ? 'right' : 'left' }}>{lbl}<ColHandle onMouseDown={e => nop.startDrag(i, e)} /></span>
              ))}
            </div>
            <div style={{ maxHeight: 150, overflowY: 'auto' }}>
              {nopo.length === 0
                ? <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>All parts have purchase orders</div>
                : nopo.map((p, i) => (
                  <div key={i} className="row-hover" style={{ ...ROW_BASE, gridTemplateColumns: nop.template }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--sdc-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pn || p.id}</span>
                    <span style={{ fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.desc}</span>
                    <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(p.requiredDate)}</span>
                    <span className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ink-2)', fontSize: 12 }}>{p.qty}</span>
                    <span className="mono" style={{ textAlign: 'right', fontSize: 11, color: p.unitPrice > 0 ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                      {p.unitPrice > 0 ? `$${Number(p.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>

    </div>
  );
}

function statusColor(s) {
  if (s === 'ready' || s === 'received') return 'var(--ready)';
  if (s === 'close' || s === 'ordered') return 'var(--pending)';
  if (s === 'blocked' || s === 'threat' || s === 'noPO' || s === 'no_po') return 'var(--threat)';
  return 'var(--ink-4)';
}

function ReadinessTab({ data, query, setQuery, statusFilter, setStatusFilter, jobId, onDrillDown }) {
  const { job, readiness } = data;
  const [expandAction, setExpandAction] = useState({ type: null, version: 0 });

  // Calculate accurate counts dynamically
  const stats = useMemo(() => {
    let ready = 0, close = 0, blocked = 0;
    let totalParts = 0, receivedParts = 0;
    const specCounts = {};

    readiness.forEach(s => {
      specCounts[s.spec] = s.lines || 0;
      s.assemblies.forEach(a => {
        const pct = a.pct || a.stats?.pct || 0;
        if (pct >= 85) ready++;
        else if (pct >= 60) close++;
        else blocked++;

        totalParts += (a.total || a.stats?.total || 0);
        receivedParts += (a.ready || a.stats?.received || 0);
      });
    });
    // Use globally-deduplicated count from job.kpis — avoids double-counting shared parts
    const noPO = data.job.kpis.noPO;
    return { ready, close, blocked, noPO, specCounts, totalParts, receivedParts };
  }, [readiness, data.job.kpis.noPO]);

  const filteredSpecs = useMemo(() => {
    const q = query.toLowerCase();
    const isSpecSearch = q.startsWith('spec ');
    const isNoPoSearch = q === 'no po';
    const specNum = isSpecSearch ? q.replace('spec ', '').trim() : null;

    return readiness.map(s => {
      const specMatch = isSpecSearch && (String(s.spec).toLowerCase() === specNum || s.title.toLowerCase().includes(q));

      return {
        ...s,
        assemblies: s.assemblies.filter(a => {
          const pct = a.pct || a.stats?.pct || 0;
          const status = (pct >= 85) ? 'ready' : (pct >= 60) ? 'close' : 'blocked';
          const matchesStatus = statusFilter === 'all' || status === statusFilter || (statusFilter === 'noPO' && (a.noPo || a.stats?.noPO) > 0);

          if (!matchesStatus) return false;
          if (!query) return true;
          if (specMatch) return true;
          if (isNoPoSearch && matchesStatus) return true; // Show all if no po status matched

          return (a.name || '').toLowerCase().includes(q) ||
            (a.desc || '').toLowerCase().includes(q) ||
            (a.code || '').toLowerCase().includes(q);
        }),
      };
    }).filter(s => s.assemblies.length > 0);
  }, [readiness, statusFilter, query]);


  const handleExpandAll = () => setExpandAction({ type: 'expand', version: expandAction.version + 1 });
  const handleCollapseAll = () => setExpandAction({ type: 'collapse', version: expandAction.version + 1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <window.TimelineRibbon job={job} poActions={data.poActions} smartsheet={data.buildDates} onDrillDown={onDrillDown} />

      <RiskPartsPanel readiness={data.readiness} nopo={data.nopo} poActions={data.poActions} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="search" style={{ flex: 1 }}>
              <window.IconSearch size={14} />
              <input
                placeholder="Search parts, assemblies, suppliers, vendors…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--ink-4)', display: 'flex', alignItems: 'center' }}
                >
                  <window.IconX size={14} />
                </button>
              )}
              <window.IconFilter size={12} style={{ color: 'var(--ink-4)', cursor: 'pointer' }} />
              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
              <span className="kbd">⌘K</span>
            </div>
            <div style={{ display: "flex", gap: 4, background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 3 }}>
              {[
                { id: "all", label: "All" },
                { id: "ready", label: "Ready", dot: "ready" },
                { id: "close", label: "Close", dot: "pending" },
                { id: "blocked", label: "Blocked", dot: "threat" },
              ].map(f => (
                <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
                  padding: "4px 10px",
                  fontSize: "var(--t-sm)",
                  fontWeight: 500,
                  borderRadius: 4,
                  background: statusFilter === f.id ? "var(--bg-raised)" : "transparent",
                  color: statusFilter === f.id ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: statusFilter === f.id ? "var(--shadow-sm)" : "none",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  {f.dot && <span className={`dot-led ${f.dot}`} style={{ margin: 0 }} />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sticky Schedule Bar Overlay */}
          <div style={{
            position: "sticky", top: 0, zIndex: 100,
            background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
            border: "1px solid var(--border)", borderBottom: "2px solid var(--border-strong)",
            borderRadius: "var(--r-md)", padding: "10px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "var(--shadow-md)", margin: "0 0 4px 0"
          }}>
            <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Build Start</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--threat-ink)" }}>{job.buildStart ? new Date(job.buildStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Ship Date</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{job.shipDate ? new Date(job.shipDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</span>
              </div>
              <div style={{ width: 1, height: 24, background: "var(--border)" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Readiness</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 100, height: 6, background: "var(--bg-sunken)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((stats.receivedParts / (stats.totalParts || 1)) * 100)}%`, height: "100%", background: "var(--ready)" }} />
                  </div>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ready-ink)" }}>{Math.round((stats.receivedParts / (stats.totalParts || 1)) * 100)}%</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}>
                <window.IconClock size={12} style={{ verticalAlign: 'middle', marginRight: 4, marginTop: -2 }} />
                {job.buildStart ? `${Math.round((new Date(job.buildStart) - new Date()) / 86400000)} days to build` : 'Build date TBD'}
              </span>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <button onClick={handleExpandAll} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-sunken)', color: 'var(--ink-2)', cursor: 'pointer' }}>
                Expand All
              </button>
              <button onClick={handleCollapseAll} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-sunken)', color: 'var(--ink-2)', cursor: 'pointer' }}>
                Collapse All
              </button>
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            {filteredSpecs.map(spec => (
              <div key={spec.spec} id={`spec-${spec.spec}`}>
                <div style={{
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  background: "var(--bg-sunken)",
                  borderBottom: "1px solid var(--border-subtle)"
                }}>
                  <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>
                    Spec {spec.spec} — {spec.title}
                  </h2>
                  <span className="meta-line" style={{ fontSize: 10 }}>{spec.lines} BOM lines · {spec.assemblies.length} assemblies</span>
                </div>

                {spec.assemblies.map((a, i) => (
                  <AssemblyRow
                    key={a.name}
                    a={a}
                    jobId={jobId}
                    isLast={i === spec.assemblies.length - 1}
                    expandAction={expandAction}
                  />
                ))}
              </div>
            ))}
            {filteredSpecs.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-4)' }}>No matches.</div>
            )}
          </div>
        </div>

        {/* Smartsheet Milestones — compact horizontal strip */}
        {data.buildDates && data.buildDates.milestones && data.buildDates.milestones.length > 0 && (
          <div style={{ border: '1px solid var(--sdc-blue-soft)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-raised)' }}>
            <div style={{ padding: '7px 14px', background: 'var(--sdc-blue-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <window.IconCalendar size={12} />
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--sdc-blue-ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Schedule Milestones</span>
              {data.buildDates.permalink && (
                <a href={data.buildDates.permalink} target="_blank" style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: 'var(--sdc-blue-ink)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  OPEN <window.IconExternal size={10} />
                </a>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, padding: '8px 14px' }}>
              {data.buildDates.milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', borderRight: i < data.buildDates.milestones.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{m.name}</span>
                  <div style={{ width: 60, height: 4, background: 'var(--bg-sunken)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${m.percent * 100}%`, height: '100%', background: m.health.toLowerCase() === 'red' ? 'var(--threat)' : m.health.toLowerCase() === 'yellow' ? 'var(--pending)' : 'var(--ready)' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.health.toLowerCase() === 'red' ? 'var(--threat-ink)' : 'var(--ink-3)' }}>{Math.round(m.percent * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AssemblyRow({ a, jobId, isLast, depth = 0, expandAction }) {
  const [open, setOpen] = useState(false);
  const [childExpandAction, setChildExpandAction] = useState({ type: null, version: 0 });
  const node = a.node || {};
  const children = node.children || [];
  const parts = node.parts || [];

  useEffect(() => {
    if (expandAction.type === 'expand') { setOpen(true); setChildExpandAction(p => ({ type: 'expand', version: p.version + 1 })); }
    if (expandAction.type === 'collapse') { setOpen(false); setChildExpandAction(p => ({ type: 'collapse', version: p.version + 1 })); }
  }, [expandAction.version]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) setChildExpandAction(p => ({ type: 'expand', version: p.version + 1 }));
  };

  const pct     = a.pct || a.stats?.pct || 0;
  const received = a.ready || a.stats?.received || 0;
  const total    = a.total || a.stats?.total || 0;
  const noPO     = a.noPo  || a.stats?.noPO  || 0;

  const healthColor = pct >= 85 ? 'var(--ready)' : pct >= 60 ? 'var(--pending)' : 'var(--threat)';
  const healthInk   = pct >= 85 ? 'var(--ready-ink)' : pct >= 60 ? '#92400e' : 'var(--threat-ink)';
  const isSub = depth > 0;

  const PART_COLS = "3px 54px 28px 90px 1fr 90px 110px 52px 52px 52px";

  return (
    <div style={{ position: 'relative', borderBottom: isLast ? "none" : "1px solid var(--border-subtle)" }}>
      {/* Full vertical tree line bridging to next sibling */}
      {depth > 0 && !isLast && (
        <div style={{
          position: 'absolute',
          left: 12 + (depth - 1) * 24 + 10,
          top: 0,
          bottom: 0,
          width: 1,
          background: 'var(--ink-4)',
          opacity: 0.5,
          zIndex: 0,
          pointerEvents: 'none'
        }} />
      )}

      {/* ── Assembly header ── */}
      <div
        onClick={handleToggle}
        className="row-hover"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "20px auto 1fr auto",
          alignItems: "center",
          gap: 10,
          padding: `${isSub ? 2 : 4}px 12px ${isSub ? 2 : 4}px ${12 + depth * 24}px`,
          cursor: "pointer",
          borderLeft: `4px solid ${open ? healthColor : 'transparent'}`,
          background: open
            ? (isSub ? 'rgba(0,0,0,0.02)' : 'var(--bg-sunken)')
            : (isSub ? 'transparent' : 'var(--bg-raised)'),
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {/* Solidworks-style tree connector */}
        {depth > 0 && (
          <div style={{
            position: 'absolute',
            left: 12 + (depth - 1) * 24 + 10,
            top: 0,
            bottom: '50%',
            width: 14,
            borderLeft: isLast ? '1px solid var(--ink-4)' : 'none',
            borderBottom: '1px solid var(--ink-4)',
            opacity: 0.5,
            zIndex: 0,
            pointerEvents: 'none'
          }} />
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)" }}>
          {open ? <window.IconCaretDown size={11} /> : <window.IconCaretRight size={11} />}
        </div>

        <span className="mono" style={{
          fontSize: 11, fontWeight: 700, color: "var(--sdc-blue)", padding: "2px 8px",
          background: "var(--sdc-blue-soft)", border: "1px solid var(--sdc-blue-border,rgba(37,99,235,0.25))",
          borderRadius: 4, whiteSpace: 'nowrap',
        }}>{a.code || a.pn}</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{
            fontWeight: 500, fontSize: isSub ? 11 : 12,
            color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{a.desc || 'No Description'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--ink-4)' }}>
            <span style={{ color: healthInk, fontWeight: 700 }}>{received}/{total} parts</span>
            {children.length > 0 && <span>· {children.length} sub-assy</span>}
            {noPO > 0 && <span style={{ color: 'var(--threat-ink)', fontWeight: 700 }}>· {noPO} no&nbsp;PO</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
          <div style={{ width: 60, height: 4, background: 'var(--bg-sunken)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: healthColor, transition: 'width 0.4s' }} />
          </div>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: healthInk, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
        </div>


      </div>

      {open && (
        <div className="fade-in" style={{ background: "var(--bg)", borderTop: "1px solid var(--border-subtle)" }}>

          {/* Sub-assemblies first */}
          {children.map((child, i) => (
            <AssemblyRow
              key={child.pn + i}
              a={{ ...child, code: child.pn, node: child }}
              jobId={jobId}
              isLast={i === children.length - 1 && parts.length === 0}
              depth={depth + 1}
              expandAction={childExpandAction}
            />
          ))}

          {/* Parts column header */}
          {parts.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* Full vertical line passing through header */}
              <div style={{
                position: 'absolute',
                left: 12 + depth * 24 + 10,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--ink-4)',
                opacity: 0.5,
                zIndex: 0,
                pointerEvents: 'none'
              }} />
              <div style={{
                display: "grid", gridTemplateColumns: PART_COLS, gap: 8,
                padding: `4px 10px 4px ${36 + depth * 24}px`,
                fontSize: 8, color: "#ffffff", letterSpacing: "0.06em",
                textTransform: "uppercase", fontWeight: 700,
                borderTop: children.length > 0 ? '2px solid var(--border-subtle)' : 'none',
                borderBottom: "1px solid var(--ink)",
                background: 'var(--ink-2)',
              }}>
              <span />
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Qty</span>
              <span>Part #</span>
              <span>Description</span>
              <span>Manufacturer</span>
              <span>Supplier</span>
              <span>Req Date</span>
              <span>Expected</span>
              <span>Rcvd Date</span>
              </div>
            </div>
          )}

          {/* Parts */}
          {parts.map((p, i) => {
            const po = p.pos?.[0] || {};
            const isNoPo  = p.status === 'noPO' || p.status === 'no_po';
            const isRcvd  = p.status === 'received';
            const isLate  = !isRcvd && !isNoPo && po.dueDate && new Date(po.dueDate) < new Date();

            const stripColor  = isRcvd ? 'var(--ready)' : isNoPo ? 'var(--threat)' : isLate ? '#f97316' : '#f59e0b';
            const statusColor = isRcvd ? 'var(--ready-ink)' : isNoPo ? 'var(--threat-ink)' : isLate ? '#c2410c' : '#92400e';
            const rowBg       = isRcvd ? 'var(--ready-soft)' : isNoPo ? 'var(--threat-soft)' : isLate ? 'rgba(249,115,22,0.04)' : 'transparent';

            const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

            const cell = { padding: "6px 0", alignSelf: 'center' };

            return (
              <div key={i} className="row-hover" style={{ position: 'relative' }}>
                {/* Full vertical line if NOT last part */}
                {i < parts.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: 12 + depth * 24 + 10,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'var(--ink-4)',
                    opacity: 0.5,
                    zIndex: 0,
                    pointerEvents: 'none'
                  }} />
                )}
                {/* L-connector / Branch */}
                <div style={{
                  position: 'absolute',
                  left: 12 + depth * 24 + 10,
                  top: 0,
                  bottom: '50%',
                  width: 14,
                  borderBottom: '1px solid var(--ink-4)',
                  borderLeft: i === parts.length - 1 ? '1px solid var(--ink-4)' : 'none',
                  opacity: 0.5,
                  zIndex: 0,
                  pointerEvents: 'none'
                }} />

                <div style={{
                  display: "grid", gridTemplateColumns: PART_COLS, gap: 8,
                  padding: `0 10px 0 ${36 + depth * 24}px`,
                  alignItems: "stretch",
                  borderBottom: i === parts.length - 1 ? "none" : "1px solid var(--border-subtle)",
                  background: rowBg,
                }}>
                {/* Colored left strip */}
                <div style={{ background: stripColor, alignSelf: 'stretch' }} />

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", ...cell }}>
                  <span style={{ color: statusColor, fontWeight: 800, fontSize: 8, letterSpacing: '0.04em', display: "inline-flex", alignItems: "center", gap: 2 }}>
                    {isNoPo  ? <><window.IconCircleX size={9} sw={2.5} /> NO PO</>
                    : isRcvd ? <><window.IconCheck size={9} sw={2.5} /> RCVD</>
                    : isLate ? <><window.IconAlert size={9} sw={2} /> LATE</>
                              : <><window.IconClock size={9} sw={2} /> ON ORDER</>}
                  </span>
                </div>

                {/* Qty */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', ...cell }}>
                  <span className="mono tnum" style={{ color: "var(--ink-2)", fontSize: 11, fontWeight: 600 }}>{p.qty}</span>
                </div>

                {/* Part # */}
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', ...cell }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--sdc-blue)", fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.pn}</span>
                </div>

                {/* Description */}
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', ...cell }}>
                  <span style={{ color: "var(--ink)", fontWeight: isNoPo ? 600 : 500, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</span>
                </div>

                {/* Manufacturer */}
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', ...cell }}>
                  <span style={{ color: "var(--ink-3)", fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.manufacturer === 'SDC' ? 'In-house (SDC)' : p.manufacturer || '—'}
                  </span>
                </div>

                {/* Supplier */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: 'hidden', ...cell }}>
                  {po.supplier && <window.VendorAvatar vendor={po.supplier} size={14} />}
                  <span style={{ color: "var(--ink-2)", fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {po.supplier || '—'}
                  </span>
                </div>

                {/* Req Date */}
                <div style={{ display: 'flex', alignItems: 'center', ...cell }}>
                  <span className="mono" style={{ color: "var(--ink-3)", fontSize: 9 }}>{fmtDate(p.requiredDate)}</span>
                </div>

                {/* Expected */}
                <div style={{ display: 'flex', alignItems: 'center', ...cell }}>
                  <span className="mono" style={{ color: isLate ? '#c2410c' : "var(--ink-3)", fontSize: 9, fontWeight: (po.dueDate && p.requiredDate && new Date(po.dueDate) > new Date(p.requiredDate)) ? 700 : 400 }}>{fmtDate(po.dueDate)}</span>
                </div>

                {/* Rcvd Date */}
                <div style={{ display: 'flex', alignItems: 'center', ...cell }}>
                  <span className="mono" style={{ color: p.receivedDate ? 'var(--ready-ink)' : "var(--ink-4)", fontSize: 9 }}>{fmtDate(p.receivedDate)}</span>
                </div>
              </div>
            </div>
          );
          })}

          {depth === 0 && (
            <div style={{ padding: "10px 18px 14px", display: "flex", gap: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <button className="btn btn-sm"><window.IconExport size={11} /> Export Lines</button>
              <button className="btn btn-sm" style={{ background: "var(--sdc-blue-soft)", color: "var(--sdc-blue-ink)", borderColor: "var(--sdc-blue-soft)" }}>
                <window.IconMail size={11} /> Draft Chase Email
              </button>
              <button className="btn btn-sm btn-ghost"><window.IconLink size={11} /> Link in SolidWorks</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, mono }) {
  const colors = {
    ready: "var(--ready-ink)",
    blue: "var(--sdc-blue-ink)",
    threat: "var(--threat-ink)",
    neutral: "var(--ink-3)"
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, minWidth: 60 }}>
      <span className={mono ? "mono" : ""} style={{ fontSize: "var(--t-md)", fontWeight: 600, color: accent ? colors[accent] : "var(--ink)" }}>{value}</span>
      <span style={{ fontSize: 9, color: "var(--ink-4)", letterSpacing: 0.04, textTransform: "uppercase", marginTop: 3, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

window.ReadinessTab = ReadinessTab;
