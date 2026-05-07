const { useState, useMemo, useRef, useEffect } = React;

// ── PO classification relative to build start ──────────────────────────
const CLS = {
  overdue:  { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   label: 'Overdue',        sub: 'Past due date',           rank: 3 },
  blocking: { color: '#ea580c', bg: 'rgba(234,88,12,0.08)',   label: 'Blocking Build',  sub: 'Due after build start',   rank: 2 },
  atRisk:   { color: '#d97706', bg: 'rgba(217,119,6,0.08)',   label: 'At Risk',         sub: '< 2 wks before build',    rank: 1 },
  safe:     { color: '#16a34a', bg: 'rgba(22,163,74,0.06)',   label: 'On Track',        sub: '2+ wks before build',     rank: 0 },
};

function poClass(dueDateStr, today, buildStart) {
  const due = +new Date(dueDateStr);
  if (due < +today)       return 'overdue';
  if (due > +buildStart)  return 'blocking';
  return (+buildStart - due) / 86400000 < 14 ? 'atRisk' : 'safe';
}

function useTimelineDrag(scrollRef) {
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startScroll = useRef(0);
  const moved    = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onDown = (e) => {
      if (e.button !== 0) return;
      dragging.current   = true;
      moved.current      = false;
      startX.current     = e.clientX;
      startScroll.current = el.scrollLeft;
      el.style.cursor    = 'grabbing';
      el.style.userSelect = 'none';
    };
    const onMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      if (Math.abs(dx) > 3) moved.current = true;
      el.scrollLeft = startScroll.current - dx;
    };
    const onUp = () => {
      dragging.current = false;
      el.style.cursor  = 'grab';
      el.style.userSelect = '';
    };

    el.style.cursor = 'grab';
    el.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      el.removeEventListener('mousedown',  onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [scrollRef]);

  // returns true if mouse was dragged (suppress click on child elements)
  return moved;
}

