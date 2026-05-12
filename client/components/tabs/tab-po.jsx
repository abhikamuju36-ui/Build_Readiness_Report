// PO Action List — Parts view + Vendor lens
const { useState, useMemo, useEffect } = React;

function PoTab({ data, highlightPoIds = [], onClearHighlight }) {
  const [view, setView] = useState('pos');
  const [query, setQuery] = useState('');
  const [expandAction, setExpandAction] = useState({ type: null, version: 0 });

  useEffect(() => {
    if (highlightPoIds.length > 0) setView('pos');
  }, [highlightPoIds]);

  const lateCount = (data.poActions?.critical?.length || 0);
  const totalPos = (data.poActions?.critical?.length || 0) + (data.poActions?.warning?.length || 0) + (data.poActions?.onTrack?.length || 0) + (data.poActions?.delivered?.length || 0);

  const overduePartCount = useMemo(() => {
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    let n = 0;
    [...(data.poActions?.critical || []), ...(data.poActions?.warning || [])].forEach(entry => {
      entry.po.parts.forEach(p => {
        if (p.received >= p.qty) return;
        if (p.dueDate && new Date(p.dueDate) <= todayEnd) n++;
      });
    });
    return n;
  }, [data.poActions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'hidden' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: '-0.02em' }}>PO Tracker</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>
            Proactive procurement view · {data.nopo.length} parts with no PO · {lateCount} POs running late
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
          { id: 'pos',     label: 'PO Tracker',   count: totalPos },
          { id: 'overdue', label: 'Due Today',     count: overduePartCount, alert: overduePartCount > 0 },
          { id: 'parts',   label: 'All Parts',     count: data.readiness.reduce((s, spec) => s + (spec.lines || 0), 0) },
          { id: 'emails',  label: 'Draft Emails',  count: data.emails?.length || 0 },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: '12px 4px', fontSize: 13, fontWeight: view === v.id ? 600 : 500,
            color: view === v.id ? 'var(--sdc-blue)' : 'var(--fg-2)',
            border: 0, borderBottom: `2px solid ${view === v.id ? 'var(--sdc-blue)' : 'transparent'}`,
            background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s', marginBottom: -1
          }}>
            {v.label} <span style={{
              fontSize: 10,
              background: view === v.id ? (v.alert ? 'rgba(220,38,38,0.12)' : 'var(--sdc-blue-soft)') : (v.alert ? 'rgba(220,38,38,0.08)' : 'var(--bg-3)'),
              color: view === v.id ? (v.alert ? '#dc2626' : 'var(--sdc-blue)') : (v.alert ? '#dc2626' : 'var(--fg-3)'),
              padding: '1px 6px', borderRadius: 4, fontWeight: 600
            }}>{v.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>Click any part number to copy</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="panel" style={{ height: '100%', overflow: 'auto', background: 'var(--bg-1)', border: '1px solid var(--border-soft)' }}>
          {view === 'parts'   && <PartsFlatView parts={data.readiness.flatMap(s => s.assemblies.flatMap(a => (a.node?.parts || []).map(p => ({ ...p, spec: s.spec, assemblyDesc: a.desc || a.code }))))} query={query} job={data.job}/>}
          {view === 'pos'     && <PoTracker poActions={data.poActions} query={query} highlightPoIds={highlightPoIds} onClearHighlight={onClearHighlight}/>}
          {view === 'overdue' && <OverduePartsView poActions={data.poActions}/>}
          {view === 'emails'  && <EmailsPanel emails={data.emails || []} job={data.job}/>}
        </div>
      </div>
    </div>
  );
}

