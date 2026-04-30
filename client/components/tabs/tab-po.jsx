// PO Action List — Parts view + Vendor lens
const { useState, useMemo, useEffect } = React;

function PoTab({ data }) {
  const [view, setView] = useState('parts');
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
          {view === 'pos' && <PoTracker poActions={data.poActions} query={query}/>}
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
  const groups = [
    { id: 'critical', label: 'OVERDUE / CRITICAL', data: poActions?.critical || [], color: 'var(--threat)' },
    { id: 'warning', label: 'DUE WITHIN 14 DAYS', data: poActions?.warning || [], color: 'var(--pending)' },
    { id: 'ontrack', label: 'HEALTHY SUPPLY', data: poActions?.onTrack || [], color: 'var(--sdc-blue)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {groups.map(g => {
        const filtered = g.data.filter(entry => {
          if (!query) return true;
          const q = query.toLowerCase();
          return entry.supplier.toLowerCase().includes(q) || String(entry.po.poId).toLowerCase().includes(q);
        });
        if (filtered.length === 0) return null;

        return (
          <div key={g.id} style={{ marginBottom: 20 }}>
            {/* Group Header */}
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.color }}/>
              <span style={{ color: g.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>{g.label} {filtered.length} POs</span>
            </div>

            {/* Table Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1.2fr 80px 1.2fr 100px 100px 100px',
              padding: '10px 20px', gap: 14, background: 'var(--bg-2)', borderBottom: '1px solid var(--border-soft)'
            }}>
              <div className="eyebrow" style={{ fontSize: 9 }}>Supplier</div>
              <div className="eyebrow" style={{ fontSize: 9 }}>PO #</div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Parts / Qty</div>
              <div className="eyebrow" style={{ fontSize: 9 }}>PO Date</div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Expected Date</div>
              <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right' }}>Status</div>
            </div>

            {/* Rows */}
            {filtered.map((entry, i) => {
              const qty = entry.po.parts.reduce((a,p) => a + (p.qty || 1), 0);
              const poDate = entry.po.dueDate ? new Date(new Date(entry.po.dueDate).getTime() - 21 * 24 * 60 * 60 * 1000) : null;
              
              return (
                <div key={i} className="row-hover" style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 80px 1.2fr 100px 100px 100px',
                  padding: '12px 20px', gap: 14, alignItems: 'center',
                  borderBottom: '1px solid var(--border-soft)', cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <window.VendorAvatar vendor={entry.supplier} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{entry.supplier}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--sdc-blue)', fontWeight: 600 }}>{entry.po.poId}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
                    {entry.po.parts.length} part{entry.po.parts.length>1?'s':''} <span style={{ color: 'var(--fg-3)' }}>({qty} qty)</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    {poDate ? poDate.toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: entry.worstDays < 0 ? 'var(--threat)' : 'var(--fg-1)', fontWeight: 600 }}>
                    {entry.po.dueDate ? new Date(entry.po.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'N/A'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <window.StatusBadge status={entry.worstDays < 0 ? 'PAST DUE' : entry.worstDays < 14 ? 'LATE/EXP' : 'OPEN'}/>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

window.PoTab = PoTab;
