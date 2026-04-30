// Schedule Health ribbon — Premium SDC Design
const { useState, useMemo } = React;

function TimelineRibbon({ job, poActions }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const today = new Date();
  const buildStart = new Date(job.buildStart);
  const ship = new Date(job.shipDate);

  // Define scale: projStart (buildStart - 6mo) to ship
  const projStart = new Date(buildStart);
  projStart.setMonth(projStart.getMonth() - 6);
  const totalMs = ship - projStart;

  const dayToPct = (d) => Math.max(0, Math.min(100, ((new Date(d) - projStart) / totalMs) * 100));

  const milestones = [
    { id: 'all', label: 'All Parts', date: 'May 25', color: 'ready', offset: -20 },
    { id: 'panel', label: 'Panel Build Start', date: 'May 30', color: 'blue', offset: -15 },
    { id: 'wiring', label: 'Wiring Start', date: 'Jun 24', color: 'pending', offset: 10 },
    { id: 'complete', label: 'Wiring Complete', date: 'Jul 4', color: 'ready', offset: 20 },
    { id: 'power', label: 'Power Up', date: 'Jul 9', color: 'ready', offset: 25 },
  ];

  const threatMarkers = useMemo(() => {
    const map = {};
    (poActions?.critical || []).forEach(c => {
      if (!c.po?.dueDate) return;
      const d = new Date(c.po.dueDate);
      const dStr = d.toISOString().split('T')[0];
      if (!map[dStr]) map[dStr] = { date: d, items: [] };
      map[dStr].items.push(c);
    });
    return Object.values(map);
  }, [poActions]);

  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const bsDays = Math.round((buildStart - today) / 86400000);
  const slippingCount = poActions?.critical?.length || 0;

  return (
    <div className="card" style={{ padding: "20px 24px 22px", marginBottom: 24, background: 'var(--bg-raised)', position: 'relative' }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Schedule Health</div>
          <div className="meta-line">
            <span style={{ color: 'var(--ready-ink)' }}>71% on track</span>
            <span className="meta-dot">{job.kpis.blocked > 0 ? `${job.kpis.blocked} risks detected` : 'Milestones on track'}</span>
            <span className="meta-dot" style={{ color: slippingCount > 0 ? 'var(--threat-ink)' : 'inherit' }}>{slippingCount} POs slipping</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, fontSize: "var(--t-sm)" }}>
          <span style={{ color: "var(--ink-3)" }}>Today <strong className="mono" style={{ color: "var(--ink)", marginLeft: 4 }}>{fmt(today)}</strong></span>
          <span style={{ color: "var(--ink-3)" }}>Build <strong className="mono" style={{ color: bsDays < 15 ? 'var(--threat-ink)' : 'var(--ink)', marginLeft: 4 }}>{fmt(buildStart)}</strong></span>
          <span style={{ color: "var(--ink-3)" }}>Ship <strong className="mono" style={{ color: "var(--ink)", marginLeft: 4 }}>{fmt(ship)}</strong></span>
        </div>
      </div>

      <div style={{ position: "relative", height: 56, marginTop: 8 }}>
        {/* Base track */}
        <div style={{
          position: "absolute", top: 22, left: 0, right: 0, height: 6,
          background: "var(--bg-sunken)", borderRadius: 3, border: "1px solid var(--border-subtle)"
        }} />

        {/* Today → Build Start threat window */}
        {slippingCount > 0 && (
          <div style={{
            position: "absolute",
            left: `${dayToPct(today)}%`,
            width: `${dayToPct(buildStart) - dayToPct(today)}%`,
            top: 22, height: 6,
            background: "repeating-linear-gradient(45deg, var(--threat-soft) 0 4px, var(--threat) 4px 5px)",
            borderRadius: 3,
            opacity: 0.85,
          }} />
        )}

        {/* Progress Fill */}
        <div style={{
          position: "absolute", top: 22, left: 0,
          width: `${dayToPct(today)}%`, height: 6,
          background: "linear-gradient(90deg, var(--ready) 0%, var(--ready) 80%, var(--sdc-blue) 100%)",
          borderRadius: 3,
        }} />

        {/* Today marker */}
        <div style={{
          position: "absolute", top: 12, left: `${dayToPct(today)}%`,
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--sdc-blue)", letterSpacing: '0.05em' }}>TODAY</span>
          <div style={{ width: 2, height: 28, background: "var(--sdc-blue)" }} />
        </div>

        {/* Build start marker */}
        <div style={{
          position: "absolute", top: 12, left: `${dayToPct(buildStart)}%`,
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--threat)", letterSpacing: '0.05em' }}>BUILD START</span>
          <div style={{ width: 2, height: 28, background: "var(--threat)" }} />
        </div>

        {/* Milestone diamonds */}
        {milestones.map((m, i) => {
          const colors = { ready: "var(--ready)", pending: "var(--pending)", blue: "var(--sdc-blue)", threat: "var(--threat)" };
          const date = new Date(buildStart);
          date.setDate(date.getDate() + m.offset);
          return (
            <div key={i}
              onMouseEnter={(e) => setHoveredItem({ type: 'milestone', data: m, date, rect: e.currentTarget.getBoundingClientRect() })}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                position: "absolute", top: 18, left: `${dayToPct(date)}%`,
                transform: "translateX(-50%) rotate(45deg)",
                width: 12, height: 12,
                background: colors[m.color] || 'var(--ink-4)',
                border: "2px solid var(--bg-raised)",
                borderRadius: 2,
                boxShadow: "0 0 0 1px " + (colors[m.color] || 'var(--ink-4)'),
                zIndex: 10,
                cursor: 'pointer'
              }} />
          );
        })}

        {/* Slipping PO Diamonds */}
        {threatMarkers.map((m, i) => {
          const pct = dayToPct(m.date);
          return (
            <div key={i}
              onMouseEnter={(e) => setHoveredItem({ type: 'threat', data: m, rect: e.currentTarget.getBoundingClientRect() })}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                position: "absolute", top: 22, left: `${pct}%`,
                transform: "translate(-50%, -50%) rotate(45deg)",
                width: 9, height: 9,
                background: "var(--threat)",
                border: "1.5px solid var(--bg-raised)",
                borderRadius: 1,
                boxShadow: "0 0 6px var(--threat)",
                zIndex: 20,
                cursor: "pointer"
              }}
            />
          );
        })}
      </div>

      {/* Milestone Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 18 }}>
        {milestones.map((m, i) => {
          const colors = { ready: "var(--ready)", pending: "var(--pending)", blue: "var(--sdc-blue)", threat: "var(--threat)" };
          const date = new Date(buildStart);
          date.setDate(date.getDate() + m.offset);
          const daysFromToday = Math.round((date - today) / 86400000);
          return (
            <div key={i} style={{ borderLeft: `2px solid ${colors[m.color]}`, padding: "2px 12px" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 700 }}>{m.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{fmt(date)}</span>
                <span className="mono" style={{ fontSize: 10, color: daysFromToday >= 0 ? "var(--ink-4)" : "var(--threat-ink)" }}>
                  {daysFromToday >= 0 ? `+${daysFromToday}d` : `${daysFromToday}d`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unified Tooltip */}
      {hoveredItem && (() => {
        const { type, data, rect, date } = hoveredItem;
        const tipW = 220;
        const left = rect.left + rect.width / 2 - tipW / 2;
        const bottom = window.innerHeight - rect.top + 10;

        if (type === 'milestone') {
          const daysFromToday = Math.round((date - today) / 86400000);
          return (
            <div style={{
              position: 'fixed', left, bottom, width: tipW, zIndex: 1000,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>MILESTONE: {fmt(date)}</span>
                <span className={`badge badge-${data.color || 'neutral'}`}>{daysFromToday >= 0 ? 'ON TRACK' : 'DELAYED'}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{data.label}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {daysFromToday >= 0 ? `Target reached in ${daysFromToday} days` : `Delayed by ${Math.abs(daysFromToday)} days`}
              </div>
            </div>
          );
        }

        return (
          <div style={{
            position: 'fixed', left, bottom, width: tipW, zIndex: 1000,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 12px', boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none'
          }}>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>ETA: {fmt(data.date)}</span>
              <span className="badge badge-threat">{data.items.length} POs</span>
            </div>
            {data.items.slice(0, 4).map((it, idx) => (
              <div key={idx} style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{it.supplier}</span>
                  <span className="mono" style={{ color: 'var(--threat-ink)', fontWeight: 700, fontSize: 10 }}>{it.worstDays}d Late</span>
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 1 }}>PO {it.po?.poId || 'N/A'}</div>
              </div>
            ))}
            {data.items.length > 4 && <div style={{ fontSize: 9, color: 'var(--ink-4)', textAlign: 'center', marginTop: 4 }}>+ {data.items.length - 4} more POs</div>}
          </div>
        );
      })()}
    </div>
  );
}

window.TimelineRibbon = TimelineRibbon;
