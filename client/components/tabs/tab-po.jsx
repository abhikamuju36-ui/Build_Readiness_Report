// PO Action List — Parts view + Vendor lens
const { useState, useMemo, useEffect } = React;

function PoTab({ data }) {
  const [view, setView] = useState('parts');
  const [poViewMode, setPoViewMode] = useState('list'); // 'list' or 'schedule'
  const [query, setQuery] = useState('');
  const [expandAction, setExpandAction] = useState({ type: null, version: 0 });
  const vendors = useMemo(() => window.aggregateVendors(data.nopo, data.emails), [data]);

  const lateCount = (data.poActions?.critical?.length || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'hidden' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: '-0.02em' }}>PO Tracker</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>
            Proactive procurement view · {data.nopo.length} parts with no PO · {lateCount} POs running late · {vendors.length} vendors with exposure
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search" style={{ width: 240, height: 32 }}>
            <window.IconSearch size={14}/>
            <input 
              style={{ fontSize: 12 }} 
              placeholder="Search POs, parts, vendors..." 
              value={query} 
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}
              >
                <window.IconX size={14} />
              </button>
            )}
          </div>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
            <window.IconExport size={14} /> Export CSV
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12 }}>
            <window.IconSparkle size={14} /> Send Chase Wave
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 32, borderBottom: '1px solid var(--border-soft)', paddingBottom: 0 }}>
        {[
          { id: 'parts', label: 'Parts No PO', count: data.nopo.length },
          { id: 'vendors', label: 'Vendor Exposure', count: vendors.length },
          { id: 'pos', label: 'PO Tracker', count: (data.poActions?.critical?.length || 0) + (data.poActions?.warning?.length || 0) + (data.poActions?.onTrack?.length || 0) }
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: '12px 4px', fontSize: 13, fontWeight: view === v.id ? 600 : 500,
            color: view === v.id ? 'var(--sdc-blue)' : 'var(--fg-2)',
            border: 0, borderBottom: `2px solid ${view === v.id ? 'var(--sdc-blue)' : 'transparent'}`,
            background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s', marginBottom: -1
          }}>
            {v.label} <span style={{ 
              fontSize: 10, background: view === v.id ? 'var(--sdc-blue-soft)' : 'var(--bg-3)', 
              color: view === v.id ? 'var(--sdc-blue)' : 'var(--fg-3)', 
              padding: '1px 6px', borderRadius: 4, fontWeight: 600 
            }}>{v.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>Click any part number to draft a PO</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="panel" style={{ height: '100%', overflow: 'auto', background: 'var(--bg-1)', border: '1px solid var(--border-soft)' }}>
          {view === 'parts' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-2)' }}>
                <span className="eyebrow" style={{ fontSize: 10, color: 'var(--fg-3)', flex: 1 }}>List Controls</span>
                <button className="btn-secondary" onClick={() => setExpandAction({ type: 'collapse', version: expandAction.version + 1 })} style={{ padding: '4px 10px', fontSize: 12 }}>Collapse All</button>
                <button className="btn-primary" onClick={() => setExpandAction({ type: 'expand', version: expandAction.version + 1 })} style={{ padding: '4px 10px', fontSize: 12 }}>Expand All</button>
              </div>
              <PartsNestedView nopo={data.nopo} query={query} expandAction={expandAction}/>
            </>
          )}
          {view === 'vendors' && <VendorList vendors={vendors} query={query}/>}
          {view === 'pos' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-2)', display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setPoViewMode('list')} 
                  className={poViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 12px', fontSize: 11, borderRadius: 100 }}
                >
                  List View
                </button>
                <button 
                  onClick={() => setPoViewMode('schedule')} 
                  className={poViewMode === 'schedule' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 12px', fontSize: 11, borderRadius: 100 }}
                >
                  Schedule View
                </button>
              </div>
              {poViewMode === 'list' ? (
                <PoTracker poActions={data.poActions} query={query}/>
              ) : (
                <PoTimeline poActions={data.poActions} query={query} job={data.job}/>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PartsNestedView({ nopo, query, expandAction }) {
  const filtered = nopo.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return String(p.id).toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q) || (p.parent || '').toLowerCase().includes(q);
  });

  const groups = {};
  filtered.forEach(p => {
    const parent = (p.parentPN ? `${p.parentPN}|` : '|') + (p.parentDesc || p.parentPN || 'Loose Parts');
    if (!groups[parent]) groups[parent] = [];
    groups[parent].push(p);
  });

  const sortedParents = Object.keys(groups).sort();

  return (
    <div>
      {sortedParents.map(parent => (
        <AssemblyPartGroup key={parent} parent={parent} parts={groups[parent]} expandAction={expandAction} />
      ))}
    </div>
  );
}

function AssemblyPartGroup({ parent, parts, expandAction }) {
  const [expanded, setExpanded] = useState(true);
  const { IconChevronRight } = window;

  useEffect(() => {
    if (expandAction.type === 'expand') setExpanded(true);
    if (expandAction.type === 'collapse') setExpanded(false);
  }, [expandAction]);

  const [pn, desc] = parent.split('|');

  return (
    <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
      <div 
        className="row-hover" 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '12px 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          background: expanded ? 'var(--bg-2)' : 'transparent'
        }}
      >
        <IconChevronRight size={12} className={`chev ${expanded ? 'open' : ''}`} style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pn && <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>{pn}</span>}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-2)' }}>{desc}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{parts.length} parts missing PO</span>
        <div style={{ flex: 1 }} />
        <span style={{ 
          fontSize: 10, fontWeight: 700, color: 'var(--threat)', background: 'var(--threat-soft)', 
          padding: '2px 8px', borderRadius: 4, letterSpacing: '0.02em' 
        }}>{parts.length} OPEN</span>
      </div>

      {expanded && (
        <div style={{ background: 'var(--bg-1)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '180px 1fr 60px 240px',
            padding: '10px 20px 10px 52px', borderBottom: '1px solid var(--border-soft)',
            background: 'var(--bg-2)'
          }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>Part Number</div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Description</div>
            <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Qty</div>
            <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Status</div>
          </div>
          {parts.map((p, i) => {
            const hash = String(p.id || '').split('').reduce((a,c) => a + c.charCodeAt(0), 0);
            const urgency = hash % 3 === 0 ? 'overdue' : hash % 3 === 1 ? 'soon' : 'long';
            const date = new Date(2026, 4, 1 + (hash % 20)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const u = {
              overdue: { cls: 'threat', label: 'OVERDUE', sub: `On (Mar 28)` },
              soon:    { cls: 'pending', label: 'EOR SOON', sub: `+${(hash%5)+1}d (${date})` },
              long:    { cls: 'blue', label: 'LONG-LEAD', sub: `+${(hash%30)+20}d (Jun 16)` },
            }[urgency];

            return (
              <div key={i} className="row-hover" style={{
                display: 'grid', gridTemplateColumns: '180px 1fr 60px 240px',
                padding: '12px 20px 12px 52px', gap: 14, alignItems: 'center',
                borderBottom: i === parts.length - 1 ? 'none' : '1px solid var(--border-soft)'
              }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--sdc-blue)', cursor: 'pointer' }}>{p.id}</span>
                <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-2)', textAlign: 'right' }}>{p.qty}</span>
                <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                  <span className={`badge badge-${u.cls}`} style={{ fontSize: 9.5 }}>{u.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', minWidth: 80 }}>{u.sub}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VendorList({ vendors, query }) {
  const filtered = vendors.filter(v => !query || v.vendor.toLowerCase().includes(query.toLowerCase()));
  const max = Math.max(...filtered.map(v => v.value), 1);
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 60px 60px 1.5fr 60px 100px',
        padding: '12px 20px', gap: 14, background: 'var(--bg-2)',
        borderBottom: '1px solid var(--border-soft)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div className="eyebrow" style={{ fontSize: 10 }}>Vendor</div>
        <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Lines</div>
        <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Qty</div>
        <div className="eyebrow" style={{ fontSize: 10 }}>Exposure</div>
        <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>%</div>
        <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Status</div>
      </div>
      {filtered.map((v, i) => {
        const totalQty = v.parts.reduce((acc, p) => acc + (p.qty || 1), 0);
        const pct = Math.round((v.value / max) * 100);
        const partString = v.parts.map(p => p.id).join(' / ');

        return (
          <div key={i} className="row-hover" style={{
            display: 'grid', gridTemplateColumns: '1fr 60px 60px 1.5fr 60px 100px',
            padding: '14px 20px', gap: 14, alignItems: 'center',
            borderBottom: '1px solid var(--border-soft)', cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <window.VendorAvatar vendor={v.vendor} size={30}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.vendor}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partString}</div>
              </div>
            </div>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)', textAlign: 'right' }}>{v.lines}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--sdc-blue)', fontWeight: 600, textAlign: 'right' }}>{totalQty}</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, background: v.overdue ? 'var(--threat)' : 'var(--sdc-blue)', height: '100%' }}/>
              </div>
            </div>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)', textAlign: 'right' }}>{pct}%</span>
            <div style={{ textAlign: 'right' }}>
              {v.overdue ? <window.StatusBadge status="OVERDUE"/> : <window.StatusBadge status="OPEN"/>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PoTracker({ poActions, query }) {
  const [groupBy, setGroupBy] = useState('urgency'); // 'urgency', 'vendor', 'date', 'po'
  const [expandedPos, setExpandedPos] = useState(new Set());

  const allPos = useMemo(() => {
    const list = [
      ...(poActions?.critical || []),
      ...(poActions?.warning || []),
      ...(poActions?.onTrack || [])
    ];
    return list.filter(entry => {
      if (!query) return true;
      const q = query.toLowerCase();
      return entry.supplier.toLowerCase().includes(q) || 
             String(entry.po.poId).toLowerCase().includes(q) ||
             entry.po.parts.some(p => p.partNumber.toLowerCase().includes(q) || p.partDesc.toLowerCase().includes(q));
    });
  }, [poActions, query]);

  const groups = useMemo(() => {
    const g = {};
    if (groupBy === 'urgency') {
      g['OVERDUE / CRITICAL'] = allPos.filter(p => p.worstDays < 0);
      g['DUE WITHIN 14 DAYS'] = allPos.filter(p => p.worstDays >= 0 && p.worstDays <= 14);
      g['HEALTHY SUPPLY'] = allPos.filter(p => p.worstDays > 14);
    } else if (groupBy === 'vendor') {
      allPos.forEach(p => {
        if (!g[p.supplier]) g[p.supplier] = [];
        g[p.supplier].push(p);
      });
    } else if (groupBy === 'date') {
      allPos.forEach(p => {
        const date = p.po.dueDate ? new Date(p.po.dueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'No Date';
        if (!g[date]) g[date] = [];
        g[date].push(p);
      });
    } else if (groupBy === 'po') {
       allPos.forEach(p => {
        const prefix = String(p.po.poId).substring(0, 3) + 'XXX';
        if (!g[prefix]) g[prefix] = [];
        g[prefix].push(p);
      });
    }
    return Object.entries(g)
      .filter(([_, data]) => data.length > 0)
      .map(([label, data]) => ({ label, data }));
  }, [allPos, groupBy]);

  const toggleExpand = (id) => {
    const next = new Set(expandedPos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPos(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* View Controls */}
      <div style={{ 
        padding: '12px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase' }}>Group By:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'urgency', label: 'Urgency' },
            { id: 'vendor', label: 'Vendor' },
            { id: 'date', label: 'Expected Date' },
            { id: 'po', label: 'PO Series' },
          ].map(opt => (
            <button 
              key={opt.id} 
              onClick={() => setGroupBy(opt.id)}
              className={groupBy === opt.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '4px 12px', fontSize: 11, borderRadius: 100 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {groups.map((group, gi) => (
        <div key={gi}>
          <div style={{ 
            padding: '14px 20px', background: 'var(--bg-sunken)', 
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-2)', letterSpacing: '0.04em' }}>{group.label}</span>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 10 }}>{group.data.length}</span>
          </div>

          {group.data.map((entry, ei) => {
            const isExpanded = expandedPos.has(entry.po.poId);
            const totalLines = entry.po.parts.length;
            const rcvdLines = entry.po.parts.filter(p => p.received >= p.qty).length;
            const pct = Math.round((rcvdLines / totalLines) * 100);
            
            return (
              <div key={ei} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <div 
                  className="row-hover"
                  onClick={() => toggleExpand(entry.po.poId)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 100px 1.2fr 100px 100px 100px',
                    padding: '14px 20px', gap: 14, alignItems: 'center', cursor: 'pointer',
                    background: isExpanded ? 'var(--bg-2)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <window.IconCaretRight size={10} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--fg-3)' }}/>
                    <window.VendorAvatar vendor={entry.supplier} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{entry.supplier}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--sdc-blue)', fontWeight: 600 }}>{entry.po.poId}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 60, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ready)' : 'var(--sdc-blue)', height: '100%' }}/>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--fg-1)', fontWeight: 600, minWidth: 35 }}>{pct}%</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>({rcvdLines}/{totalLines} lines)</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    {entry.po.poDate ? new Date(entry.po.poDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: entry.worstDays < 0 ? 'var(--threat)' : 'var(--fg-1)', fontWeight: 600 }}>
                    {entry.po.dueDate ? new Date(entry.po.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'N/A'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <window.StatusBadge status={entry.worstDays < 0 ? 'PAST DUE' : entry.worstDays < 14 ? 'LATE/EXP' : 'OPEN'}/>
                  </div>
                </div>

                {isExpanded && (
                  <div className="fade-in" style={{ background: 'var(--bg-1)', padding: '0 0 12px 0' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '60px 120px 1fr 60px 60px 100px 100px',
                      padding: '10px 20px 8px 52px', borderBottom: '1px solid var(--border-soft)',
                      background: 'var(--bg-2)', gap: 14
                    }}>
                      <div className="eyebrow" style={{ fontSize: 9 }}>Status</div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>Part #</div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>Description</div>
                      <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right' }}>Req</div>
                      <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right' }}>Rcvd</div>
                      <div className="eyebrow" style={{ fontSize: 9 }}>Due Date</div>
                      <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right' }}>Slip</div>
                    </div>
                    {entry.po.parts.map((p, pi) => {
                      const isRcvd = p.received >= p.qty;
                      return (
                        <div key={pi} style={{
                          display: 'grid', gridTemplateColumns: '60px 120px 1fr 60px 60px 100px 100px',
                          padding: '10px 20px 10px 52px', gap: 14, alignItems: 'center',
                          borderBottom: pi === entry.po.parts.length - 1 ? 'none' : '1px solid var(--border-soft)'
                        }}>
                          <div>
                            {isRcvd ? 
                              <span style={{ color: 'var(--ready)', display: 'flex' }}><window.IconCheck size={12}/></span> : 
                              <span style={{ color: p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--pending)', display: 'flex' }}><window.IconClock size={12}/></span>
                            }
                          </div>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{p.partNumber}</span>
                          <span style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.partDesc}</span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)', textAlign: 'right' }}>{p.qty}</span>
                          <span className="mono" style={{ fontSize: 12, color: isRcvd ? 'var(--ready-ink)' : 'var(--fg-3)', textAlign: 'right' }}>{p.received}</span>
                          <span className="mono" style={{ fontSize: 11, color: p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--fg-2)' }}>
                            {p.dueDate ? new Date(p.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}
                          </span>
                          <span className="mono" style={{ textAlign: 'right', fontSize: 11, color: p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--fg-3)' }}>
                            {p.daysUntilDue < 0 ? `${p.daysUntilDue}d` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PoTimeline({ poActions, query, job }) {
  const [expandedPo, setExpandedPo] = useState(null);
  
  const allPos = useMemo(() => {
    const list = [
      ...(poActions?.critical || []),
      ...(poActions?.warning || []),
      ...(poActions?.onTrack || [])
    ];
    return list.filter(entry => {
      if (!query) return true;
      const q = query.toLowerCase();
      return entry.supplier.toLowerCase().includes(q) || 
             String(entry.po.poId).toLowerCase().includes(q) ||
             entry.po.parts.some(p => p.partNumber.toLowerCase().includes(q) || p.partDesc.toLowerCase().includes(q));
    });
  }, [poActions, query]);

  // Timeline Scale Logic
  const today = new Date();
  const buildStart = new Date(job.buildStart);
  const ship = new Date(job.shipDate);
  
  // Set window: 4 months before Build Start to 1 month after Ship
  const tMin = new Date(buildStart);
  tMin.setMonth(tMin.getMonth() - 4);
  const tMax = new Date(ship);
  tMax.setMonth(tMax.getMonth() + 1);
  
  const totalMs = tMax - tMin;
  const toPct = (d) => Math.max(0, Math.min(100, ((new Date(d) - tMin) / totalMs) * 100));

  // Generate Week Headers
  const weeks = useMemo(() => {
    const arr = [];
    let curr = new Date(tMin);
    // Align to Sunday
    curr.setDate(curr.getDate() - curr.getDay());
    while (curr < tMax) {
      arr.push(new Date(curr));
      curr.setDate(curr.getDate() + 7);
    }
    return arr;
  }, [tMin, tMax]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Timeline Header */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: '240px 1fr', 
        borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-1)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ padding: '12px 20px', borderRight: '1px solid var(--border-soft)', fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase' }}>Vendor / PO #</div>
        <div style={{ position: 'relative', height: 40, overflow: 'hidden' }}>
          {weeks.map((w, i) => (
            <div key={i} style={{ 
              position: 'absolute', left: `${toPct(w)}%`, top: 0, bottom: 0, 
              width: `${(7 * 24 * 60 * 60 * 1000 / totalMs) * 100}%`,
              borderLeft: '1px solid var(--border-subtle)', padding: '4px 8px',
              fontSize: 9, color: 'var(--fg-3)', whiteSpace: 'nowrap'
            }}>
              {w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          ))}
          {/* Milestones */}
          <div style={{ position: 'absolute', left: `${toPct(today)}%`, top: 0, bottom: 0, width: 2, background: 'var(--sdc-blue)', opacity: 0.4, zIndex: 5 }} />
          <div style={{ position: 'absolute', left: `${toPct(buildStart)}%`, top: 0, bottom: 0, width: 2, background: 'var(--threat)', opacity: 0.4, zIndex: 5 }} />
        </div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-raised)' }}>
        {allPos.map((entry, i) => {
          const start = entry.po.poDate ? new Date(entry.po.poDate) : new Date(new Date(entry.po.dueDate).getTime() - 21 * 24 * 60 * 60 * 1000);
          const end = new Date(entry.po.dueDate);
          const left = toPct(start);
          const width = toPct(end) - left;
          
          const totalLines = entry.po.parts.length;
          const rcvdLines = entry.po.parts.filter(p => p.received >= p.qty).length;
          const pct = Math.round((rcvdLines / totalLines) * 100);
          const isLate = entry.worstDays < 0;

          return (
            <div key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <div 
                className="row-hover"
                onClick={() => setExpandedPo(expandedPo === entry.po.poId ? null : entry.po.poId)}
                style={{
                  display: 'grid', gridTemplateColumns: '240px 1fr', 
                  alignItems: 'center', cursor: 'pointer', minHeight: 44,
                  background: expandedPo === entry.po.poId ? 'var(--bg-2)' : 'transparent'
                }}
              >
                <div style={{ 
                  padding: '8px 20px', borderRight: '1px solid var(--border-soft)',
                  display: 'flex', flexDirection: 'column', gap: 2
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <window.VendorAvatar vendor={entry.supplier} size={18} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.supplier}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--sdc-blue)', fontWeight: 700 }}>{entry.po.poId}</span>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{pct}% Ready</span>
                  </div>
                </div>
                
                <div style={{ position: 'relative', height: '100%', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                   {/* Vertical Grid Lines */}
                   {weeks.map((w, wi) => (
                     <div key={wi} style={{ position: 'absolute', left: `${toPct(w)}%`, top: 0, bottom: 0, width: 1, background: 'var(--border-subtle)', opacity: 0.3 }} />
                   ))}

                   {/* Today/Build Start Markers */}
                   <div style={{ position: 'absolute', left: `${toPct(today)}%`, top: 0, bottom: 0, width: 1, background: 'var(--sdc-blue)', opacity: 0.1 }} />
                   <div style={{ position: 'absolute', left: `${toPct(buildStart)}%`, top: 0, bottom: 0, width: 1, background: 'var(--threat)', opacity: 0.1 }} />

                   {/* PO Bar */}
                   <div style={{ 
                     position: 'absolute', left: `${left}%`, width: `${Math.max(width, 2)}%`,
                     height: 14, borderRadius: 7,
                     background: isLate ? 'var(--threat)' : pct === 100 ? 'var(--ready)' : 'var(--sdc-blue)',
                     boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                     display: 'flex', alignItems: 'center', padding: '0 4px',
                     transition: 'all 0.2s'
                   }}>
                     <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.2)', borderRadius: 7 }} />
                   </div>
                   
                   {/* Label */}
                   <span className="mono" style={{ 
                     position: 'absolute', left: `${left + width + 1}%`, 
                     fontSize: 9, fontWeight: 700, color: isLate ? 'var(--threat-ink)' : 'var(--fg-3)',
                     whiteSpace: 'nowrap'
                   }}>
                     {entry.po.dueDate ? new Date(entry.po.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : ''}
                     {isLate && ` (${Math.abs(entry.worstDays)}d LATE)`}
                   </span>
                </div>
              </div>

              {expandedPo === entry.po.poId && (
                <div style={{ background: 'var(--bg-1)', padding: '12px 20px 12px 260px' }} className="fade-in">
                  <div style={{ display: 'grid', gridTemplateColumns: '30px 120px 1fr 60px 80px 60px', gap: 12, marginBottom: 8 }}>
                    <div className="eyebrow" style={{ fontSize: 9 }}></div>
                    <div className="eyebrow" style={{ fontSize: 9 }}>Part #</div>
                    <div className="eyebrow" style={{ fontSize: 9 }}>Description</div>
                    <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right' }}>Qty</div>
                    <div className="eyebrow" style={{ fontSize: 9 }}>Due Date</div>
                    <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right' }}>Slip</div>
                  </div>
                  {entry.po.parts.map((p, pi) => {
                    const isRcvd = p.received >= p.qty;
                    return (
                      <div key={pi} style={{ display: 'grid', gridTemplateColumns: '30px 120px 1fr 60px 80px 60px', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                        <div>{isRcvd ? <window.IconCheck size={12} style={{ color: 'var(--ready)' }}/> : <window.IconClock size={12} style={{ color: p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--pending)' }}/>}</div>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)', fontWeight: 600 }}>{p.partNumber}</span>
                        <span style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.partDesc}</span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)', textAlign: 'right' }}>{p.qty}</span>
                        <span className="mono" style={{ fontSize: 10, color: p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--fg-3)' }}>{p.dueDate ? new Date(p.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}</span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--threat)', textAlign: 'right' }}>{p.daysUntilDue < 0 ? `${p.daysUntilDue}d` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.PoTab = PoTab;
