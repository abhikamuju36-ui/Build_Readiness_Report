// Build Readiness Tab — Premium SDC Design
const { useState, useMemo, useEffect } = React;

function statusColor(s) {
  if (s === 'ready' || s === 'received') return 'var(--ready)';
  if (s === 'close' || s === 'ordered') return 'var(--pending)';
  if (s === 'blocked' || s === 'threat' || s === 'noPO' || s === 'no_po') return 'var(--threat)';
  return 'var(--ink-4)';
}

function ReadinessTab({ data, query, setQuery, statusFilter, setStatusFilter, jobId }) {
  const { job, readiness } = data;
  const [expandAction, setExpandAction] = useState({ type: null, version: 0 });

  // Calculate accurate counts dynamically
  const stats = useMemo(() => {
    let ready = 0, close = 0, blocked = 0, noPO = 0;
    let totalParts = 0, receivedParts = 0;
    const specCounts = {};

    readiness.forEach(s => {
      specCounts[s.spec] = s.lines || 0;
      s.assemblies.forEach(a => {
        const pct = a.pct || a.stats?.pct || 0;
        if (pct >= 85) ready++;
        else if (pct >= 60) close++;
        else blocked++;
        
        noPO += (a.noPo || a.stats?.noPO || 0);
        totalParts += (a.total || a.stats?.total || 0);
        receivedParts += (a.ready || a.stats?.received || 0);
      });
    });
    return { ready, close, blocked, noPO, specCounts, totalParts, receivedParts };
  }, [readiness]);

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
      <window.TimelineRibbon job={job} poActions={data.poActions} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 24, alignItems: 'flex-start' }}>
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
              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }}/>
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
                  {f.dot && <span className={`dot-led ${f.dot}`} style={{margin: 0}}/>}
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
                 <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--threat-ink)" }}>{new Date(job.buildStart).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</span>
               </div>
               <div style={{ display: "flex", flexDirection: "column" }}>
                 <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Ship Date</span>
                 <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{new Date(job.shipDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</span>
               </div>
               <div style={{ width: 1, height: 24, background: "var(--border)" }}/>
               <div style={{ display: "flex", flexDirection: "column" }}>
                 <span style={{ fontSize: 9, fontWeight: 700, color: "var(--ink-4)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Readiness</span>
                 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                   <div style={{ width: 100, height: 6, background: "var(--bg-sunken)", borderRadius: 3, overflow: "hidden" }}>
                     <div style={{ width: `${Math.round((stats.receivedParts / (stats.totalParts || 1)) * 100)}%`, height: "100%", background: "var(--ready)" }}/>
                   </div>
                   <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ready-ink)" }}>{Math.round((stats.receivedParts / (stats.totalParts || 1)) * 100)}%</span>
                 </div>
               </div>
             </div>
             
             <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}>
                  <window.IconClock size={12} style={{ verticalAlign: 'middle', marginRight: 4, marginTop: -2 }}/>
                  {Math.round((new Date(job.buildStart) - new Date()) / 86400000)} days to build
                </span>
                <button className="btn btn-sm btn-primary" onClick={handleExpandAll}>Expand All</button>
             </div>
           </div>

           <div className="card" style={{ overflow: "hidden" }}>
            {filteredSpecs.map(spec => (
              <div key={spec.spec} id={`spec-${spec.spec}`}>
                <div style={{ 
                  padding: "14px 18px", 
                  display: "flex", 
                  alignItems: "baseline", 
                  gap: 12,
                  background: "var(--bg-sunken)",
                  borderBottom: "1px solid var(--border-subtle)"
                }}>
                  <h2 style={{ margin: 0, fontSize: "var(--t-xl)", fontWeight: 600, letterSpacing: "-0.01em" }}>
                    Spec {spec.spec} — {spec.title}
                  </h2>
                  <span className="meta-line">{spec.lines} BOM lines · {spec.assemblies.length} assemblies</span>
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

        <RightRail 
          stats={stats} 
          readiness={readiness} 
          critical={data.poActions?.critical || []} 
          statusFilter={statusFilter} 
          setStatusFilter={setStatusFilter}
          handleExpandAll={handleExpandAll}
          handleCollapseAll={handleCollapseAll}
        />
      </div>
    </div>
  );
}

function AssemblyRow({ a, jobId, isLast, depth = 0, expandAction }) {
  const [open, setOpen] = useState(false);
  const node = a.node || {};
  const children = node.children || [];
  const parts = node.parts || [];

  useEffect(() => {
    if (expandAction.type === 'expand') setOpen(true);
    if (expandAction.type === 'collapse') setOpen(false);
  }, [expandAction.version]);

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid var(--border-subtle)" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "grid",
          gridTemplateColumns: "auto 120px 1fr auto auto",
          alignItems: "center",
          gap: 16,
          padding: `14px 18px 14px ${18 + (depth * 20)}px`,
          cursor: "pointer",
          background: open ? "var(--bg-sunken)" : "var(--bg-raised)",
          transition: "background 0.2s"
        }}
      >
        <button style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
          {open ? <window.IconCaretDown size={11}/> : <window.IconCaretRight size={11}/>}
        </button>
        <span className="mono" style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", padding: "2px 7px", background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: 3, justifySelf: "start" }}>{a.code || a.pn}</span>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: "var(--t-md)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.desc || 'No Description'}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, paddingRight: 10 }}>
          <Stat label="READY" value={a.ready || a.stats?.received || 0} accent="ready" />
          <Stat label="TOTAL" value={a.total || a.stats?.total || 0} accent="blue" />
          <Stat label="SUB-ASSY" value={children.length} />
          <Stat label="NO-PO" value={a.noPo || a.stats?.noPO || 0} accent={(a.noPo || a.stats?.noPO) > 0 ? "threat" : "neutral"} />
          <Stat label="HEALTH" value={`${a.pct || a.stats?.pct || 0}%`} mono />
        </div>
        <window.HealthRing value={a.pct || a.stats?.pct || 0} />
      </div>

      {open && (
        <div className="fade-in" style={{ background: "var(--bg)", borderTop: "1px solid var(--border-subtle)" }}>
          {(parts.length > 0 || children.length > 0) && (
             <div style={{
              display: "grid",
              gridTemplateColumns: "70px 110px 90px 1fr 50px 180px 80px 80px 60px",
              gap: 14,
              padding: `10px 18px 8px ${34 + (depth * 20)}px`,
              fontSize: 10,
              color: "var(--ink-4)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <span>Status</span><span>Part #</span><span>PO #</span><span>Description</span>
              <span style={{ textAlign: "right" }}>Qty</span><span>Vendor</span>
              <span>Expected</span><span>Req</span><span style={{ textAlign: "right" }}>Slip</span>
            </div>
          )}

          {children.map((child, i) => (
            <AssemblyRow 
              key={child.pn + i} 
              a={{ ...child, code: child.pn, status: (child.stats?.pct >= 85) ? 'ready' : (child.stats?.pct >= 60) ? 'close' : 'blocked', node: child }} 
              jobId={jobId} 
              isLast={false} 
              depth={depth + 1}
              expandAction={expandAction}
            />
          ))}

          {parts.map((p, i) => {
            const po = p.pos?.[0] || {};
            const slip = po.dueDate && p.requiredDate ? Math.round((new Date(po.dueDate) - new Date(p.requiredDate)) / 86400000) : 0;
            const isNoPo = p.status === 'noPO' || p.status === 'no_po';
            return (
              <div key={i} className="row-hover" style={{
                display: "grid",
                gridTemplateColumns: "70px 110px 90px 1fr 50px 180px 80px 80px 60px",
                gap: 14,
                padding: `10px 18px 10px ${34 + (depth * 20)}px`,
                alignItems: "center",
                fontSize: "var(--t-md)",
                borderBottom: "1px solid var(--border-subtle)",
                background: isNoPo ? "var(--threat-soft)" : "transparent"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isNoPo ? (
                    <span style={{ color: "var(--threat-ink)", fontWeight: 800, fontSize: 9, letterSpacing: '0.04em', display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <window.IconCircleX size={10} sw={2} /> NO PO
                    </span>
                  ) : (
                    <window.StatusBadge status={p.status === 'received' ? 'RCVD' : p.status === 'ordered' ? 'PO' : 'PAST DUE'} />
                  )}
                </div>
                <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 500 }}>{p.pn}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{po.poId || '—'}</span>
                <span style={{ color: "var(--ink)", fontWeight: isNoPo ? 600 : 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</span>
                <span className="mono tnum" style={{ textAlign: "right", color: "var(--ink-2)", fontSize: 13, paddingRight: 4 }}>{p.qty}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-2)", fontSize: 13 }}>
                  <window.VendorAvatar vendor={po.supplier || (isNoPo ? 'McMaster-Carr' : 'Unassigned')} size={20}/> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {po.supplier || (isNoPo ? 'McMaster-Carr' : 'Unassigned')}
                  </span>
                </span>
                <span className="mono" style={{ color: "var(--ink-3)", fontSize: 12 }}>{po.dueDate ? new Date(po.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'TBD'}</span>
                <span className="mono" style={{ color: "var(--ink-4)", fontSize: 11 }}>{p.requiredDate ? new Date(p.requiredDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}</span>
                <span className="mono" style={{ textAlign: "right", color: slip > 0 ? "var(--threat-ink)" : "var(--ink-3)", fontSize: 12 }}>
                  {slip > 0 ? `+${slip}d` : slip < 0 ? `${slip}d` : '—'}
                </span>
              </div>
            );
          })}
          
          {depth === 0 && (
            <div style={{ padding: "12px 8px 16px 34px", display: "flex", gap: 8 }}>
              <button className="btn btn-sm"><window.IconExport size={11}/> Export Lines</button>
              <button className="btn btn-sm" style={{ background: "var(--sdc-blue-soft)", color: "var(--sdc-blue-ink)", borderColor: "var(--sdc-blue-soft)" }}>
                <window.IconMail size={11}/> Draft Chase Email
              </button>
              <button className="btn btn-sm btn-ghost"><window.IconLink size={11}/> Link in SolidWorks</button>
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
function RightRail({ stats, readiness, critical, statusFilter, setStatusFilter, handleExpandAll, handleCollapseAll }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* List Controls */}
      <div className="card" style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="eyebrow" style={{ fontSize: 10, color: "var(--ink-4)" }}>List Controls</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={handleCollapseAll} style={{ padding: "6px 12px", fontSize: 12 }}>Collapse All</button>
            <button className="btn-primary" onClick={handleExpandAll} style={{ padding: "6px 12px", fontSize: 12 }}>Expand All</button>
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div className="row-hover" onClick={() => setStatusFilter('all')} style={{ background: "var(--bg-sunken)", padding: "16px 12px", borderRadius: 8, borderLeft: "3px solid var(--ink-4)", cursor: "pointer", boxShadow: statusFilter === 'all' ? '0 0 0 2px var(--ink-4)' : 'none' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{stats.ready + stats.close + stats.blocked}</div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 4 }}>Assemblies</div>
          </div>
          <div className="row-hover" onClick={() => setStatusFilter('ready')} style={{ background: "var(--bg-sunken)", padding: "16px 12px", borderRadius: 8, borderLeft: "3px solid var(--ready)", cursor: "pointer", boxShadow: statusFilter === 'ready' ? '0 0 0 2px var(--ready)' : 'none' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{stats.ready}</div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 4, color: "var(--ready-ink)" }}>Ready to Build</div>
          </div>
          <div className="row-hover" onClick={() => setStatusFilter('close')} style={{ background: "var(--bg-sunken)", padding: "16px 12px", borderRadius: 8, borderLeft: "3px solid var(--pending)", cursor: "pointer", boxShadow: statusFilter === 'close' ? '0 0 0 2px var(--pending)' : 'none' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{stats.close}</div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 4, color: "var(--pending-ink)" }}>Close (80-99%)</div>
          </div>
          <div className="row-hover" onClick={() => setStatusFilter('blocked')} style={{ background: "var(--bg-sunken)", padding: "16px 12px", borderRadius: 8, borderLeft: "3px solid var(--threat)", cursor: "pointer", boxShadow: statusFilter === 'blocked' ? '0 0 0 2px var(--threat)' : 'none' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{stats.blocked}</div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 4, color: "var(--threat-ink)" }}>Blocked (&lt;60%)</div>
          </div>
        </div>

        <div 
          className="row-hover" 
          onClick={() => setStatusFilter('noPO')}
          style={{ 
            background: "var(--bg-sunken)", padding: "20px", borderRadius: 8, 
            textAlign: "center", cursor: "pointer", border: statusFilter === 'noPO' ? "2px solid var(--threat)" : "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--threat-ink)" }}>{stats.noPO}</div>
          <div className="eyebrow" style={{ fontSize: 11, marginTop: 6, color: "var(--threat-ink)" }}>Parts — No PO</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="dot-led threat" style={{margin:0}}/>Late / Critical POs
          </span>
          <span className="badge badge-threat">{critical.length} LATE</span>
        </div>
        <div style={{ maxHeight: 460, overflowY: "auto" }}>
          {critical.slice(0, 15).map((entry, i) => (
            <div key={i} style={{ padding: "12px 18px", borderBottom: i < critical.length - 1 ? "1px solid var(--border-subtle)" : "none", display: "flex", alignItems: "center", gap: 14 }}>
              <window.VendorAvatar vendor={entry.supplier} size={28}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.supplier}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>PO {entry.po?.poId || '10XXXX'}</div>
              </div>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "#8E2E2E" }}>-{entry.worstDays}d</span>
            </div>
          ))}
          {critical.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>No late POs.</div>}
        </div>
      </div>
    </div>
  );
}

window.ReadinessTab = ReadinessTab;
