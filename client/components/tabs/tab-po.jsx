// PO Action List — Parts view + Vendor lens
const { useState, useMemo, useEffect } = React;

function PoTab({ data, highlightPoIds = [], onClearHighlight }) {
  const [view, setView] = useState('parts');
  const [query, setQuery] = useState('');
  const [expandAction, setExpandAction] = useState({ type: null, version: 0 });

  useEffect(() => {
    if (highlightPoIds.length > 0) setView('pos');
  }, [highlightPoIds]);

  const lateCount = (data.poActions?.critical?.length || 0);
  const totalPos = (data.poActions?.critical?.length || 0) + (data.poActions?.warning?.length || 0) + (data.poActions?.onTrack?.length || 0);

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
          { id: 'parts',  label: 'Parts No PO',  count: data.nopo.length },
          { id: 'pos',    label: 'PO Tracker',   count: totalPos },
          { id: 'emails', label: 'Draft Emails', count: data.emails?.length || 0 },
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
        <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>Click any part number to copy</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="panel" style={{ height: '100%', overflow: 'auto', background: 'var(--bg-1)', border: '1px solid var(--border-soft)' }}>
          {view === 'parts' && <PartsFlatView nopo={data.nopo} query={query} job={data.job}/>}
          {view === 'pos' && <PoTracker poActions={data.poActions} query={query} highlightPoIds={highlightPoIds} onClearHighlight={onClearHighlight}/>}
          {view === 'emails' && <EmailsPanel emails={data.emails || []} job={data.job}/>}
        </div>
      </div>
    </div>
  );
}

function PartsFlatView({ nopo, query, job }) {
  const [copiedPn, setCopiedPn] = React.useState(null);

  const copyPn = (pn) => {
    navigator.clipboard?.writeText(pn).catch(() => {});
    setCopiedPn(pn);
    setTimeout(() => setCopiedPn(null), 1500);
  };

  const filtered = nopo.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return String(p.pn || p.id).toLowerCase().includes(q) || 
           (p.desc || '').toLowerCase().includes(q) || 
           (p.parentPN || '').toLowerCase().includes(q) ||
           (p.parentDesc || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'grid', 
        gridTemplateColumns: '150px 1fr 200px 80px 180px 140px',
        padding: '12px 24px', 
        gap: 24,
        background: 'var(--bg-sunken)', 
        borderBottom: '1px solid var(--border-soft)',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div className="eyebrow" style={{ fontSize: 10 }}>Part Number</div>
        <div className="eyebrow" style={{ fontSize: 10 }}>Description</div>
        <div className="eyebrow" style={{ fontSize: 10 }}>Assembly / Source</div>
        <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Qty</div>
        <div className="eyebrow" style={{ fontSize: 10 }}>Manufacturer</div>
        <div className="eyebrow" style={{ fontSize: 10, textAlign: 'right' }}>Status</div>
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

          return (
            <div key={i} className="row-hover" style={{
              display: 'grid', 
              gridTemplateColumns: '150px 1fr 200px 80px 180px 140px',
              padding: '14px 24px', gap: 24, alignItems: 'center',
              borderBottom: '1px solid var(--border-soft)',
              background: urgency === 'overdue' ? 'var(--threat-soft)' : 'transparent'
            }}>
              <span
                className="mono"
                title="Click to copy"
                onClick={() => copyPn(p.pn || p.id)}
                style={{ fontSize: 12, fontWeight: 700, color: copiedPn === (p.pn || p.id) ? 'var(--ready-ink)' : 'var(--sdc-blue)', cursor: 'pointer', transition: 'color 0.2s' }}
              >{copiedPn === (p.pn || p.id) ? '✓ Copied' : (p.pn || p.id)}</span>
              <span style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)' }}>{p.parentPN || 'LOOSE'}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.parentDesc || 'Loose Parts'}</span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)', textAlign: 'right' }}>{p.qty}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <window.VendorAvatar vendor={p.manufacturer || 'SDC'} size={20} />
                 <span style={{ fontSize: 12, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.manufacturer === 'SDC' ? 'In-house (SDC)' : (p.manufacturer || 'SDC')}
                 </span>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span className={`badge badge-${u.cls}`} style={{ fontSize: 9 }}>{u.label}</span>
                <span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600 }}>{u.sub}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PoTracker({ poActions, query, highlightPoIds = [], onClearHighlight }) {
  const [groupBy, setGroupBy] = useState('urgency');
  const [expandedPos, setExpandedPos] = useState(() => new Set(highlightPoIds));

  useEffect(() => {
    if (highlightPoIds.length === 0) return;
    setExpandedPos(new Set(highlightPoIds));
    setGroupBy('urgency');
  }, [highlightPoIds]);

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

      {highlightPoIds.length > 0 && (
        <div style={{ padding: '8px 20px', background: 'var(--sdc-blue-soft)', borderBottom: '1px solid var(--sdc-blue-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--sdc-blue-ink)' }}>
            Showing {highlightPoIds.length} PO{highlightPoIds.length !== 1 ? 's' : ''} from Schedule Health timeline
          </span>
          <button onClick={() => { onClearHighlight && onClearHighlight(); setExpandedPos(new Set()); }} style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--sdc-blue-ink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Clear filter ×
          </button>
        </div>
      )}
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

window.PoTab = PoTab;