function PartsFlatView({ parts, query, job }) {
  const [copiedPn, setCopiedPn] = React.useState(null);

  const copyPn = (pn) => {
    navigator.clipboard?.writeText(pn).catch(() => {});
    setCopiedPn(pn);
    setTimeout(() => setCopiedPn(null), 1500);
  };

  const filtered = parts.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    const poNum = p.pos?.[0]?.poId || '';
    return String(p.pn || p.id).toLowerCase().includes(q) || 
           (p.desc || '').toLowerCase().includes(q) || 
           String(poNum).toLowerCase().includes(q) ||
           (p.parentPN || '').toLowerCase().includes(q) ||
           (p.parentDesc || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 160px 45px 50px 140px 80px 80px',
        padding: '6px 10px',
        gap: 8,
        background: 'var(--ink)',
        color: '#fff',
        borderBottom: '1px solid var(--border-soft)',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>Part Number</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>Description</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>Assembly / Source</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>Qty</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>Unit $</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>Manufacturer</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>PO #</div>
        <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>Status</div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map((p, i) => {
          const today = new Date();
          // Use part-specific date, or fallback to job build start
          const reqDateStr = p.requiredDate || (job && job.buildStart);
          const req = reqDateStr ? new Date(reqDateStr) : null;
          const diff = req ? Math.ceil((req - today) / 86400000) : null;
          
          let urgency = 'long';
          if (diff !== null) {
            if (diff < 0) urgency = 'overdue';
            else if (diff <= 14) urgency = 'soon';
          }

          const u = {
            overdue: { cls: 'threat', label: 'OVERDUE', sub: diff !== null ? `${Math.abs(diff)}d Late` : 'Past Due' },
            soon:    { cls: 'pending', label: 'DUE SOON', sub: `In ${diff}d` },
            long:    { cls: 'blue', label: 'FUTURE', sub: diff !== null ? (p.requiredDate ? `In ${diff}d` : `Est In ${diff}d`) : 'TBD' },
          }[urgency];

          const unitPrice = p.unitPrice || 0;
          return (
            <div key={i} className="row-hover" style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 160px 45px 50px 140px 80px 80px',
              padding: '2px 10px', gap: 8, alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
              background: urgency === 'overdue' && p.status !== 'received' ? 'var(--threat-soft)' : 'transparent'
            }}>
              <span
                className="mono"
                title="Click to copy"
                onClick={() => copyPn(p.pn || p.id)}
                style={{ fontSize: 10, fontWeight: 800, color: copiedPn === (p.pn || p.id) ? 'var(--ready-ink)' : 'var(--sdc-blue)', cursor: 'pointer', transition: 'color 0.2s' }}
              >{copiedPn === (p.pn || p.id) ? '✓ Copied' : (p.pn || p.id)}</span>
              <span style={{ fontSize: 10, color: 'var(--fg-1)', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="mono" style={{ fontSize: 8, fontWeight: 700, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>{p.parentPN || 'LOOSE'}</span>
                <span style={{ fontSize: 9, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>{p.parentDesc || p.assemblyDesc || 'Loose Parts'}</span>
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-1)', textAlign: 'right' }}>{p.qty}</span>
              <span className="mono tnum" style={{ fontSize: 10, textAlign: 'right', color: unitPrice > 0 ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                {unitPrice > 0 ? `$${unitPrice >= 1000 ? (unitPrice / 1000).toFixed(1) + 'K' : unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                 <window.VendorAvatar vendor={p.manufacturer || 'SDC'} size={14} />
                 <span style={{ fontSize: 10, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.manufacturer === 'SDC' ? 'In-house (SDC)' : (p.manufacturer || 'SDC')}
                 </span>
              </div>
              <span className="mono" style={{ fontSize: 10, color: p.pos?.length ? 'var(--sdc-blue)' : 'var(--fg-4)', fontWeight: p.pos?.length ? 600 : 400 }}>
                {p.pos?.[0]?.poId || 'NO PO'}
              </span>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span className={`badge badge-${p.status === 'received' ? 'ready' : u.cls}`} style={{ fontSize: 7, padding: '1px 3px', lineHeight: 1 }}>{p.status === 'received' ? 'RECEIVED' : u.label}</span>
                <span style={{ fontSize: 8, color: 'var(--fg-3)', fontWeight: 600, lineHeight: 1 }}>
                   {p.status === 'received' ? (p.receivedDate ? new Date(p.receivedDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Delivered') : u.sub}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PoTracker({ poActions, query, highlightPoIds = [], onClearHighlight }) {
  const [expandedVendors, setExpandedVendors] = useState(new Set());
  const [expandedPos, setExpandedPos] = useState(() => new Set(highlightPoIds));

  const allPos = useMemo(() => {
    const list = [
      ...(poActions?.critical || []),
      ...(poActions?.warning || []),
      ...(poActions?.onTrack || []),
      ...(poActions?.delivered || [])
    ];
    return list.filter(entry => {
      if (!query) return true;
      const q = query.toLowerCase();
      return entry.supplier.toLowerCase().includes(q) || 
             String(entry.po.poId).toLowerCase().includes(q) ||
             entry.po.parts.some(p => String(p.partNumber).toLowerCase().includes(q) || String(p.partDesc).toLowerCase().includes(q));
    });
  }, [poActions, query]);

  const vendorGroups = useMemo(() => {
    const vMap = {};
    allPos.forEach(entry => {
      if (!vMap[entry.supplier]) {
        vMap[entry.supplier] = {
          supplier: entry.supplier,
          email: entry.email,
          worstDays: entry.worstDays,
          pos: []
        };
      }
      vMap[entry.supplier].pos.push({ ...entry.po, worstDays: entry.worstDays });
      if (entry.worstDays < vMap[entry.supplier].worstDays) {
        vMap[entry.supplier].worstDays = entry.worstDays;
      }
    });
    const priority = (v) => {
      const total = v.pos.reduce((s, po) => s + po.parts.length, 0);
      const rcvd  = v.pos.reduce((s, po) => s + po.parts.filter(p => p.received >= p.qty).length, 0);
      if (rcvd === total) return 3;   // RECEIVED
      if (v.worstDays < 0) return 0;  // PAST DUE
      if (v.worstDays <= 14) return 1; // LATE/EXP
      return 2;                        // OPEN
    };
    return Object.values(vMap).sort((a, b) => {
      const pa = priority(a), pb = priority(b);
      if (pa !== pb) return pa - pb;
      if (pa === 3) return a.supplier.localeCompare(b.supplier); // received: A-Z
      return a.worstDays - b.worstDays; // others: most overdue first
    });
  }, [allPos]);

  useEffect(() => {
    if (highlightPoIds.length === 0) return;
    setExpandedPos(new Set(highlightPoIds));
    const vSet = new Set(expandedVendors);
    vendorGroups.forEach(v => {
      if (v.pos.some(po => highlightPoIds.includes(po.poId))) {
        vSet.add(v.supplier);
      }
    });
    setExpandedVendors(vSet);
  }, [highlightPoIds, vendorGroups]);

  const toggleVendor = (v) => {
    const next = new Set(expandedVendors);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setExpandedVendors(next);
  };

  const togglePo = (p) => {
    const next = new Set(expandedPos);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setExpandedPos(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {highlightPoIds.length > 0 && (
        <div style={{ padding: '8px 20px', background: 'var(--sdc-blue-soft)', borderBottom: '1px solid var(--sdc-blue-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--sdc-blue-ink)' }}>
            Showing {highlightPoIds.length} PO{highlightPoIds.length !== 1 ? 's' : ''} from Schedule Health timeline
          </span>
          <button onClick={() => { onClearHighlight && onClearHighlight(); setExpandedPos(new Set()); setExpandedVendors(new Set()); }} style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--sdc-blue-ink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Clear filter ×
          </button>
        </div>
      )}

      {vendorGroups.map((v, vi) => {
         const isExpanded = expandedVendors.has(v.supplier);
         const totalPOs = v.pos.length;
         const totalLines = v.pos.reduce((sum, po) => sum + po.parts.length, 0);
         const rcvdLines = v.pos.reduce((sum, po) => sum + po.parts.filter(p => p.received >= p.qty).length, 0);
         const pct = totalLines > 0 ? Math.round((rcvdLines / totalLines) * 100) : 0;

         return (
           <div key={vi} style={{ borderBottom: '1px solid var(--border-soft)' }}>
             <div 
               className="row-hover"
               onClick={() => toggleVendor(v.supplier)}
               style={{
                 display: 'grid', gridTemplateColumns: '1.5fr 150px 150px 100px',
                 padding: '12px 16px', gap: 16, alignItems: 'center', cursor: 'pointer',
                 background: isExpanded ? 'var(--bg-3)' : (pct === 100 ? 'rgba(34, 197, 94, 0.04)' : 'transparent'),
                 borderLeft: `4px solid ${isExpanded ? 'var(--sdc-blue)' : (pct === 100 ? 'var(--ready)' : 'transparent')}`,
                 boxShadow: isExpanded ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                 zIndex: isExpanded ? 2 : 1,
                 position: 'relative'
               }}
             >
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <window.IconCaretRight size={12} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--fg-3)' }}/>
                 <window.VendorAvatar vendor={v.supplier} size={20} />
                 <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>{v.supplier}</span>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                 <div style={{ width: 60, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                   <div style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ready)' : 'var(--sdc-blue)', height: '100%' }}/>
                 </div>
                 <span style={{ fontSize: 11, color: 'var(--fg-1)', fontWeight: 600, minWidth: 35 }}>{pct}%</span>
               </div>
               
               <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                 {totalPOs} PO{totalPOs !== 1 ? 's' : ''} ({totalLines} parts)
               </div>
               
               <div style={{ textAlign: 'right' }}>
                 <window.StatusBadge status={rcvdLines === totalLines ? 'RECEIVED' : (v.worstDays < 0 ? 'PAST DUE' : v.worstDays <= 14 ? 'LATE/EXP' : 'OPEN')}/>
               </div>
             </div>

             {isExpanded && (
               <div style={{ background: 'var(--bg-1)' }}>
                 {v.pos.map((po, pi) => {
                   const isPoExpanded = expandedPos.has(po.poId);
                   const poLines = po.parts.length;
                   const poRcvd = po.parts.filter(p => p.received >= p.qty).length;
                   const poPct = poLines > 0 ? Math.round((poRcvd / poLines) * 100) : 0;

                   return (
                     <div key={pi} style={{ borderBottom: pi === v.pos.length - 1 ? 'none' : '1px solid var(--border-soft)' }}>
                        <div 
                          className="row-hover"
                          onClick={() => togglePo(po.poId)}
                          style={{
                            display: 'grid', gridTemplateColumns: '1.2fr 100px 100px 100px 100px',
                            padding: '10px 14px 10px 36px', gap: 12, alignItems: 'center', cursor: 'pointer',
                            background: isPoExpanded ? 'var(--bg-raised)' : 'transparent',
                            borderBottom: isPoExpanded ? 'none' : '1px solid var(--border-soft)',
                            borderLeft: isPoExpanded ? '3px solid var(--sdc-blue)' : 'none'
                          }}
                        >
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                           <window.IconCaretRight size={10} style={{ transform: isPoExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--fg-3)' }}/>
                           <span className="mono" style={{ fontSize: 11, color: 'var(--sdc-blue)', fontWeight: 600 }}>{po.poId}</span>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                           <span style={{ fontSize: 11, color: 'var(--fg-1)', fontWeight: 600, minWidth: 35 }}>{poPct}%</span>
                           <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>({poRcvd}/{poLines})</span>
                         </div>
                         <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                           {po.poDate ? new Date(po.poDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}
                         </div>
                         <div className="mono" style={{ fontSize: 10, color: po.worstDays < 0 ? 'var(--threat)' : 'var(--fg-1)', fontWeight: 600 }}>
                           {po.dueDate ? new Date(po.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'N/A'}
                         </div>
                         <div style={{ textAlign: 'right' }}>
                           <window.StatusBadge status={poRcvd === poLines ? 'RECEIVED' : (po.worstDays < 0 ? 'PAST DUE' : po.worstDays <= 14 ? 'LATE/EXP' : 'OPEN')}/>
                         </div>
                       </div>
                       
                       {isPoExpanded && (
                         <div className="fade-in" style={{ background: 'var(--bg-sunken)', padding: '0 0 10px 0', position: 'relative', borderLeft: '3px solid var(--sdc-blue)', marginLeft: 0 }}>
                            <div style={{ position: 'absolute', left: 45, top: 0, bottom: 0, width: 2, background: 'var(--border-strong)', opacity: 0.3 }} />
                            <div style={{
                              display: 'grid', gridTemplateColumns: '40px 120px 1fr 50px 50px 80px 85px 85px 85px',
                              padding: '10px 14px 8px 54px', borderBottom: '1px solid #334155',
                              background: '#334155', gap: 12, position: 'relative', zIndex: 10,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>STATUS</div>
                              <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>PART #</div>
                              <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>DESCRIPTION</div>
                              <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>QTY</div>
                              <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>RCVD</div>
                              <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>COST</div>
                              <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>REQ DATE</div>
                              <div className="eyebrow" style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>EXP DATE</div>
                              <div className="eyebrow" style={{ fontSize: 9, textAlign: 'right', color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.05em' }}>SLIP</div>
                            </div>
                            {po.parts.map((p, pidx) => {
                             const isRcvd = p.received >= p.qty;
                             return (
                               <div key={pidx} style={{
                                 display: 'grid', gridTemplateColumns: '40px 120px 1fr 50px 50px 80px 85px 85px 85px',
                                 padding: '6px 14px 6px 54px', gap: 12, alignItems: 'center',
                                 borderBottom: pidx === po.parts.length - 1 ? 'none' : '1px solid var(--border-soft)'
                               }}>
                                 <div>
                                   {isRcvd ?
                                     <span style={{ color: 'var(--ready)', display: 'flex' }}><window.IconCheck size={12}/></span> :
                                     <span style={{ color: p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--pending)', display: 'flex' }}><window.IconClock size={12}/></span>
                                   }
                                 </div>
                                 <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)' }}>{p.partNumber}</span>
                                 <span style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.partDesc}</span>
                                 <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)', textAlign: 'right' }}>{p.qty}</span>
                                 <span className="mono" style={{ fontSize: 11, color: isRcvd ? 'var(--ready-ink)' : 'var(--fg-3)', textAlign: 'right' }}>{p.received}</span>
                                 <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)', textAlign: 'right' }}>
                                   {p.price != null && p.price > 0 ? `$${Number(p.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                 </span>
                                 <span className="mono" style={{ fontSize: 10, color: p.daysUntilDue < 0 && !isRcvd ? 'var(--threat)' : 'var(--fg-2)' }}>
                                   {p.dueDate ? new Date(p.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '—'}
                                 </span>
                                 <span className="mono" style={{ textAlign: 'right', fontSize: 10, color: isRcvd ? 'var(--ready-ink)' : (p.daysUntilDue < 0 ? 'var(--threat)' : 'var(--fg-3)') }}>
                                   {isRcvd ? (p.receivedDate ? new Date(p.receivedDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Rcvd') : (p.daysUntilDue < 0 ? `${p.daysUntilDue}d` : '—')}
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
             )}
           </div>
         );
      })}
    </div>
  );
}


// ── Email helpers ────────────────────────────────────────────────────────────
function buildEmailBody(e, job) {
  return `Subject: SDC Job ${job?.id || ''} — Expedite Request\n\n${e.vendor} Procurement Team,\n\nReference: SDC Job ${job?.id || ''} (${job?.name || ''})\nBuild Start (firm baseline): ${job?.buildStart || ''}\n\nWe have ${e.pos} open purchase order${e.pos > 1 ? 's' : ''} with promised dates that conflict with our firm build start. Please confirm whether expedite is achievable, and provide updated promise dates within 48 hours.\n\nIf expedite is not feasible, please propose alternates. We can split-ship partial qtys against the build start date.\n\nRegards,\n${job?.buyer || 'Procurement'}\nProcurement, Stevens Design & Controls`;
}

function copyToClipboard(text, onDone) {
  navigator.clipboard.writeText(text).then(() => { if (onDone) onDone(); });
}

function EmailRow({ e, job, open, onToggle }) {
  const [copied, setCopied] = useState(false);
  const body = buildEmailBody(e, job);
  const onCopy = ev => { ev.stopPropagation(); copyToClipboard(body, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
      <div className="row-hover" onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '3px 40px 1.5fr 1fr auto auto', gap: 16, padding: '12px 20px', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ width: 3, height: 40, borderRadius: 1.5, background: e.overdue ? 'var(--threat)' : 'var(--sdc-blue)' }}/>
        <window.VendorAvatar vendor={e.vendor} size={30} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{e.vendor}</span>
            {e.overdue && <window.StatusBadge status="OVERDUE" />}
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{e.pos} PO{e.pos > 1 ? 's' : ''}</span>
        </div>
        <span className="mono" style={{ fontSize: 11, color: e.contacts?.length ? 'var(--fg-3)' : 'var(--threat)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {e.contacts?.length ? e.contacts.join(', ') : 'No contact email in ERP'}
        </span>
        <button className="btn-secondary" onClick={ev => { ev.stopPropagation(); onToggle(); }} style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}>
          <window.IconMail size={12} /> {open ? 'Close' : 'Preview'}
        </button>
        <button className="btn-secondary" onClick={onCopy} style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}>
          <window.IconCopy size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px 59px', display: 'grid', gap: 12 }} className="fade-in">
          <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-soft)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-1)', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Email Draft</span>
              <span className="mono" style={{ fontWeight: 400 }}>Expedite Request — Job {job?.id}</span>
            </div>
            <pre className="mono" style={{ margin: 0, padding: 16, fontSize: 12, lineHeight: 1.6, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', background: 'transparent' }}>{body}</pre>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={onCopy}><window.IconCopy size={14} /> {copied ? 'Copied to Clipboard' : 'Copy Email Body'}</button>
            <a href={`mailto:${(e.contacts || []).join(',')}?subject=${encodeURIComponent(`SDC Job ${job?.id || ''} — Expedite Request`)}&body=${encodeURIComponent(body)}`}
               className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13, borderRadius: 6 }}
               onClick={ev => ev.stopPropagation()}>
              <window.IconMail size={14} stroke="white" /> Open in Mail Client
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailsPanel({ emails, job }) {
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(null);
  const overdueCount = emails.filter(e => e.overdue).length;
  const onCopyAll = () => {
    const all = emails.map(e => buildEmailBody(e, job)).join('\n\n' + '─'.repeat(60) + '\n\n');
    copyToClipboard(all, () => { setCopied('all'); setTimeout(() => setCopied(null), 2000); });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--fg-2)', flex: 1 }}>
          {emails.length} supplier follow-ups ready · <span style={{ color: 'var(--threat-ink)', fontWeight: 600 }}>{overdueCount} overdue</span> · auto-drafted from open POs
        </span>
        <button className="btn-secondary" onClick={onCopyAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12 }}>
          <window.IconCopy size={13}/> {copied === 'all' ? 'Copied' : 'Copy All'}
        </button>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12 }}>
          <window.IconSparkle size={13}/> Send Wave
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {emails.map((e, i) => (
          <EmailRow key={i} e={e} job={job} open={open === i} onToggle={() => setOpen(open === i ? null : i)}/>
        ))}
        {emails.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>No vendor emails to draft.</div>}
      </div>
    </div>
  );
}

function OverduePartsView({ poActions }) {
  const fmt = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

  const { arrivingSoon, dueToday, arrivedLate } = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const windowStart = new Date(todayStart); windowStart.setDate(windowStart.getDate() - 7);
    const windowEnd   = new Date(todayStart); windowEnd.setDate(windowEnd.getDate() + 8);
    const arrivingSoon = [], dueToday = [], arrivedLate = [];
    [...(poActions?.critical || []), ...(poActions?.warning || []), ...(poActions?.onTrack || [])].forEach(entry => {
      entry.po.parts.forEach(p => {
        if (p.received >= p.qty) return;
        if (!p.dueDate) return;
        const d = new Date(p.dueDate);
        if (d < windowStart || d >= windowEnd) return;
        const row = { ...p, supplier: entry.supplier, poId: entry.po.poId };
        if (d >= tomorrowStart) arrivingSoon.push(row);
        else if (d >= todayStart) dueToday.push(row);
        else arrivedLate.push(row);
      });
    });
    arrivedLate.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
    arrivingSoon.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return { arrivingSoon, dueToday, arrivedLate };
  }, [poActions]);

  const COLS = '115px 1fr 160px 90px 80px 80px';
  const HDR = {
    display: 'grid', gridTemplateColumns: COLS, gap: 10,
    padding: '6px 16px', fontSize: 9, fontWeight: 700, color: 'var(--fg-3)',
    letterSpacing: '0.07em', textTransform: 'uppercase',
    background: 'var(--bg-3)', borderBottom: '1px solid var(--border-soft)',
    position: 'sticky', top: 0, zIndex: 2,
  };
  const ROW = { display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '7px 16px', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 };

  const Section = ({ label, color, parts }) => {
    if (parts.length === 0) return null;
    return (
      <>
        <div style={{ padding: '7px 16px', background: `${color}0d`, borderTop: '1px solid var(--border-soft)', borderBottom: `1px solid ${color}25`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 10, padding: '1px 8px' }}>{parts.length}</span>
        </div>
        {parts.map((p, i) => (
          <div key={i} className="row-hover" style={{ ...ROW, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--sdc-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.partNumber}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.partDesc}</span>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.supplier}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--sdc-blue)', fontWeight: 600 }}>{p.poId}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>{fmt(p.requiredDate)}</span>
            <span className="mono" style={{ fontSize: 10, color, fontWeight: 600 }}>{fmt(p.dueDate)}</span>
          </div>
        ))}
      </>
    );
  };

  if (arrivedLate.length === 0 && dueToday.length === 0 && arrivingSoon.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
        No parts due within ±7 days.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={HDR}>
        <span>Part #</span><span>Description</span><span>Supplier</span>
        <span>PO #</span><span>Req Date</span><span>Exp Date</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Section label="Arrived Late"   color="#dc2626" parts={arrivedLate}  />
        <Section label="Expected Today" color="#2563eb" parts={dueToday}     />
        <Section label="Arriving Soon"  color="#16a34a" parts={arrivingSoon} />
      </div>
    </div>
  );
}

window.PoTab = PoTab;