function TimelineRibbon({ job, poActions, smartsheet, onDrillDown }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [pinnedItem, setPinnedItem] = useState(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = useRef(null);
  const wasDragged = useTimelineDrag(scrollRef);

  const activeItem = pinnedItem || hoveredItem;

  const updateScrollBtns = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  // Close pinned tooltip on outside click
  useEffect(() => {
    if (!pinnedItem) return;
    const handler = e => {
      if (!e.target.closest('[data-timeline-tooltip]') && !e.target.closest('[data-timeline-diamond]'))
        setPinnedItem(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pinnedItem]);
  const today = new Date();
  const buildStart = job.buildStart ? new Date(job.buildStart) : new Date();
  const ship = job.shipDate ? new Date(job.shipDate) : null;

  const displayMilestones = useMemo(() => {
    if (smartsheet?.milestones?.length > 0) {
      return smartsheet.milestones.map((m, i) => ({
        id: `ss-${i}`, label: m.name,
        color: m.health.toLowerCase() === 'red' ? 'threat' : m.health.toLowerCase() === 'yellow' ? 'pending' : 'ready',
        actualDate: m.finish ? new Date(m.finish) : null,
      }));
    }
    return [
      { id: 'all',      label: 'All Parts',   color: 'ready',   offset: -20 },
      { id: 'panel',    label: 'Panel Build',  color: 'blue',    offset: -15 },
      { id: 'wiring',   label: 'Wiring',       color: 'pending', offset: 10  },
      { id: 'complete', label: 'Complete',     color: 'ready',   offset: 20  },
      { id: 'power',    label: 'Power Up',     color: 'ready',   offset: 25  },
    ].map(m => { const d = new Date(buildStart); d.setDate(d.getDate() + m.offset); return { ...m, actualDate: d }; });
  }, [smartsheet, buildStart]);

  // ── Classified markers (critical + warning, grouped by due date) ──────
  const classifiedMarkers = useMemo(() => {
    const now = new Date();
    const bs = new Date(buildStart);
    const map = {};
    [...(poActions?.critical || []), ...(poActions?.warning || []), ...(poActions?.onTrack || [])].forEach(entry => {
      if (!entry.po?.dueDate) return;
      const d = new Date(entry.po.dueDate);
      const key = d.toISOString().split('T')[0];
      const cls = poClass(entry.po.dueDate, now, bs);
      if (!map[key]) map[key] = { date: d, items: [], cls };
      map[key].items.push(entry);
      if (CLS[cls].rank > CLS[map[key].cls].rank) map[key].cls = cls;
    });
    return Object.values(map);
  }, [poActions, buildStart]);

  // ── Summary buckets (all POs across all categories) ───────────────────
  const summary = useMemo(() => {
    const now = new Date();
    const bs = new Date(buildStart);
    const buckets = { overdue: [], blocking: [], atRisk: [], safe: [] };
    [...(poActions?.critical || []), ...(poActions?.warning || []), ...(poActions?.onTrack || [])].forEach(entry => {
      if (!entry.po?.dueDate) return;
      const cls = poClass(entry.po.dueDate, now, bs);
      buckets[cls].push(entry);
    });
    return buckets;
  }, [poActions, buildStart]);

  // ── View range ─────────────────────────────────────────────────────────
  const allDates = [
    new Date(+today - 14 * 86400000),
    ...classifiedMarkers.map(m => m.date),
    ...displayMilestones.filter(m => m.actualDate).map(m => m.actualDate),
    buildStart,
    ...(ship ? [ship] : []),
  ];
  const earliest = new Date(Math.min(...allDates.map(d => +d)));
  const latestKnown = new Date(Math.max(...allDates.map(d => +d)));
  const rangeEnd = ship ? new Date(+ship + 14 * 86400000) : new Date(+latestKnown + 30 * 86400000);
  const rangeStart = new Date(earliest);
  rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());

  const DAY_W = 14;
  const totalDays = Math.ceil((+rangeEnd - +rangeStart) / 86400000);
  const totalWidth = totalDays * DAY_W;
  const dayToX = d => Math.max(0, Math.min(totalWidth, ((+new Date(d) - +rangeStart) / 86400000) * DAY_W));
  const todayX = dayToX(today);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.3);
    setTimeout(updateScrollBtns, 50);
  }, []); // eslint-disable-line

  const weeks = [];
  { let w = new Date(rangeStart); while (+w <= +rangeEnd) { weeks.push(new Date(w)); w = new Date(+w + 7 * 86400000); } }

  const months = [];
  {
    let mc = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    let idx = 0;
    while (+mc <= +rangeEnd) {
      const mEnd = new Date(mc.getFullYear(), mc.getMonth() + 1, 0);
      const start = +mc < +rangeStart ? rangeStart : mc;
      const end = +mEnd > +rangeEnd ? rangeEnd : mEnd;
      months.push({
        label: mc.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        year: mc.getFullYear(),
        isYearStart: mc.getMonth() === 0, // January = year boundary
        startX: dayToX(start),
        width: Math.max(0, dayToX(end) - dayToX(start)),
        even: idx % 2 === 0,
      });
      mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1);
      idx++;
    }
  }

  // Build year spans for the year band above months
  const yearBands = [];
  {
    let curYear = null, bandStart = 0;
    months.forEach((m, i) => {
      if (m.year !== curYear) {
        if (curYear !== null) yearBands.push({ year: curYear, startX: bandStart, endX: m.startX });
        curYear = m.year;
        bandStart = m.startX;
      }
      if (i === months.length - 1) yearBands.push({ year: curYear, startX: bandStart, endX: m.startX + m.width });
    });
  }

  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const bsDays = Math.round((+buildStart - +today) / 86400000);
  const M = { ready: 'var(--ready)', pending: 'var(--pending)', blue: 'var(--sdc-blue)', threat: 'var(--threat)' };

  const milestones = displayMilestones
    .filter(m => m.actualDate)
    .sort((a, b) => +a.actualDate - +b.actualDate)
    .map((m, i) => ({ ...m, row: i % 2 }));

  const TY = 95;
  const totalPOs = Object.values(summary).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="card" style={{ padding: '20px 24px 20px', marginBottom: 24, background: 'var(--bg-raised)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Schedule Health</span>
          <div className="meta-line">
            <span style={{ color: 'var(--ready-ink)' }}>71% on track</span>
            <span className="meta-dot" style={{ color: job.kpis.blocked > 0 ? 'var(--threat-ink)' : 'inherit' }}>{job.kpis.blocked > 0 ? `${job.kpis.blocked} risks detected` : 'Milestones on track'}</span>
            <span className="meta-dot" style={{ color: summary.overdue.length > 0 ? 'var(--threat-ink)' : 'inherit' }}>{summary.overdue.length + summary.blocking.length} POs need action</span>
            {smartsheet?.permalink && <>
              <span className="meta-dot" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--sdc-blue-ink)' }}>
                <window.IconCheck size={10} /> Smartsheet Connected
              </span>
              <a href={smartsheet.permalink} target="_blank" className="btn-ghost" style={{ fontSize: 9, padding: '2px 6px', height: 'auto', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: 'var(--sdc-blue-ink)', border: '1px solid var(--sdc-blue-soft)', background: 'var(--sdc-blue-soft)' }}>
                OPEN SCHEDULE <window.IconExternal size={10} />
              </a>
            </>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 'var(--t-sm)', alignItems: 'baseline' }}>
          <span style={{ color: 'var(--ink-3)' }}>Today <strong className="mono" style={{ color: 'var(--ink)', marginLeft: 4 }}>{fmtFull(today)}</strong></span>
          <span style={{ color: 'var(--ink-3)' }}>Build <strong className="mono" style={{ color: bsDays < 15 ? 'var(--threat-ink)' : 'var(--ink)', marginLeft: 4 }}>{fmtFull(buildStart)}</strong></span>
          <span style={{ color: 'var(--ink-3)' }}>Ship <strong className="mono" style={{ color: 'var(--ink)', marginLeft: 4 }}>{ship ? fmtFull(ship) : 'TBD'}</strong></span>
        </div>
      </div>

      {/* ── Scrollable Calendar Strip ── */}
      <div style={{ position: 'relative' }}>
        {canScrollLeft && (
          <button onClick={() => { scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' }); }} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 40, width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-raised)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--ink-2)', pointerEvents: 'all' }}>‹</button>
        )}
        {canScrollRight && (
          <button onClick={() => { scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' }); }} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 40, width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-raised)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--ink-2)', pointerEvents: 'all' }}>›</button>
        )}
      <div ref={scrollRef} onScroll={updateScrollBtns} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
        <div style={{ width: totalWidth, position: 'relative' }}>

          {/* TODAY full-height line */}
          <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)', background: 'var(--sdc-blue)', opacity: 0.65, zIndex: 30, pointerEvents: 'none' }} />

          {/* Year band */}
          <div style={{ position: 'relative', height: 18, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sunken)' }}>
            {yearBands.map((yb, i) => (
              <div key={i} style={{ position: 'absolute', left: yb.startX, width: yb.endX - yb.startX, height: '100%', borderLeft: i > 0 ? '2px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden' }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--ink-2)', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{yb.year}</span>
              </div>
            ))}
          </div>

          {/* Month band */}
          <div style={{ position: 'relative', height: 20, borderBottom: '1px solid var(--border-subtle)' }}>
            {months.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.startX, width: m.width, height: '100%', background: m.even ? 'var(--bg-sunken)' : 'var(--bg)', borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden' }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: m.isYearStart ? 'var(--sdc-blue)' : 'var(--ink-3)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{m.label}</span>
              </div>
            ))}
          </div>

          {/* Week tick ruler */}
          <div style={{ position: 'relative', height: 18, borderBottom: '1px solid var(--border-subtle)' }}>
            {months.map((m, i) => m.even ? <div key={i} style={{ position: 'absolute', left: m.startX, width: m.width, height: '100%', background: 'var(--bg-sunken)' }} /> : null)}
            {months.slice(1).map((m, i) => <div key={i} style={{ position: 'absolute', left: m.startX, top: 0, bottom: 0, width: 1, background: 'var(--border-subtle)' }} />)}
            {weeks.map((week, i) => {
              const x = dayToX(week);
              if (x < 5 || x > totalWidth - 5) return null;
              const isThisWeek = +week <= +today && +today < +week + 7 * 86400000;
              const label = week.getDate() === 1 ? week.toLocaleDateString('en-US', { month: 'short' }) : week.getDate();
              return (
                <div key={i} style={{ position: 'absolute', left: x, top: 0, bottom: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2, pointerEvents: 'none' }}>
                  <div style={{ width: 1, height: 4, background: isThisWeek ? 'var(--sdc-blue)' : 'var(--border)', marginBottom: 1 }} />
                  <span style={{ fontSize: 7.5, color: isThisWeek ? 'var(--sdc-blue)' : 'var(--ink-5)', fontWeight: isThisWeek ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Track area */}
          <div style={{ position: 'relative', height: TY + 58, background: 'var(--bg-raised)' }}>
            {months.map((m, i) => m.even ? <div key={i} style={{ position: 'absolute', left: m.startX, width: m.width, top: 0, bottom: 0, background: 'rgba(0,0,0,0.012)' }} /> : null)}
            {months.slice(1).map((m, i) => <div key={i} style={{ position: 'absolute', left: m.startX, top: 0, bottom: 0, width: 1, background: 'var(--border-subtle)', opacity: 0.4 }} />)}

            <div style={{ position: 'absolute', left: 0, right: 0, top: TY, height: 5, background: 'var(--bg-sunken)', borderRadius: 3 }} />
            <div style={{ position: 'absolute', left: 0, width: dayToX(today), top: TY, height: 5, background: 'linear-gradient(90deg, var(--ready), var(--sdc-blue))', borderRadius: 3 }} />

            {summary.overdue.length + summary.blocking.length + summary.atRisk.length > 0 && dayToX(buildStart) > dayToX(today) && (
              <div style={{ position: 'absolute', left: dayToX(today), width: dayToX(buildStart) - dayToX(today), top: TY, height: 5, background: 'repeating-linear-gradient(45deg, rgba(220,38,38,0.12) 0 4px, rgba(220,38,38,0.45) 4px 5px)', borderRadius: 3 }} />
            )}

            <div style={{ position: 'absolute', left: dayToX(buildStart), top: TY, bottom: 0, width: 1.5, background: 'var(--threat)', opacity: 0.45, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5 }} />
            {ship && <div style={{ position: 'absolute', left: dayToX(ship), top: TY, bottom: 0, width: 1, background: 'var(--ink-4)', opacity: 0.25, transform: 'translateX(-50%)', pointerEvents: 'none' }} />}

            <div style={{ position: 'absolute', left: todayX, top: TY - 22, transform: 'translateX(-50%)', background: 'var(--sdc-blue)', color: '#fff', fontSize: 7.5, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap', zIndex: 35, pointerEvents: 'none' }}>TODAY</div>
            <div style={{ position: 'absolute', left: dayToX(buildStart), top: TY + 13, transform: 'translateX(-50%)', background: 'var(--threat)', color: '#fff', fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none' }}>BUILD START</div>
            {ship && <div style={{ position: 'absolute', left: dayToX(ship), top: TY + 13, transform: 'translateX(-50%)', background: 'var(--bg-sunken)', border: '1px solid var(--border)', color: 'var(--ink-3)', fontSize: 7, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap', zIndex: 15, pointerEvents: 'none' }}>SHIP</div>}

            {/* Milestone chips */}
            {milestones.map(m => {
              const x = dayToX(m.actualDate);
              const c = M[m.color] || 'var(--ink-4)';
              const dft = Math.round((+m.actualDate - +today) / 86400000);
              const labelTop = m.row === 0 ? 7 : 35;
              const stemH = TY - 5 - (labelTop + 22);
              return (
                <div key={m.id} onMouseEnter={e => setHoveredItem({ type: 'milestone', data: m, date: m.actualDate, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setHoveredItem(null)} style={{ position: 'absolute', left: x, top: 0, bottom: 0, transform: 'translateX(-50%)', zIndex: 10, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', top: labelTop, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-raised)', border: `1.5px solid ${c}`, borderRadius: 4, padding: '2px 7px', fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', color: c, textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.09)' }}>
                    {m.label}
                    <span style={{ marginLeft: 4, opacity: 0.55, fontWeight: 500, fontSize: 7 }}>{dft >= 0 ? `+${dft}d` : `${dft}d`}</span>
                  </div>
                  {stemH > 2 && <div style={{ position: 'absolute', top: labelTop + 22, left: '50%', transform: 'translateX(-50%)', width: 1, height: stemH, background: c, opacity: 0.28 }} />}
                  <div style={{ position: 'absolute', top: TY + 2, left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: 9, height: 9, background: c, border: '2px solid var(--bg-raised)', borderRadius: 2, boxShadow: `0 0 0 1px ${c}`, zIndex: 12 }} />
                </div>
              );
            })}

            {/* Classified PO threat markers — color-coded by risk */}
            {classifiedMarkers.map((m, i) => {
              const { color } = CLS[m.cls];
              const size = m.cls === 'overdue' ? 11 : m.cls === 'blocking' ? 10 : 8;
              const isPinned = pinnedItem?.data === m;
              return (
                <div key={i}
                  data-timeline-diamond="1"
                  onMouseEnter={e => !pinnedItem && setHoveredItem({ type: 'threat', data: m, rect: e.currentTarget.getBoundingClientRect() })}
                  onMouseLeave={() => !pinnedItem && setHoveredItem(null)}
                  onClick={e => {
                    if (wasDragged.current) { wasDragged.current = false; return; }
                    e.stopPropagation();
                    setHoveredItem(null);
                    setPinnedItem(isPinned ? null : { type: 'threat', data: m, rect: e.currentTarget.getBoundingClientRect() });
                  }}
                  style={{ position: 'absolute', top: TY + 7, left: dayToX(m.date), transform: 'translateX(-50%) rotate(45deg)', width: size, height: size, background: color, border: isPinned ? `2px solid var(--bg-raised)` : '1.5px solid var(--bg-raised)', borderRadius: 1, boxShadow: isPinned ? `0 0 0 2px ${color}, 0 0 8px ${color}80` : `0 0 5px ${color}60`, zIndex: isPinned ? 20 : 15, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                />
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* ── PO Classification Summary ── */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {Object.entries(CLS).map(([cls, cfg]) => {
          const entries = summary[cls] || [];
          const vendors = [...new Set(entries.map(e => e.supplier))];
          const isEmpty = entries.length === 0;
          const totalAtRisk = entries.reduce((s, e) =>
            s + (e.po?.parts?.reduce((ps, p) => ps + ((p.remaining || 0) * (p.price || 0)), 0) || 0), 0);
          const totalParts = entries.reduce((s, e) => s + (e.po?.parts?.length || 0), 0);
          const worstDays = isEmpty ? null : Math.min(...entries.map(e => e.worstDays));
          return (
            <div key={cls} style={{ borderRadius: 7, background: isEmpty ? 'var(--bg-sunken)' : cfg.bg, border: `1px solid ${isEmpty ? 'var(--border-subtle)' : cfg.color + '30'}`, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: isEmpty ? 'var(--border)' : cfg.color, flexShrink: 0, transform: 'rotate(45deg)' }} />
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: isEmpty ? 'var(--ink-5)' : 'var(--ink-3)' }}>{cfg.label}</span>
                </div>
                {!isEmpty && worstDays != null && (
                  <span style={{ fontSize: 8, fontWeight: 700, color: cfg.color, background: 'var(--bg-raised)', border: `1px solid ${cfg.color}30`, padding: '1px 5px', borderRadius: 3 }}>
                    {worstDays < 0 ? `${Math.abs(worstDays)}d late` : `${worstDays}d`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: isEmpty ? 'var(--ink-5)' : cfg.color }}>{entries.length}</span>
                <span style={{ fontSize: 9, color: 'var(--ink-4)' }}>PO{entries.length !== 1 ? 's' : ''}</span>
                {!isEmpty && totalParts > 0 && <span style={{ fontSize: 9, color: 'var(--ink-4)', marginLeft: 2 }}>· {totalParts} parts</span>}
              </div>
              {!isEmpty && totalAtRisk > 0 && (
                <div style={{ fontSize: 9, fontWeight: 600, color: cfg.color, marginBottom: 5 }}>
                  ${totalAtRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })} at risk
                </div>
              )}
              {isEmpty ? (
                <span style={{ fontSize: 8, color: 'var(--ink-5)' }}>{cfg.sub}</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                  {vendors.slice(0, 3).map((v, i) => (
                    <span key={i} style={{ fontSize: 7.5, background: 'var(--bg-raised)', border: `1px solid ${cfg.color}35`, color: 'var(--ink-2)', padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                  ))}
                  {vendors.length > 3 && <span style={{ fontSize: 7.5, color: 'var(--ink-5)' }}>+{vendors.length - 3} more</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Timeline markers:</span>
        {Object.entries(CLS).filter(([k]) => k !== 'safe').map(([cls, cfg]) => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, background: cfg.color, borderRadius: 1, transform: 'rotate(45deg)', flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: 'var(--ink-4)' }}>{cfg.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 8, color: 'var(--ink-5)', marginLeft: 'auto' }}>{totalPOs} POs total across all categories</span>
      </div>

      {/* ── Tooltip (hover preview + click-to-pin for full interactive view) ── */}
      {activeItem && (() => {
        const { type, data, rect, date } = activeItem;
        const isPinned = !!pinnedItem;

        // Smart positioning
        const tipW = isPinned ? 480 : 320;
        const estH = isPinned ? 520 : 300;
        const spaceAbove = rect.top - 12;
        const useBelow = spaceAbove < estH;
        const hPos = { left: Math.max(8, Math.min(window.innerWidth - tipW - 8, rect.left + rect.width / 2 - tipW / 2)) };
        const vPos = useBelow ? { top: rect.bottom + 10 } : { bottom: window.innerHeight - rect.top + 10 };
        const baseStyle = {
          position: 'fixed', ...hPos, ...vPos, width: tipW, zIndex: 1000,
          boxShadow: isPinned ? '0 8px 32px rgba(0,0,0,0.22)' : 'var(--shadow-lg)',
          pointerEvents: isPinned ? 'all' : 'none',
          borderRadius: 10, overflow: 'hidden',
          transition: 'width 0.15s, box-shadow 0.15s',
        };

        if (type === 'milestone') {
          const dft = Math.round((+date - +today) / 86400000);
          return (
            <div data-timeline-tooltip="1" style={{ ...baseStyle, background: 'var(--bg-raised)', border: '1px solid var(--border)', padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>MILESTONE · {fmt(date)}</span>
                <span className={`badge badge-${data.color || 'neutral'}`}>{dft >= 0 ? 'ON TRACK' : 'DELAYED'}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{data.label}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {dft >= 0 ? `Target in ${dft} days` : `Delayed by ${Math.abs(dft)} days`}
              </div>
            </div>
          );
        }

        // ── Rich threat tooltip ──────────────────────────────────────
        const cfg = CLS[data.cls] || CLS.overdue;
        const bsDaysRemaining = Math.round((+buildStart - +data.date) / 86400000);
        const totalPartsCount = data.items.reduce((s, e) => s + (e.po.parts?.length || 0), 0);
        const totalValue = data.items.reduce((s, e) =>
          s + (e.po.parts?.reduce((ps, p) => ps + ((p.remaining || 0) * (p.price || 0)), 0) || 0), 0);

        return (
          <div data-timeline-tooltip="1" style={{ ...baseStyle, background: 'var(--bg-raised)', border: `1.5px solid ${cfg.color}40`, display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}25`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ETA: {fmt(data.date)}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{data.items.length} PO{data.items.length !== 1 ? 's' : ''} · {totalPartsCount} part{totalPartsCount !== 1 ? 's' : ''}</span>
                  {totalValue > 0 && <span style={{ color: cfg.color, fontWeight: 700 }}>${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} at risk</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800, color: cfg.color, background: 'var(--bg-raised)', border: `1px solid ${cfg.color}50`, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
                  {isPinned && (
                    <button onClick={() => setPinnedItem(null)} style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-sunken)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>✕</button>
                  )}
                </div>
                <span style={{ fontSize: 8, color: bsDaysRemaining < 0 ? cfg.color : 'var(--ink-4)', fontWeight: bsDaysRemaining < 0 ? 700 : 400 }}>
                  {bsDaysRemaining > 0 ? `${bsDaysRemaining}d before build` : bsDaysRemaining === 0 ? 'build starts today' : `${Math.abs(bsDaysRemaining)}d past build start`}
                </span>
              </div>
            </div>

            {!isPinned && (
              <div style={{ padding: '7px 14px', background: 'var(--bg-sunken)', borderBottom: `1px solid ${cfg.color}15`, fontSize: 9, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10 }}>👆</span> Click diamond to pin & scroll full details
              </div>
            )}

            {/* PO entries — fully scrollable when pinned */}
            <div style={{ padding: '10px 14px', overflowY: isPinned ? 'auto' : 'hidden', maxHeight: isPinned ? 380 : 220, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {data.items.map((entry, idx) => {
                const parts = entry.po.parts || [];
                const totalQty = parts.reduce((s, p) => s + (p.qty || 0), 0);
                const totalRcvd = parts.reduce((s, p) => s + (p.received || 0), 0);
                const rcvdPct = totalQty > 0 ? Math.round(totalRcvd / totalQty * 100) : 0;
                const entryValue = parts.reduce((s, p) => s + ((p.remaining || 0) * (p.price || 0)), 0);
                const showParts = isPinned || idx === 0; // show all parts when pinned, only first PO when hovering
                return (
                  <div key={idx} style={{ paddingBottom: idx < data.items.length - 1 ? 12 : 0, borderBottom: idx < data.items.length - 1 ? `1px solid ${cfg.color}15` : 'none' }}>

                    {/* Supplier row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.supplier}</div>
                        <div style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="mono">PO {entry.po?.poId || 'N/A'}</span>
                          {entry.phone && <span>📞 {entry.phone}</span>}
                          {entry.email && <span>✉ {entry.email}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontVariantNumeric: 'tabular-nums' }}>
                          {entry.worstDays < 0 ? `${Math.abs(entry.worstDays)}d late` : `due in ${entry.worstDays}d`}
                        </div>
                        {entryValue > 0 && <div style={{ fontSize: 9, color: 'var(--ink-4)' }}>${entryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>}
                      </div>
                    </div>

                    {/* Receipt progress bar */}
                    {totalQty > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ height: 5, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${rcvdPct}%`, background: rcvdPct === 100 ? 'var(--ready)' : rcvdPct > 0 ? 'var(--pending)' : cfg.color, borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 8, color: 'var(--ink-5)' }}>{totalRcvd} of {totalQty} units received</span>
                          <span style={{ fontSize: 8, fontWeight: 700, color: rcvdPct === 100 ? 'var(--ready-ink)' : 'var(--ink-4)' }}>{rcvdPct}%</span>
                        </div>
                      </div>
                    )}

                    {/* Parts breakdown — full table */}
                    {showParts && parts.length > 0 && (() => {
                      const rcvdParts    = parts.filter(p => (p.received || 0) >= (p.qty || 1) && (p.qty || 0) > 0);
                      const partialParts = parts.filter(p => (p.received || 0) > 0 && (p.received || 0) < (p.qty || 1));
                      const missingParts = parts.filter(p => (p.received || 0) === 0);
                      const fmtD = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
                      const COL = '10px 85px 1fr 52px 60px';
                      const hdrStyle = { fontSize: 8, color: 'var(--ink-4)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' };
                      const PartRow = ({ p: pr, dot, textColor }) => (
                        <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 6, alignItems: 'center', padding: '3px 0' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                          <span className="mono" style={{ fontSize: 9.5, color: textColor, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.partNumber || '—'}</span>
                          <span style={{ fontSize: 8.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.partDesc || ''}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: textColor, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pr.received || 0}/{pr.qty || 0}</span>
                          <span style={{ fontSize: 8.5, color: 'var(--ink-4)', textAlign: 'right' }}>{fmtD(pr.dueDate)}</span>
                        </div>
                      );
                      return (
                        <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)', marginTop: 4 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 6, padding: '5px 8px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span /><span style={hdrStyle}>Part #</span><span style={hdrStyle}>Description</span>
                            <span style={{ ...hdrStyle, textAlign: 'right' }}>Rcvd</span>
                            <span style={{ ...hdrStyle, textAlign: 'right' }}>Due</span>
                          </div>
                          {rcvdParts.length > 0 && (
                            <div style={{ padding: '2px 8px 4px', background: 'rgba(22,163,74,0.04)', borderBottom: (partialParts.length + missingParts.length) > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--ready-ink)', letterSpacing: '0.05em', padding: '4px 0 1px', textTransform: 'uppercase' }}>✓ Received ({rcvdParts.length})</div>
                              {rcvdParts.map((p, pi) => <PartRow key={pi} p={p} dot="#16a34a" textColor="var(--ready-ink)" />)}
                            </div>
                          )}
                          {partialParts.length > 0 && (
                            <div style={{ padding: '2px 8px 4px', background: 'rgba(217,119,6,0.04)', borderBottom: missingParts.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                              <div style={{ fontSize: 8, fontWeight: 700, color: '#d97706', letterSpacing: '0.05em', padding: '4px 0 1px', textTransform: 'uppercase' }}>◑ Partial ({partialParts.length})</div>
                              {partialParts.map((p, pi) => <PartRow key={pi} p={p} dot="#d97706" textColor="#92400e" />)}
                            </div>
                          )}
                          {missingParts.length > 0 && (
                            <div style={{ padding: '2px 8px 4px', background: `${cfg.color}06` }}>
                              <div style={{ fontSize: 8, fontWeight: 700, color: cfg.color, letterSpacing: '0.05em', padding: '4px 0 1px', textTransform: 'uppercase' }}>✕ Outstanding ({missingParts.length})</div>
                              {missingParts.map((p, pi) => <PartRow key={pi} p={p} dot={cfg.color} textColor={cfg.color} />)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {!showParts && parts.length > 0 && (
                      <div style={{ fontSize: 8, color: 'var(--ink-4)', fontStyle: 'italic' }}>Click to pin &amp; see all {parts.length} parts</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer — drill-down button (only interactive when pinned) */}
            {onDrillDown && (
              <div style={{ padding: '9px 14px', borderTop: `1px solid ${cfg.color}20`, background: cfg.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 8, color: 'var(--ink-5)' }}>{data.items.length} PO{data.items.length !== 1 ? 's' : ''} on {fmt(data.date)}</span>
                <button
                  onClick={() => { setPinnedItem(null); onDrillDown(data.items.map(e => e.po.poId)); }}
                  style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: 'none', border: `1px solid ${cfg.color}40`, borderRadius: 5, padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.02em' }}
                >
                  View in PO Tracker →
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

window.TimelineRibbon = TimelineRibbon;
