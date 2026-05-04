// App shell — top bar, left rail sidebar, and main content routing
const { useState, useEffect, useRef } = React;

// Cache versioning — bump this whenever the mapped data shape changes
const CACHE_VERSION = 'v8';
(function purgeStaleCaches() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sdc_cache_') && !key.endsWith('_' + CACHE_VERSION)) {
        localStorage.removeItem(key);
      }
    }
  } catch(e) {}
})();

// ─── Recent Jobs helpers ────────────────────────────────────────────────────
function getRecentJobs() {
  try { return JSON.parse(localStorage.getItem('sdc_recent_jobs') || '[]'); }
  catch(e) { return []; }
}
function saveRecentJob(id, name) {
  try {
    const list = getRecentJobs().filter(j => j.id !== id);
    list.unshift({ id, name });
    localStorage.setItem('sdc_recent_jobs', JSON.stringify(list.slice(0, 5)));
  } catch(e) {}
}

// ─── Landing Screen ─────────────────────────────────────────────────────────
function JobLandingScreen({ onLoad }) {
  const [input, setInput] = useState('');
  const [recentJobs, setRecentJobs] = useState(getRecentJobs);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    const id = input.trim();
    if (!id) return;
    onLoad(id);
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, var(--bg) 0%, var(--bg-sunken) 100%)',
    }}>
      {/* Card */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: 'var(--shadow-lg)',
        padding: '48px 52px', width: 480, display: 'flex', flexDirection: 'column', gap: 32,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <img
            src="assets/sdc-logo-blue.png"
            style={{ height: 36 }}
            onError={e => e.target.style.display = 'none'}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              SDC Command
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>
              Build Readiness · PO Tracker · Project Costs
            </div>
          </div>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Job Number
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. 1129"
              style={{
                flex: 1, height: 44, padding: '0 14px',
                fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)',
                background: 'var(--bg-sunken)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--ink)', outline: 'none',
                letterSpacing: '0.04em',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--sdc-blue)';
                e.target.style.boxShadow = '0 0 0 3px var(--sdc-blue-soft)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              style={{
                height: 44, padding: '0 22px',
                background: input.trim() ? 'var(--sdc-blue)' : 'var(--bg-sunken)',
                color: input.trim() ? 'white' : 'var(--ink-4)',
                border: '1px solid ' + (input.trim() ? 'var(--sdc-blue)' : 'var(--border)'),
                borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              Load →
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
            Press <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>Enter</span> to load
          </div>
        </div>

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Recent Projects
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => onLoad(job.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg-sunken)', border: '1px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-sunken)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--sdc-blue)' }}>#{job.id}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{job.name || 'Project ' + job.id}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Open →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: 'var(--ink-4)' }}>
        Live data from TotalETO · SDC Automation
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
function App() {
  const [jobId, setJobId] = useState(null);
  const [tab, setTab] = useState(() => localStorage.getItem('sdc_active_tab') || 'readiness');
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('sdc_status_filter') || 'all');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => { localStorage.setItem('sdc_active_tab', tab); }, [tab]);
  useEffect(() => { localStorage.setItem('sdc_status_filter', statusFilter); }, [statusFilter]);

  useEffect(() => {
    if (!jobId) return;

    // Try cache first
    try {
      const cached = localStorage.getItem(`sdc_cache_${jobId}_${CACHE_VERSION}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setLoading(false);
        return;
      }
    } catch(e) {}

    setLoading(true);
    setError(null);
    setData(null);

    Promise.all([
      fetch(`/api/readiness/${jobId}`).then(res => {
        if (!res.ok) throw new Error('Project not found — check the job number and try again.');
        return res.json();
      }),
      fetch(`/api/emails/${jobId}`).then(res => res.ok ? res.json() : { emails: [] })
    ])
      .then(([raw, rawEmails]) => {
        const mapped = {
          job: {
            id: raw.project.ProjectID,
            name: raw.project.ProjectName,
            buildStart: raw.buildDates?.buildStart || '2026-06-01',
            shipDate: raw.buildDates?.buildComplete || '2026-08-01',
            kpis: { assemblies: 0, ready: 0, close: 0, blocked: 0, noPO: 0 },
            actMat: raw.projectCosting?.ActMaterials || 0,
            estMat: raw.projectCosting?.EstMaterials || 0,
            actLabor: (raw.projectCosting?.ActEngLabor || 0) + (raw.projectCosting?.ActMfgLabor || 0),
            estLabor: (raw.projectCosting?.EstEngLabor || 0) + (raw.projectCosting?.EstMfgLabor || 0),
            marginActual: (raw.projectCosting?.ActualMargin || 0) / 100,
            marginTarget: (raw.projectCosting?.BudgetMargin || 0) / 100,
          },
          readiness: raw.specs.map(s => ({
            spec: s.specId,
            title: s.specName,
            lines: s.totalParts,
            assemblies: (s.machines || []).map(machine => ({
              ...machine,
              code: machine.pn,
              name: machine.pn,
              desc: machine.desc,
              pct: machine.stats?.pct || 0,
              ready: machine.stats?.received || 0,
              total: machine.stats?.total || 0,
              noPo: machine.stats?.noPO || 0,
              status: (machine.stats?.pct >= 85) ? 'ready' : (machine.stats?.pct >= 60) ? 'close' : 'blocked',
              children: [],
            }))
          })),
          costing: (raw.specCosting || []).map(s => ({
            spec: String(s.SectionID),
            name: s.SectionName,
            laborHrs: (s.EngHours || 0) + (s.MfgHours || 0),
            labor: (s.EngLabor || 0) + (s.MfgLabor || 0),
            materials: s.TotalMaterials || 0,
            total: s.TotalCost || 0,
            margin: s.Margin || 0,
          })),
          poActions: raw.poActions,
          emails: (rawEmails.emails || []).map(e => ({
            vendor: e.supplier,
            overdue: e.isOverdue,
            pos: e.poCount,
            contacts: [e.email].filter(Boolean),
            subject: e.subject,
            body: e.body
          })),
          nopo: raw.specs.flatMap(s => (s.noPoParts || []).map(p => ({
            ...p,
            parent: (p.parentPN ? `${p.parentPN} ` : '') + (p.parentDesc || p.parentPN || 'Loose Parts'),
          })))
        };

        mapped.readiness.forEach(s => {
          s.assemblies.forEach(a => {
            mapped.job.kpis.assemblies++;
            if (a.status === 'ready') mapped.job.kpis.ready++;
            else if (a.status === 'close') mapped.job.kpis.close++;
            else mapped.job.kpis.blocked++;
            mapped.job.kpis.noPO += a.noPo;
          });
        });

        setData(mapped);
        saveRecentJob(String(jobId), mapped.job.name);
        localStorage.setItem(`sdc_cache_${jobId}_${CACHE_VERSION}`, JSON.stringify(mapped));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [jobId]);

  // ── No job selected yet — show landing screen ──
  if (!jobId) {
    return <JobLandingScreen onLoad={id => { setError(null); setData(null); setJobId(id); setTab('readiness'); }} />;
  }

  // ── Error ──
  if (error) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
          <div className="eyebrow" style={{ color: 'var(--threat)' }}>Could Not Load Job #{jobId}</div>
          <p style={{ color: 'var(--ink-3)', margin: '12px 0 24px', fontSize: 14 }}>{error}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setError(null); setData(null); setLoading(true); /* trigger effect */ setJobId(String(jobId)); }}>
              Retry
            </button>
            <button className="btn" onClick={() => { setJobId(null); setError(null); setData(null); }}>
              ← Back to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading (also covers the one-tick gap before useEffect sets loading=true) ──
  if (loading || !data) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-sunken) 100%)', color: 'var(--ink-3)',
      }}>
        <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 28 }}>
          <div className="spinner" style={{ width: '100%', height: '100%', border: '3px solid var(--bg-sunken)', borderTopColor: 'var(--sdc-blue)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <img src="assets/sdc-logo-blue.png" style={{ height: 22, opacity: 0.7 }} onError={e => e.target.style.display = 'none'} />
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', fontWeight: 600, color: 'var(--ink)' }}>LOADING PROJECT</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 6 }}>Retrieving live data for Job #{jobId}…</div>
      </div>
    );
  }

  // ── Dashboard ──
  const navItems = [
    { id: 'readiness', label: 'Build Readiness', icon: <window.IconLayers size={14}/> },
    { id: 'po',        label: 'PO Tracker',       icon: <window.IconTruck size={14}/>, count: data.poActions?.critical?.length || 0, countAccent: 'threat' },
    { id: 'cost',      label: 'Project Costs',    icon: <window.IconDollar size={14}/> },
    { id: 'emails',    label: 'Vendor Emails',    icon: <window.IconMail size={14}/>, count: data.emails?.length || 0, countAccent: 'pending' },
  ];

  return (
    <div className="app">
      <window.TopBar jobId={jobId} setJobId={id => { setData(null); setJobId(id); }} job={data.job} setActiveTab={setTab} loading={loading}/>

      <aside className="rail">
        <div className="rail-section">
          <div className="rail-h">Project</div>
          {navItems.map(item => (
            <button key={item.id} className={`rail-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <span className="ico">{item.icon}</span>
                {item.label}
              </span>
              {item.count > 0 && (
                <span className={`badge badge-${item.countAccent === 'threat' ? 'threat' : 'pending'}`} style={{ height: 16, fontSize: 9.5 }}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="rail-divider"/>

        <div className="rail-section">
          <div className="rail-h">Quick Filters</div>
          <button className="rail-item" onClick={() => { setTab('readiness'); setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready'); }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="ico"><span className="dot-led ready" style={{margin:0}}/></span>
              Ready to Build
            </span>
            <span className="count">{data.job.kpis.ready}</span>
          </button>
          <button className="rail-item" onClick={() => { setTab('readiness'); setStatusFilter(statusFilter === 'close' ? 'all' : 'close'); }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="ico"><span className="dot-led pending" style={{margin:0}}/></span>
              Close (80–99%)
            </span>
            <span className="count">{data.job.kpis.close}</span>
          </button>
          <button className="rail-item" onClick={() => { setTab('readiness'); setStatusFilter(statusFilter === 'blocked' ? 'all' : 'blocked'); }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="ico"><span className="dot-led threat" style={{margin:0}}/></span>
              Blocked / Risks
            </span>
            <span className="count">{data.job.kpis.blocked}</span>
          </button>
          <button className="rail-item" onClick={() => { setTab('readiness'); setStatusFilter('all'); setQuery('no po'); }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="ico"><window.IconCircleX size={12}/></span>
              Parts — No PO
            </span>
            <span className="count">{data.job.kpis.noPO}</span>
          </button>
        </div>

        <div className="rail-divider"/>

        <div className="rail-section">
          <div className="rail-h">Specs</div>
          {data.readiness.map(spec => (
            <button key={spec.spec} className="rail-item" onClick={() => { setTab('readiness'); setQuery(`Spec ${spec.spec}`); }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <span className="ico"><window.IconBox size={12}/></span>
                Spec {spec.spec} — Mech.
              </span>
              <span className="count">{spec.lines}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="rail-section">
          <div className="rail-h">Recent Projects</div>
          {getRecentJobs().map(job => (
            <button key={job.id} className="rail-item" onClick={() => { setData(null); setJobId(job.id); setTab('readiness'); }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>#{job.id}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{job.name || 'Project ' + job.id}</span>
              </span>
            </button>
          ))}
          <button
            className="rail-item"
            onClick={() => { setJobId(null); setData(null); setError(null); }}
            style={{ marginTop: 4, color: 'var(--sdc-blue)', fontWeight: 500 }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span className="ico"><window.IconSearch size={12}/></span>
              Open Different Job…
            </span>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          {tab === 'readiness' && <window.ReadinessTab data={data} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} jobId={jobId}/>}
          {tab === 'po' && <window.PoTab data={data}/>}
          {tab === 'cost' && <window.CostTab data={data}/>}
          {tab === 'emails' && <window.EmailsTab data={data} job={data.job}/>}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
