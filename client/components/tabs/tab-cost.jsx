// Costing & Margins tab

function CostTab({ data }) {
  const job = data.job || {};
  const costing = data.costing || [];
  const [sortBy, setSortBy] = React.useState('total');
  const [sortDir, setSortDir] = React.useState('desc');

  const sorted = React.useMemo(() => {
    const arr = [...costing];
    arr.sort((a,b) => {
      const va = a[sortBy], vb = b[sortBy];
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [costing, sortBy, sortDir]);

  const onSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const sortIcon = (col) => sortBy !== col ? '' : (sortDir === 'asc' ? ' ↑' : ' ↓');

  const totalActual = (job.actMat || 0) + (job.actLabor || 0);
  const totalEstimate = (job.estMat || 0) + (job.estLabor || 0);
  const totalRemaining = Math.max(0, totalEstimate - totalActual);
  const pctOfEstimate = totalEstimate > 0 ? (totalActual / totalEstimate) * 100 : 0;
  
  const matLines = data.nopo.length + (data.readiness.reduce((acc, s) => acc + s.lines, 0));
  const matBlocked = data.job.kpis.blocked || 0;

  const matVar = job.actMat - job.estMat;
  const labVar = job.actLabor - job.estLabor;
  const marginPp = (job.marginActual - job.marginTarget) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'auto', paddingBottom: 20 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: '-0.02em' }}>Project Costs</h1>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>Real-time material spend & labor against estimate — live from MS SQL ERP</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
            <window.IconExport size={14} /> Export
          </button>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
            <window.IconRefresh size={14} /> Sync ERP
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 10, color: 'var(--fg-2)', marginBottom: 4 }}>PROJECT FINANCIALS</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Materials & labor — actuals to date</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
            ${totalActual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-2)', marginBottom: 6 }}>
              <span><b style={{ color: 'var(--fg-1)' }}>{Math.round(pctOfEstimate)}%</b> of ${ (totalEstimate/1e6).toFixed(1) }M estimate</span>
              <span><b style={{ color: 'var(--fg-1)' }}>${ (totalRemaining/1e6).toFixed(1) }M</b> remaining budget</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${Math.min(100, pctOfEstimate)}%`, background: 'linear-gradient(90deg, #3B82F6, #10B981)', height: '100%' }} />
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eyebrow" style={{ fontSize: 10, color: 'var(--fg-2)' }}>MATERIALS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
            ${ (job.actMat / 1e6).toFixed(1) }M
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            {matLines} lines received · {matBlocked} blocked
          </div>
        </div>

        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="eyebrow" style={{ fontSize: 10, color: 'var(--fg-2)' }}>LABOR</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
            ${ (job.actLabor / 1e3).toFixed(1) }K
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            {job.actLabor > 0 ? 'Build in progress' : "Build hasn't started"} · {Math.round(job.actLabor / 80)} hrs
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 12, fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.05em' }}>SECTION COST BREAKDOWN</div>
        <div className="panel" style={{ overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '70px 1fr 100px 130px 140px 140px',
            padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', gap: 12,
            background: 'var(--bg-1)', position: 'sticky', top: 0, zIndex: 10,
          }}>
            <div className="eyebrow" style={{cursor:'pointer', fontSize: 10}} onClick={()=>onSort('spec')}>SECTION{sortIcon('spec')}</div>
            <div className="eyebrow" style={{cursor:'pointer', fontSize: 10}} onClick={()=>onSort('name')}>NAME{sortIcon('name')}</div>
            <div className="eyebrow" style={{cursor:'pointer', fontSize: 10}} onClick={()=>onSort('laborHrs')}>LABOR HRS{sortIcon('laborHrs')}</div>
            <div className="eyebrow" style={{cursor:'pointer', fontSize: 10}} onClick={()=>onSort('labor')}>LABOR ${sortIcon('labor')}</div>
            <div className="eyebrow" style={{cursor:'pointer', fontSize: 10}} onClick={()=>onSort('materials')}>MATERIALS ${sortIcon('materials')}</div>
            <div className="eyebrow" style={{cursor:'pointer', fontSize: 10, textAlign: 'right'}} onClick={()=>onSort('total')}>TOTAL COST ${sortIcon('total')}</div>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
            {sorted.map((row, i) => (
              <div key={i} className="row-hover" style={{
                display: 'grid', gridTemplateColumns: '70px 1fr 100px 130px 140px 140px',
                padding: '12px 20px', gap: 12, alignItems: 'center',
                borderBottom: i === sorted.length - 1 ? 'none' : '1px solid var(--border-soft)',
              }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{row.spec}</span>
                <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{row.name}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', textAlign: 'center' }}>{row.laborHrs || 0}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)' }}>${(row.labor || 0).toLocaleString()}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-1)' }}>${(row.materials || 0).toLocaleString()}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 600, textAlign: 'right' }}>${(row.total || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.CostTab = CostTab;
