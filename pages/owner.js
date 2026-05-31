import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const NPT = { timeZone: 'Asia/Kathmandu' };
function nptToday() { return new Date(Date.now() + (5*60+45)*60*1000).toISOString().split('T')[0]; }
function fmtDate(str, opts = {}) {
  if (!str) return '';
  const d = new Date(str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-IN', { ...NPT, ...opts });
}

const TABS = [
  { id: 'dash',      label: '📊 Dashboard' },
  { id: 'analytics', label: '📈 Analytics' },
  { id: 'products',  label: '🏷 Products' },
  { id: 'phones',    label: '📱 Phones' },
  { id: 'costs',     label: '💲 Costs' },
  { id: 'repairs',   label: '🔧 Repairs' },
  { id: 'sales',     label: '🛍 Sales' },
  { id: 'credits',     label: '💳 Credits' },
  { id: 'notes', label: '📝 Notes' },
  { id: 'expenses',    label: '💸 Expenses' },
  { id: 'cash',        label: '💰 Cash' },
  { id: 'loyalty',     label: '🎁 Loyalty' },
];
const PRIMARY_TAB_IDS = ['dash', 'analytics', 'cash'];
const MENU_TABS = TABS.filter(t => !PRIMARY_TAB_IDS.includes(t.id));

export default function Owner() {
  const router = useRouter();
  const [tab, setTab] = useState('dash');
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['dash']));
  const [products, setProducts] = useState([]);
  const [showChangePw, setShowChangePw] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function switchTab(id) {
    setTab(id);
    setMountedTabs(prev => { const s = new Set(prev); s.add(id); return s; });
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function loadProducts() {
    try { const c = JSON.parse(localStorage.getItem('pos_products') || 'null'); if (c?.length) setProducts(c); } catch {}
    fetch('/api/products').then(r => r.json()).then(data => {
      setProducts(data);
      try { localStorage.setItem('pos_products', JSON.stringify(data)); } catch {}
    });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <>
      <Head><title>Owner Dashboard — Shop POS</title></Head>
      <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setMenuOpen(p => !p)}
              style={{ background: menuOpen ? 'rgba(176,96,255,0.12)' : 'transparent', border: `1.5px solid ${menuOpen ? 'var(--purple)' : 'var(--border)'}`, borderRadius: 8, color: menuOpen ? 'var(--purple)' : 'var(--text)', padding: '5px 10px', cursor: 'pointer', fontSize: 17, lineHeight: 1, fontWeight: 700, flexShrink: 0 }}>
              {menuOpen ? '✕' : '☰'}
            </button>
            {(() => {
              const active = MENU_TABS.find(t => t.id === tab);
              return active
                ? <span style={{ fontWeight: 700, color: 'var(--purple)', fontSize: 15 }}>{active.label}</span>
                : <span style={{ fontWeight: 700, color: 'var(--purple)', fontSize: 15 }}>👑 Owner Panel</span>;
            })()}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => router.push('/staff')} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>Staff</button>
            <button onClick={() => setShowChangePw(true)} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>🔑</button>
            <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px' }}>Logout</button>
          </div>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 24, background: 'rgba(0,0,0,0.35)' }} />
            <div style={{ position: 'fixed', top: 53, left: 0, right: 0, zIndex: 25, maxWidth: 520, margin: '0 auto' }}>
              <div style={{ background: 'var(--card)', borderRadius: '0 0 16px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
                {MENU_TABS.map((t, i) => (
                  <button key={t.id} onClick={() => { switchTab(t.id); setMenuOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', textAlign: 'left',
                      background: tab === t.id ? 'rgba(176,96,255,0.1)' : 'transparent',
                      border: 'none', borderBottom: i < MENU_TABS.length - 1 ? '1px solid var(--border)' : 'none',
                      color: tab === t.id ? 'var(--purple)' : 'var(--text)',
                      fontSize: 15, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer' }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{t.label.split(' ')[0]}</span>
                    <span>{t.label.split(' ').slice(1).join(' ')}</span>
                    {tab === t.id && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--purple)' }}>● active</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Change password modal */}
        {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

        {/* Primary tab bar */}
        <div className="tab-bar">
          {TABS.filter(t => PRIMARY_TAB_IDS.includes(t.id)).map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              style={{ fontSize: 11, flex: 1, minWidth: 0 }} onClick={() => switchTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab content — keep-alive: mount once, hide/show with CSS */}
        <div style={{ padding: '16px' }}>
          {mountedTabs.has('dash')      && <div style={{ display: tab==='dash'      ? 'block':'none' }}><DashboardTab /></div>}
          {mountedTabs.has('analytics') && <div style={{ display: tab==='analytics' ? 'block':'none' }}><AnalyticsTab /></div>}
          {mountedTabs.has('products')  && <div style={{ display: tab==='products'  ? 'block':'none' }}><ProductsTab products={products} reload={loadProducts} /></div>}
          {mountedTabs.has('phones')    && <div style={{ display: tab==='phones'    ? 'block':'none' }}><OwnerPhonesTab /></div>}
          {mountedTabs.has('costs')     && <div style={{ display: tab==='costs'     ? 'block':'none' }}><CostsTab products={products} /></div>}
          {mountedTabs.has('repairs')   && <div style={{ display: tab==='repairs'   ? 'block':'none' }}><RepairsTab /></div>}
          {mountedTabs.has('sales')     && <div style={{ display: tab==='sales'     ? 'block':'none' }}><SalesHistoryTab /></div>}
          {mountedTabs.has('credits')   && <div style={{ display: tab==='credits'   ? 'block':'none' }}><OwnerCreditsTab /></div>}
          {mountedTabs.has('notes')     && <div style={{ display: tab==='notes'     ? 'block':'none' }}><NotesTab isOwner /></div>}
          {mountedTabs.has('expenses')  && <div style={{ display: tab==='expenses'  ? 'block':'none' }}><OwnerExpensesTab /></div>}
          {mountedTabs.has('cash')      && <div style={{ display: tab==='cash'      ? 'block':'none' }}><CashTab /></div>}
          {mountedTabs.has('loyalty')   && <div style={{ display: tab==='loyalty'   ? 'block':'none' }}><LoyaltyOwnerTab /></div>}
        </div>
      </div>
    </>
  );
}

// ─── CHANGE PASSWORD MODAL ───────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError('');
    if (form.newPassword !== form.confirm) { setError('New passwords do not match'); return; }
    if (form.newPassword.length < 6)       { setError('New password must be at least 6 characters'); return; }
    setSaving(true);
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) { setError(data.error || 'Failed'); return; }
    setSuccess(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🔑 Change Password</div>

        {success ? (
          <div style={{ color: 'var(--green)', textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>✓ Password changed!</div>
        ) : (
          <>
            {[['Current Password', 'currentPassword'], ['New Password', 'newPassword'], ['Confirm New Password', 'confirm']].map(([lbl, key]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{lbl.toUpperCase()}</label>
                <input type="password" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && submit()} />
              </div>
            ))}
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Change Password'}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab() {
  const [data, setData] = useState(null);
  const [todayActuals, setTodayActuals] = useState(null);
  const [inputs, setInputs] = useState({ phonesQty: '', accessoriesAmt: '', repairsAmt: '' });
  const [savedKey, setSavedKey] = useState('');
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    function loadDash() { fetch('/api/dashboard').then(r => r.json()).then(setData); }
    loadDash();
    const iv = setInterval(loadDash, 120000);
    window.addEventListener('pos:products-updated', loadDash);
    loadToday();
    loadInsights();
    return () => { clearInterval(iv); window.removeEventListener('pos:products-updated', loadDash); };
  }, []);

  function loadInsights() {
    setAiLoading(true);
    fetch('/api/ai/owner-insights').then(r => r.json()).then(d => {
      setAiInsights(d.insights || null);
      setAiLoading(false);
    }).catch(() => setAiLoading(false));
  }

  function loadToday() {
    fetch('/api/today').then(r => r.json()).then(d => {
      setTodayActuals(d);
      setInputs({
        phonesQty:      d.targets.phonesQty      ? String(d.targets.phonesQty)      : '',
        accessoriesAmt: d.targets.accessoriesAmt ? String(d.targets.accessoriesAmt) : '',
        repairsAmt:     d.targets.repairsAmt     ? String(d.targets.repairsAmt)     : '',
      });
    });
  }

  async function save(key, value) {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
    setSavedKey(key);
    setTimeout(() => setSavedKey(''), 2000);
    loadToday();
  }

  if (!data) return <LoadingState />;

  const { today, monthly, lastMonth, payments, topProducts, repairStats, activeRepairs, phoneStats, todayDiscounts, monthlyDiscounts, dailyProfit, inventoryValue, supplierDebt } = data;

  const repairStatusColors = { Pending: 'var(--amber)', 'In Progress': 'var(--cyan)', Done: 'var(--green)', Delivered: 'var(--muted)', Returned: 'var(--red)' };

  const targetRows = [
    { key: 'target_phones_qty',      label: '📱 Phones',      unit: 'units', stateKey: 'phonesQty',      actual: todayActuals?.phonesQty,      target: todayActuals?.targets?.phonesQty,      fmt: v => `${v}` },
    { key: 'target_accessories_amt', label: '🏷 Accessories', unit: 'Rs',    stateKey: 'accessoriesAmt', actual: todayActuals?.accessoriesAmt,  target: todayActuals?.targets?.accessoriesAmt, fmt: v => `Rs ${Math.round(v).toLocaleString()}` },
    { key: 'target_repairs_amt',     label: '🔧 Repairs',     unit: 'Rs',    stateKey: 'repairsAmt',     actual: todayActuals?.repairsAmt,      target: todayActuals?.targets?.repairsAmt,     fmt: v => `Rs ${Math.round(v).toLocaleString()}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Daily targets */}
      <div className="card" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>DAILY TARGETS</div>
        {targetRows.map(({ key, label, unit, stateKey, actual, target, fmt }) => {
          const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: target > 0 ? 5 : 0 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{unit}</span>
                <input value={inputs[stateKey]} onChange={e => setInputs(p => ({ ...p, [stateKey]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save(key, inputs[stateKey])}
                  type="number" placeholder="0"
                  style={{ width: 80, padding: '4px 8px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
                <button onClick={() => save(key, inputs[stateKey])} className="btn btn-green btn-sm" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
                  {savedKey === key ? '✓' : 'Set'}
                </button>
              </div>
              {target > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
                    <span>{fmt(actual)} today</span>
                    <span>{pct.toFixed(0)}% of {unit === 'units' ? `${target} units` : `Rs ${target.toLocaleString()}`}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--cyan)' : 'var(--amber)', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Insights */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <SectionLabel>🤖 AI INSIGHTS</SectionLabel>
          <button onClick={loadInsights} disabled={aiLoading}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', opacity: aiLoading ? 0.5 : 1 }}>
            {aiLoading ? '…' : '↺ Refresh'}
          </button>
        </div>
        {aiLoading && !aiInsights && (
          <div style={{ padding: '14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, fontSize: 13, color: 'var(--muted)' }}>
            Analyzing your data…
          </div>
        )}
        {aiInsights && (
          <div style={{ padding: '14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
            {aiInsights.split('\n').filter(l => l.trim()).map((line, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', marginBottom: i < aiInsights.split('\n').filter(l=>l.trim()).length - 1 ? 10 : 0 }}>
                {line}
              </div>
            ))}
          </div>
        )}
        {!aiLoading && !aiInsights && (
          <div style={{ padding: '14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, fontSize: 13, color: 'var(--muted)' }}>
            AI insights not available — add ANTHROPIC_API_KEY to enable.
          </div>
        )}
      </div>

      {/* Today */}
      <div>
        <SectionLabel>TODAY</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard val={`Rs ${today.revenue.toFixed(0)}`}      lbl="Revenue"      color="var(--cyan)" />
          <StatCard val={`Rs ${today.grossProfit.toFixed(0)}`}  lbl="Gross Profit" color="var(--green)" />
          <StatCard val={`Rs ${today.expenses.toFixed(0)}`}     lbl="Expenses"     color="var(--red)" />
          <StatCard val={`Rs ${today.profit.toFixed(0)}`}       lbl="Net Profit"   color="var(--green)" />
          <StatCard val={today.sales} lbl="Sales"      color="var(--amber)" />
          <StatCard val={today.items} lbl="Items Sold" color="var(--purple)" />
        </div>
      </div>

      {/* This month */}
      <div>
        <SectionLabel>THIS MONTH</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard val={`Rs ${monthly.revenue.toFixed(0)}`}      lbl="Revenue"      color="var(--cyan)" />
          <StatCard val={`Rs ${monthly.grossProfit.toFixed(0)}`}  lbl="Gross Profit" color="var(--green)" />
          <StatCard val={`Rs ${monthly.expenses.toFixed(0)}`}     lbl="Expenses"     color="var(--red)" />
          <StatCard val={`Rs ${monthly.profit.toFixed(0)}`}       lbl="Net Profit"   color="var(--green)" />
          <StatCard val={`${monthly.margin.toFixed(1)}%`}         lbl="Margin"       color="var(--amber)" />
          <StatCard val={monthly.sales}                            lbl="Sales"        color="var(--purple)" />
        </div>
      </div>

      {/* Last month comparison */}
      {lastMonth && (
        <div>
          <SectionLabel>LAST MONTH</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Revenue',    `Rs ${Math.round(lastMonth.revenue).toLocaleString()}`,    monthly.revenue,    lastMonth.revenue,    'var(--cyan)'],
              ['Gross Profit', `Rs ${Math.round(lastMonth.grossProfit).toLocaleString()}`, monthly.grossProfit, lastMonth.grossProfit, 'var(--green)'],
              ['Expenses',   `Rs ${Math.round(lastMonth.expenses).toLocaleString()}`,   monthly.expenses,   lastMonth.expenses,   'var(--red)'],
              ['Net Profit', `Rs ${Math.round(lastMonth.profit).toLocaleString()}`,     monthly.profit,     lastMonth.profit,     'var(--green)'],
            ].map(([lbl, val, cur, prev, color]) => {
              const diff = prev > 0 ? ((cur - prev) / prev * 100) : null;
              return (
                <div key={lbl} className="stat-card">
                  <div className="val" style={{ color, fontSize: 16 }}>{val}</div>
                  <div className="lbl">{lbl}</div>
                  {diff !== null && (
                    <div style={{ fontSize: 11, marginTop: 3, color: diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs this month
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inventory valuation */}
      {inventoryValue && (
        <div>
          <SectionLabel>INVENTORY VALUE (AT COST)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="stat-card">
              <div className="val" style={{ color: 'var(--cyan)', fontSize: 15 }}>Rs {Math.round(inventoryValue.products).toLocaleString()}</div>
              <div className="lbl">Products</div>
            </div>
            <div className="stat-card">
              <div className="val" style={{ color: 'var(--purple)', fontSize: 15 }}>Rs {Math.round(inventoryValue.phones).toLocaleString()}</div>
              <div className="lbl">Phones</div>
            </div>
            <div className="stat-card">
              <div className="val" style={{ color: 'var(--green)', fontSize: 15 }}>Rs {Math.round(inventoryValue.total).toLocaleString()}</div>
              <div className="lbl">Total Stock</div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier debt */}
      {supplierDebt && (supplierDebt.weOwe > 0 || supplierDebt.theyOwe > 0) && (
        <div>
          <SectionLabel>SUPPLIER DEBT</SectionLabel>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--amber)' }}>Rs {supplierDebt.weOwe.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>We owe</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>Rs {supplierDebt.theyOwe.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>They owe</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: supplierDebt.net >= 0 ? 'var(--green)' : 'var(--amber)' }}>
                Rs {Math.abs(supplierDebt.net).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Net {supplierDebt.net >= 0 ? '(favour)' : '(owed)'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Daily WhatsApp summary */}
      <div>
        <button
          onClick={() => {
            const d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const lines = [
              `📊 *Daily Report — ${d}*`,
              ``,
              `💰 Revenue: Rs ${Math.round(today.revenue).toLocaleString()}`,
              `📈 Gross Profit: Rs ${Math.round(today.grossProfit).toLocaleString()}`,
              `💸 Expenses: Rs ${Math.round(today.expenses).toLocaleString()}`,
              `✅ Net Profit: Rs ${Math.round(today.profit).toLocaleString()}`,
              ``,
              `🛍️ Sales: ${today.sales}  |  Items: ${today.items}`,
            ];
            if (payments?.length > 0) {
              lines.push(''); lines.push('💳 *Payments*');
              payments.forEach(p => lines.push(`• ${p.method}: Rs ${Number(p.total).toLocaleString()}`));
            }
            window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
          }}
          style={{ width: '100%', padding: '12px', background: '#25D366', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          📤 Send Daily Summary to WhatsApp
        </button>
      </div>

      {/* Daily profit */}
      {dailyProfit?.length > 0 && (
        <div>
          <SectionLabel>PROFIT BY DAY (LAST 30 DAYS)</SectionLabel>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {dailyProfit.map((row, i) => {
              const d = new Date(row.day + 'T00:00:00');
              const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const isPos = row.profit >= 0;
              return (
                <div key={row.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 56 }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, paddingLeft: 8 }}>Rs {Number(row.revenue).toLocaleString()}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)' }}>
                    {isPos ? '+' : ''}Rs {Number(row.profit).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discounts */}
      {(todayDiscounts?.total > 0 || monthlyDiscounts?.total > 0) && (
        <div>
          <SectionLabel>DISCOUNTS GIVEN</SectionLabel>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
              <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(239,68,68,0.07)', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>Rs {(todayDiscounts?.total || 0).toFixed(0)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Today</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(239,68,68,0.07)', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>Rs {(monthlyDiscounts?.total || 0).toFixed(0)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>This Month</div>
              </div>
            </div>
            {(() => {
              const rows = [
                ['Products',       todayDiscounts?.products,      monthlyDiscounts?.products],
                ['Phones',         todayDiscounts?.phones,        monthlyDiscounts?.phones],
                ['Repairs',        todayDiscounts?.repairs,       monthlyDiscounts?.repairs],
                ['Credit cleared', (todayDiscounts?.creditSales||0)+(todayDiscounts?.creditRepairs||0), (monthlyDiscounts?.creditSales||0)+(monthlyDiscounts?.creditRepairs||0)],
              ].filter(([, t, m]) => (t||0) > 0 || (m||0) > 0);
              if (!rows.length) return null;
              return rows.map(([lbl, t, m]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <span>{lbl}</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span>Rs {(t||0).toFixed(0)}</span>
                    <span>Rs {(m||0).toFixed(0)}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Payment breakdown */}
      {payments?.length > 0 && (
        <div>
          <SectionLabel>TODAY'S PAYMENTS</SectionLabel>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.map(p => (
              <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>{p.method}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {Number(p.total).toFixed(0)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{p.count} sale{p.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phones summary */}
      {phoneStats && (
        <div>
          <SectionLabel>USED PHONES</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard val={phoneStats.available}                         lbl="Available"        color="var(--cyan)" />
            <StatCard val={phoneStats.soldThisMonth}                     lbl="Sold This Month"  color="var(--green)" />
            <StatCard val={`Rs ${phoneStats.profitThisMonth.toFixed(0)}`} lbl="Phone Profit"    color="var(--green)" />
            <StatCard val={phoneStats.needsPricing}                      lbl="Need Pricing"     color={phoneStats.needsPricing > 0 ? 'var(--amber)' : 'var(--muted)'} />
          </div>
          {phoneStats.needsPricing > 0 && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.12)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--amber)' }}>
              ⚠ {phoneStats.needsPricing} phone{phoneStats.needsPricing !== 1 ? 's' : ''} waiting for price — go to Phones tab
            </div>
          )}
        </div>
      )}

      {/* Top products */}
      {topProducts?.length > 0 && (
        <div>
          <SectionLabel>TOP SELLING (THIS MONTH)</SectionLabel>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topProducts.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--muted)', fontSize: 13, width: 20, textAlign: 'center' }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.qty} units</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>Rs {Number(p.revenue).toFixed(0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>+Rs {Number(p.profit).toFixed(0)} profit</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repair stats */}
      <div>
        <SectionLabel>REPAIRS</SectionLabel>
        {repairStats?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            {repairStats.map(s => (
              <div key={s.status} className="card" style={{ textAlign: 'center', padding: '10px 8px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: repairStatusColors[s.status] || 'var(--text)' }}>{s.count}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>No repairs yet</div>
        )}

        {activeRepairs?.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>ACTIVE ({activeRepairs.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeRepairs.map(r => (
                <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.customer_name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{r.phone_model} — {r.issue?.slice(0, 40)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PRODUCTS TAB ─────────────────────────────────────────────────────────────
function ProductsTab({ products, reload }) {
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', selling_price: '', cost_price: '', stock: '', category_id: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [printing, setPrinting] = useState(null);

  useEffect(() => { loadCats(); }, []);

  function loadCats() {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }

  async function addCategory() {
    if (!newCatName.trim() || catSaving) return;
    setCatSaving(true);
    const r = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName.trim() }) });
    setCatSaving(false);
    if (r.ok) { setNewCatName(''); loadCats(); }
    else alert('That category name already exists');
  }

  async function deleteCategory(id) {
    if (!confirm('Delete category? Items will become uncategorized.')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (filterCat === id) setFilterCat(null);
    loadCats();
    reload();
  }

  async function printLabel(p) {
    setPrinting(p.id);
    try { const BT = await import('../lib/btprint'); await BT.printProductLabel(p); }
    catch (e) { alert(e.message || 'Print failed'); }
    finally { setPrinting(null); }
  }

  async function saveProduct() {
    if (!newProd.name || !newProd.selling_price) { alert('Name and selling price required'); return; }
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProd.name,
        selling_price: parseFloat(newProd.selling_price),
        cost_price: parseFloat(newProd.cost_price) || 0,
        stock: parseInt(newProd.stock) || 0,
        category_id: newProd.category_id ? parseInt(newProd.category_id) : null,
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setNewProd({ name: '', selling_price: '', cost_price: '', stock: '', category_id: '' });
    reload();
  }

  async function saveEdit(id) {
    setSaving(true);
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    reload();
    window.dispatchEvent(new CustomEvent('pos:products-updated'));
  }

  async function deleteProduct(id) {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    reload();
  }

  const uncatCount = products.filter(p => !p.category_id).length;
  const displayed = filterCat === null
    ? products
    : filterCat === 'none'
      ? products.filter(p => !p.category_id)
      : products.filter(p => p.category_id === filterCat);

  return (
    <div>
      {/* Category management */}
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>CATEGORIES</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            onClick={() => setFilterCat(null)}
            style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterCat === null ? 'var(--cyan)' : 'var(--border)'}`, background: filterCat === null ? 'rgba(0,212,255,0.12)' : 'transparent', color: filterCat === null ? 'var(--cyan)' : 'var(--muted)', cursor: 'pointer' }}>
            All ({products.length})
          </button>
          {categories.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'stretch' }}>
              <button
                onClick={() => setFilterCat(c.id)}
                style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: '20px 0 0 20px', border: `1.5px solid ${filterCat === c.id ? 'var(--purple)' : 'var(--border)'}`, borderRight: 'none', background: filterCat === c.id ? 'rgba(176,96,255,0.12)' : 'transparent', color: filterCat === c.id ? 'var(--purple)' : 'var(--muted)', cursor: 'pointer' }}>
                {c.name} ({Number(c.product_count)})
              </button>
              <button
                onClick={() => deleteCategory(c.id)}
                style={{ padding: '5px 8px', borderRadius: '0 20px 20px 0', border: `1.5px solid ${filterCat === c.id ? 'var(--purple)' : 'var(--border)'}`, borderLeft: 'none', background: filterCat === c.id ? 'rgba(176,96,255,0.12)' : 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
          {uncatCount > 0 && (
            <button
              onClick={() => setFilterCat('none')}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterCat === 'none' ? 'var(--amber)' : 'var(--border)'}`, background: filterCat === 'none' ? 'rgba(255,176,32,0.12)' : 'transparent', color: filterCat === 'none' ? 'var(--amber)' : 'var(--muted)', cursor: 'pointer' }}>
              Uncategorized ({uncatCount})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="New category name…"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 14px', flexShrink: 0 }} onClick={addCategory} disabled={!newCatName.trim() || catSaving}>
            {catSaving ? '…' : '+ Add'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {filterCat === null ? 'Products' : filterCat === 'none' ? 'Uncategorized' : (categories.find(c => c.id === filterCat)?.name || 'Products')}
          {filterCat !== null && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--muted)', marginLeft: 6 }}>({displayed.length})</span>}
        </h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setShowAdd(p => !p)}>
          {showAdd ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)', marginBottom: 4 }}>New Product</div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>CATEGORY</label>
            <select value={newProd.category_id} onChange={e => setNewProd(p => ({ ...p, category_id: e.target.value }))}>
              <option value="">— No category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {[['Name', 'name', 'text'], ['Selling Price (Rs)', 'selling_price', 'number'], ['Cost Price (Rs)', 'cost_price', 'number'], ['Opening Stock', 'stock', 'number']].map(([lbl, key, type]) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{lbl}</label>
              <input type={type} value={newProd[key]} onChange={e => setNewProd(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <button className="btn btn-green" onClick={saveProduct} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 340 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete Product?</div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
              Delete <strong style={{ color: 'var(--text)' }}>{confirmDelete.name}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, background: 'var(--red)', color: '#fff', border: 'none' }}
                onClick={() => deleteProduct(confirmDelete.id)}>Delete</button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            {filterCat !== null ? 'No products in this category.' : 'No products yet.'}
          </div>
        )}
        {displayed.map(p => (
          <div key={p.id} className="card">
            {editing?.id === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyan)' }}>Editing: {p.name}</div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>CATEGORY</label>
                  <select value={editing.category_id || ''} onChange={e => setEditing(ed => ({ ...ed, category_id: e.target.value ? parseInt(e.target.value) : null }))}>
                    <option value="">— No category —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {[['Selling Price', 'selling_price'], ['Cost Price', 'cost_price'], ['Stock', 'stock']].map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{lbl}</label>
                    <input type="number" value={editing[key]} onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => saveEdit(p.id)} disabled={saving}>Save</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    {p.category_name && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'rgba(176,96,255,0.12)', padding: '2px 7px', borderRadius: 10 }}>{p.category_name}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Sell: <span style={{ color: 'var(--cyan)' }}>Rs {p.selling_price}</span>
                    <span style={{ margin: '0 6px' }}>·</span>
                    Cost: <span style={{ color: 'var(--green)' }}>Rs {p.cost_price}</span>
                    <span style={{ margin: '0 6px' }}>·</span>
                    Stock: <span style={{ color: p.stock <= 2 ? 'var(--red)' : 'var(--amber)' }}>{p.stock}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 10px' }}
                    onClick={() => printLabel(p)} disabled={printing === p.id} title="Print label">
                    {printing === p.id ? '…' : '🖨'}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}
                    onClick={() => setEditing({ id: p.id, selling_price: p.selling_price, cost_price: p.cost_price, stock: p.stock, category_id: p.category_id || '' })}>
                    Edit
                  </button>
                  <button className="btn btn-sm" style={{ width: 'auto', padding: '6px 10px', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}
                    onClick={() => setConfirmDelete({ id: p.id, name: p.name })}>
                    Del
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OWNER PHONES TAB ─────────────────────────────────────────────────────────
function PhoneCard({ p, editing, setEditing, saving, savePrice, setConfirmDelete }) {
  const photos = (() => { try { return p.photos ? JSON.parse(p.photos) : []; } catch { return []; } })();
  return (
    <div className="card">
      {editing?.id === p.id ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>PHONE NAME / MODEL</label>
            <input type="text" value={editing.model} onChange={e => setEditing(ed => ({ ...ed, model: e.target.value }))} placeholder="e.g. iPhone 14 Pro Max 256GB" />
          </div>
          {[['Cost Price (Rs)', 'cost_price', 'number'], ['Selling Price (Rs)', 'selling_price', 'number']].map(([lbl, key, type]) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{lbl}</label>
              <input type={type} value={editing[key]} onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))} />
            </div>
          ))}
          {p.status === 'sold' && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>DISCOUNT GIVEN (Rs)</label>
              <input type="number" min="0" value={editing.sale_discount ?? 0}
                onChange={e => setEditing(ed => ({ ...ed, sale_discount: e.target.value }))} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>CONDITION</label>
            <select value={editing.condition} onChange={e => setEditing(ed => ({ ...ed, condition: e.target.value }))}>
              <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>NOTES</label>
            <input type="text" value={editing.notes} onChange={e => setEditing(ed => ({ ...ed, notes: e.target.value }))} placeholder="Optional notes..." />
          </div>
          {editing.cost_price && editing.selling_price && Number(editing.selling_price) > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 6, fontSize: 13 }}>
              Margin: <strong style={{ color: 'var(--green)' }}>Rs {(Number(editing.selling_price) - Number(editing.cost_price)).toFixed(0)}</strong>
              {Number(editing.cost_price) > 0 && (
                <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                  ({(((Number(editing.selling_price) - Number(editing.cost_price)) / Number(editing.cost_price)) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => savePrice(p.id)} disabled={saving}>
              {saving ? 'Saving…' : 'Save Prices'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {photos.length > 0 && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={photos[0]} alt="" style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border)', display: 'block' }} />
                  {photos.length > 1 && (
                    <span style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 4px', borderRadius: 4, lineHeight: 1.4 }}>
                      +{photos.length - 1}
                    </span>
                  )}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.model}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.condition}{p.color ? ` · ${p.color}` : ''}{p.notes ? ` · ${p.notes}` : ''}</div>
                {p.imei && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, letterSpacing: 0.5 }}>IMEI: {p.imei}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                onClick={() => setEditing({ id: p.id, model: p.model || '', cost_price: p.cost_price ?? 0, selling_price: p.selling_price ?? 0, condition: p.condition, notes: p.notes || '', sale_discount: Number(p.sale_discount || 0) })}>
                {Number(p.selling_price) ? 'Edit' : '+ Price'}
              </button>
              <button className="btn btn-sm" style={{ width: 'auto', padding: '5px 8px', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12 }}
                onClick={() => setConfirmDelete({ id: p.id, model: p.model })}>Del</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span>Cost: <strong style={{ color: 'var(--amber)' }}>Rs {Number(p.cost_price).toFixed(0)}</strong></span>
            {Number(p.selling_price) ? (
              <>
                <span>Sell: <strong style={{ color: 'var(--cyan)' }}>Rs {Number(p.selling_price).toFixed(0)}</strong></span>
                <span>Profit: <strong style={{ color: 'var(--green)' }}>Rs {(Number(p.selling_price) - Number(p.cost_price) - (p.status === 'sold' ? Number(p.sale_discount || 0) : 0)).toFixed(0)}</strong></span>
              </>
            ) : (
              <span style={{ color: 'var(--amber)' }}>⚠ Not priced yet</span>
            )}
          </div>
          {p.status === 'sold' && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12 }}>
              {p.sold_at && <span>Sold {fmtDate(p.sold_at)}</span>}
              {Number(p.sale_discount) > 0 && <span style={{ color: 'var(--amber)' }}>Discount: Rs {Number(p.sale_discount).toLocaleString()}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OwnerPhonesTab() {
  const [phones, setPhones] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [view, setView] = useState('available'); // 'available' | 'sold' | 'out'
  const [openMonths, setOpenMonths] = useState({});
  const [openYears, setOpenYears]   = useState({});
  function toggleMonth(k) { setOpenMonths(s => ({ ...s, [k]: !s[k] })); }
  function toggleYear(y)  { setOpenYears(s =>  ({ ...s, [y]:  !s[y]  })); }

  const [phonesLoading, setPhonesLoading] = useState(true);

  useEffect(() => { loadPhones(); }, []);
  function loadPhones() {
    setPhonesLoading(true);
    fetch('/api/phones').then(r => r.json()).then(d => { setPhones(d); setPhonesLoading(false); });
  }

  async function savePrice(id) {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/phones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:         editing.model?.trim(),
        cost_price:    parseFloat(editing.cost_price)    || 0,
        selling_price: parseFloat(editing.selling_price) || 0,
        condition:     editing.condition,
        notes:         editing.notes,
        discount:      parseFloat(editing.sale_discount) || 0,
      }),
    });
    setSaving(false);
    setPhones(prev => prev.map(p => p.id === id ? {
      ...p,
      model:         editing.model?.trim() || p.model,
      cost_price:    parseFloat(editing.cost_price)    || 0,
      selling_price: parseFloat(editing.selling_price) || 0,
      condition:     editing.condition,
      notes:         editing.notes,
      sale_discount: parseFloat(editing.sale_discount) || 0,
    } : p));
    setEditing(null);
  }

  async function deletePhone(id) {
    await fetch(`/api/phones/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    loadPhones();
  }

  const available    = phones.filter(p => p.status === 'available');
  const consignment  = phones.filter(p => p.status === 'consignment');
  const sold         = phones.filter(p => p.status === 'sold').sort((a, b) => new Date(b.sold_at || b.created_at) - new Date(a.sold_at || a.created_at));
  const needsPricing = available.filter(p => !Number(p.selling_price));
  const displayed    = view === 'out' ? consignment : view !== 'sold' ? available : null;

  const MNAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function soldKey(p) {
    const d = new Date((p.sold_at || p.created_at).replace(' ', 'T') + (p.sold_at?.includes('T') ? '' : 'Z'));
    const npt = new Date(d.getTime() + (5*60+45)*60*1000);
    return { y: npt.getUTCFullYear(), m: npt.getUTCMonth() };
  }
  const nowNpt  = new Date(Date.now() + (5*60+45)*60*1000);
  const curY    = nowNpt.getUTCFullYear();
  const curM    = nowNpt.getUTCMonth();

  const soldGroups = (() => {
    const map = {};
    sold.forEach(p => {
      const { y, m } = soldKey(p);
      const k = `${y}-${m}`;
      if (!map[k]) map[k] = { y, m, phones: [] };
      map[k].phones.push(p);
    });
    return Object.values(map).sort((a, b) => b.y !== a.y ? b.y - a.y : b.m - a.m);
  })();

  const thisMonthGroup  = soldGroups.find(g => g.y === curY && g.m === curM);
  const prevMonthGroups = soldGroups.filter(g => !(g.y === curY && g.m === curM));
  const prevYears = [...new Set(prevMonthGroups.filter(g => g.y < curY).map(g => g.y))].sort((a,b) => b-a);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Used Phones</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{available.length} available · {consignment.length > 0 ? `${consignment.length} out · ` : ''}{sold.length} sold</div>
      </div>

      {needsPricing.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.12)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--amber)' }}>
          ⚠ {needsPricing.length} phone{needsPricing.length !== 1 ? 's' : ''} need pricing before staff can sell
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['available', `Available (${available.length})`], ...(consignment.length > 0 ? [['out', `Out (${consignment.length})`]] : []), ['sold', `Sold (${sold.length})`]].map(([v, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            className={`btn btn-sm ${view === v ? 'btn-cyan' : 'btn-ghost'}`}
            style={{ flex: 1 }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 340 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete Phone?</div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
              Delete <strong style={{ color: 'var(--text)' }}>{confirmDelete.model}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, background: 'var(--red)', color: '#fff', border: 'none' }}
                onClick={() => deletePhone(confirmDelete.id)}>Delete</button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Available / Out list */}
      {view !== 'sold' && (
        <>
          {!phonesLoading && displayed.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              {view === 'available' ? 'No phones in stock' : 'No phones out on consignment'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map(p => <PhoneCard key={p.id} p={p} editing={editing} setEditing={setEditing} saving={saving} savePrice={savePrice} setConfirmDelete={setConfirmDelete} />)}
          </div>
        </>
      )}

      {/* Sold — grouped by month/year */}
      {view === 'sold' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!phonesLoading && sold.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No phones sold yet</div>
          )}

          {/* This month — always expanded */}
          {thisMonthGroup && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', letterSpacing: 1, padding: '6px 0 8px', textTransform: 'uppercase' }}>
                {MNAMES[curM]} {curY} · {thisMonthGroup.phones.length} sold
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {thisMonthGroup.phones.map(p => <PhoneCard key={p.id} p={p} editing={editing} setEditing={setEditing} saving={saving} savePrice={savePrice} setConfirmDelete={setConfirmDelete} />)}
              </div>
            </div>
          )}

          {/* Previous months in current year */}
          {prevMonthGroups.filter(g => g.y === curY).map(g => {
            const k = `${g.y}-${g.m}`;
            const open = openMonths[k];
            return (
              <div key={k}>
                <button onClick={() => toggleMonth(k)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text)' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{MNAMES[g.m]} {g.y}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{g.phones.length} sold &nbsp;{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {g.phones.map(p => <PhoneCard key={p.id} p={p} editing={editing} setEditing={setEditing} saving={saving} savePrice={savePrice} setConfirmDelete={setConfirmDelete} />)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Previous years */}
          {prevYears.map(y => {
            const yearGroups = prevMonthGroups.filter(g => g.y === y);
            const yearTotal  = yearGroups.reduce((s, g) => s + g.phones.length, 0);
            const yOpen = openYears[y];
            return (
              <div key={y}>
                <button onClick={() => toggleYear(y)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, cursor: 'pointer', color: 'var(--text)' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{y}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{yearTotal} sold &nbsp;{yOpen ? '▲' : '▼'}</span>
                </button>
                {yOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingLeft: 8 }}>
                    {yearGroups.map(g => {
                      const k = `${g.y}-${g.m}`;
                      const open = openMonths[k];
                      return (
                        <div key={k}>
                          <button onClick={() => toggleMonth(k)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text)' }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{MNAMES[g.m]} {g.y}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{g.phones.length} sold &nbsp;{open ? '▲' : '▼'}</span>
                          </button>
                          {open && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                              {g.phones.map(p => <PhoneCard key={p.id} p={p} editing={editing} setEditing={setEditing} saving={saving} savePrice={savePrice} setConfirmDelete={setConfirmDelete} />)}
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
      )}
    </div>
  );
}

// ─── COSTS TAB ────────────────────────────────────────────────────────────────
function CostsTab({ products }) {
  const [subTab, setSubTab] = useState('stock');

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Costs</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['stock','📦 Stock Costs'],['shops','🛍️ Shop Tabs']].map(([v, lbl]) => (
          <button key={v} onClick={() => setSubTab(v)}
            className={`btn btn-sm ${subTab === v ? 'btn-cyan' : 'btn-ghost'}`}
            style={{ flex: 1 }}>
            {lbl}
          </button>
        ))}
      </div>
      {subTab === 'stock'  && <StockCostsPanel />}
      {subTab === 'shops'  && <ShopTabsPanel />}
    </div>
  );
}

function StockCostsPanel() {
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stock').then(r => r.json()).then(d => { setEntries(d); setLoading(false); });
  }, []);

  function setEntryCost(id, val) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, _cost: val } : e));
  }

  async function saveCost(e) {
    const cost = parseFloat(e._cost ?? e.cost_price) || 0;
    setSaving(s => ({ ...s, [e.id]: true }));
    await fetch(`/api/stock/${e.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_price: cost }),
    });
    setSaving(s => ({ ...s, [e.id]: false }));
    fetch('/api/stock').then(r => r.json()).then(setEntries);
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>
        Set the cost price for each stock entry to calculate profit accurately.
      </p>
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No stock entries yet</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(e => (
          <div key={e.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.quantity} units · {fmtDate(e.created_at)}</div>
              </div>
              {e.cost_price ? (
                <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Rs {e.cost_price}</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>⚠ No cost set</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" placeholder="Cost per unit (Rs)"
                value={e._cost ?? e.cost_price ?? ''}
                onChange={ev => setEntryCost(e.id, ev.target.value)}
                style={{ flex: 1 }} />
              <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px', whiteSpace: 'nowrap' }}
                onClick={() => saveCost(e)} disabled={saving[e.id]}>
                {saving[e.id] ? '…' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopTabsPanel() {
  const [rows, setRows]       = useState([]);
  const [filter, setFilter]   = useState('pending');
  const [settling, setSettling] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    const r = await fetch(filter === 'all' ? '/api/shop-tabs?all=1' : '/api/shop-tabs');
    setRows(await r.json());
    setLoading(false);
  }

  async function settle(shopName) {
    setSettling(shopName);
    await fetch('/api/shop-tabs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName }),
    });
    setSettling('');
    load();
  }

  // Group by shop
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.shop_name]) grouped[r.shop_name] = [];
    grouped[r.shop_name].push(r);
  });
  const shops = Object.keys(grouped).sort();

  const pendingRows   = rows.filter(r => !r.settled);
  const totalWeOwe   = pendingRows.filter(r => r.direction !== 'out').reduce((s, r) => s + Number(r.unit_cost) * Number(r.quantity), 0);
  const totalTheyOwe = pendingRows.filter(r => r.direction === 'out').reduce((s, r) => s + Number(r.unit_cost) * Number(r.quantity), 0);
  const totalNet = totalTheyOwe - totalWeOwe;

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
        Purchases from nearby shops — track and settle weekly/monthly.
      </p>

      {filter === 'pending' && pendingRows.length > 0 && (
        <div className="card" style={{ marginBottom: 14, background: 'rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)' }}>Rs {totalWeOwe.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>We owe</div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>Rs {totalTheyOwe.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>They owe</div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: totalNet >= 0 ? 'var(--green)' : 'var(--amber)' }}>Rs {Math.abs(totalNet).toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Net {totalNet >= 0 ? '(+us)' : '(+them)'}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['pending','Pending'],['all','All History']].map(([v, lbl]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`btn btn-sm ${filter === v ? 'btn-amber' : 'btn-ghost'}`}
            style={{ flex: 1 }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>}

      {!loading && shops.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          {filter === 'pending' ? 'No pending shop tabs 🎉' : 'No shop purchase records yet'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {shops.map(shopName => {
          const items   = grouped[shopName];
          const pending = items.filter(i => !i.settled);
          const shopTotal = pending.reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);
          const isSettling = settling === shopName;

          return (
            <div key={shopName} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{shopName}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {items.length} item{items.length !== 1 ? 's' : ''}{pending.length > 0 ? ` · ${pending.length} pending` : ' · settled'}
                  </div>
                </div>
                {shopTotal > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>Rs {shopTotal.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>owed</div>
                  </div>
                )}
              </div>

              {(() => {
                const weOwe   = items.filter(i => i.direction !== 'out').reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);
                const theyOwe = items.filter(i => i.direction === 'out').reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);
                const net = theyOwe - weOwe;
                return (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,176,32,0.08)', borderRadius: 8, border: '1px solid rgba(255,176,32,0.2)' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>We owe them</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)' }}>Rs {weOwe.toLocaleString()}</div>
                      </div>
                      <div style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,230,118,0.08)', borderRadius: 8, border: '1px solid rgba(0,230,118,0.2)' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>They owe us</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>Rs {theyOwe.toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: net === 0 ? 'rgba(112,112,160,0.06)' : net > 0 ? 'rgba(0,230,118,0.06)' : 'rgba(255,176,32,0.06)', borderRadius: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Net</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, color: net === 0 ? 'var(--muted)' : net > 0 ? 'var(--green)' : 'var(--amber)' }}>
                          Rs {Math.abs(net).toLocaleString()}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>
                          {net === 0 ? 'even' : net > 0 ? 'they owe us' : 'we owe them'}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: item.settled ? 'rgba(112,112,160,0.05)' : item.direction === 'out' ? 'rgba(0,230,118,0.05)' : 'rgba(255,176,32,0.05)', borderRadius: 8, opacity: item.settled ? 0.55 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginRight: 6, background: item.direction === 'out' ? 'rgba(0,230,118,0.15)' : 'rgba(255,176,32,0.15)', color: item.direction === 'out' ? 'var(--green)' : 'var(--amber)' }}>
                        {item.direction === 'out' ? '↑ TO' : '↓ FROM'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{item.product_name}</span>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, paddingLeft: 2 }}>
                        {item.quantity} × Rs {Number(item.unit_cost).toLocaleString()} · {fmtDate(item.created_at, { day: 'numeric', month: 'short' })}
                        {item.settled && item.settled_at && <span style={{ color: 'var(--green)', marginLeft: 6 }}>✓ settled {fmtDate(item.settled_at, { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: item.settled ? 'var(--muted)' : item.direction === 'out' ? 'var(--green)' : 'var(--amber)', marginLeft: 10 }}>
                      Rs {(Number(item.unit_cost) * Number(item.quantity)).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {filter === 'pending' && items.some(i => !i.settled) && (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '6px 0' }}>
                  Settled by staff from the Stock → Shop Tab screen
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPAIRS TAB ──────────────────────────────────────────────────────────────
function RepairsTab() {
  const [repairs, setRepairs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRepairs(); }, []);
  function loadRepairs() {
    fetch('/api/repairs').then(r => r.json()).then(d => { setRepairs(d); setLoading(false); });
  }

  async function saveRepair(id) {
    setSaving(true);
    await fetch(`/api/repairs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    loadRepairs();
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Repairs</h2>

      {!loading && repairs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No repairs yet</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {repairs.map(r => (
          <div key={r.id} className="card">
            {editing?.id === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['Customer Name', 'customer_name', 'text'], ['Customer Phone', 'customer_phone', 'text'], ['Device Model', 'phone_model', 'text'], ['Issue', 'issue', 'text'], ['Customer Price (Rs)', 'customer_price', 'number'], ['Discount (Rs)', 'repair_discount', 'number'], ['Your Cost (Rs)', 'cost_price', 'number'], ['Notes', 'notes', 'text']].map(([lbl, key, type]) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{lbl}</label>
                    <input type={type} value={editing[key] ?? ''} onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>STATUS</label>
                  <select value={editing.status} onChange={e => setEditing(ed => ({ ...ed, status: e.target.value }))}>
                    <option>Pending</option><option>In Progress</option><option>Done</option><option>Delivered</option><option>Returned</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>PAYMENT METHOD</label>
                  <select value={editing.payment_method || 'Cash'} onChange={e => setEditing(ed => ({ ...ed, payment_method: e.target.value }))}>
                    {['Cash', 'eSewa', 'Bank Transfer', 'Fonepay', 'Credit'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => saveRepair(r.id)} disabled={saving}>Save</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.customer_name}</div>
                      {r.payment_method === 'Credit' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,176,32,0.15)', color: 'var(--amber)' }}>
                          CREDIT{r.credit_cleared ? ' ✓' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{r.phone_model}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ color: 'var(--text)', fontSize: 13, marginBottom: 10 }}>{r.issue}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
                  <span>Customer: <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {r.customer_price}</span></span>
                  <span>Your Cost: <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Rs {r.cost_price}</span></span>
                  <span>Profit: <span style={{ color: 'var(--green)', fontWeight: 700 }}>Rs {r.customer_price - r.cost_price}</span></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(r.created_at)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(r.status === 'Done' || r.status === 'Delivered') && toWhatsApp(r.customer_phone) && (
                      <a href={`https://wa.me/${toWhatsApp(r.customer_phone)}?text=${encodeURIComponent(`Hi ${r.customer_name}! 👋 Your ${r.phone_model} repair is ready for pickup at Univercell. Total: Rs ${Math.max(0, Number(r.customer_price) - Number(r.repair_discount||0)).toLocaleString()}. Thank you! 😊`)}`}
                        target="_blank" rel="noreferrer"
                        style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: '#25D366', color: '#fff', textDecoration: 'none' }}>
                        📱 Notify
                      </a>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }}
                      onClick={() => printRepairReceipt(r)}>
                      🖨️ Print
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}
                      onClick={() => setEditing({ id: r.id, customer_name: r.customer_name || '', customer_phone: r.customer_phone || '', phone_model: r.phone_model || '', issue: r.issue || '', customer_price: r.customer_price, repair_discount: r.repair_discount || 0, cost_price: r.cost_price, status: r.status, notes: r.notes || '', payment_method: r.payment_method || 'Cash' })}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SALES HISTORY TAB ───────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function SalesHistoryTab() {
  const [items, setItems]       = useState([]);
  const [filter, setFilter]     = useState('today');
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState({});
  const [delConfirm, setDelConfirm] = useState(null); // sale_id pending confirm
  const [deleting, setDeleting]     = useState({});   // sale_id → true while in-flight

  useEffect(() => { loadSales(); setExpanded({}); }, [filter]);

  async function loadSales() {
    setLoading(true);
    const r = await fetch(`/api/sales?filter=${filter}&expand=items`);
    const d = await r.json();
    setItems(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function deleteSale(saleId) {
    setDeleting(p => ({ ...p, [saleId]: true }));
    await fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
    setDeleting(p => ({ ...p, [saleId]: false }));
    setDelConfirm(null);
    loadSales();
  }

  function nptDate(iso) { return new Date(new Date(iso).getTime() + (5*60+45)*60000).toISOString().split('T')[0]; }
  function fmtDay(ds)   { return new Date(ds + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' }); }
  function fmtTime(iso) { return new Date(new Date(iso).getTime() + (5*60+45)*60000).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }); }
  function getMonday(ds) {
    const d = new Date(ds + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1));
    return d.toISOString().split('T')[0];
  }
  function fmtAmt(n) {
    const abs = Math.abs(n);
    if (abs >= 1000000) return `${(n/1000000).toFixed(1)}M`;
    if (abs >= 1000)    return `${(n/1000).toFixed(1)}k`;
    return n.toFixed(0);
  }
  function itemAmt(it) { return Math.max(0, Number(it.unit_price) * Number(it.quantity) - Number(it.item_discount)); }
  function payLabel(it) {
    try { const sp = it.split_payments ? JSON.parse(it.split_payments) : null; return sp?.length > 1 ? sp.map(p => p.method).join('+') : it.payment_method; }
    catch { return it.payment_method; }
  }

  const grouped = {};
  items.forEach(it => { const d = nptDate(it.created_at); if (!grouped[d]) grouped[d] = []; grouped[d].push(it); });
  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalRev  = items.reduce((s, it) => s + itemAmt(it), 0);
  const totalDisc = items.reduce((s, it) => s + Number(it.item_discount), 0);

  function toggleDay(day) { setExpanded(p => ({ ...p, [day]: !(p[day] !== false) })); }

  const weekGroups = {};
  days.forEach(day => {
    const wk = getMonday(day);
    if (!weekGroups[wk]) weekGroups[wk] = { days: [], total: 0, count: 0 };
    weekGroups[wk].days.push(day);
    weekGroups[wk].total += grouped[day].reduce((s, it) => s + itemAmt(it), 0);
    weekGroups[wk].count += grouped[day].length;
  });
  const weekKeys = Object.keys(weekGroups).sort((a, b) => b.localeCompare(a));

  const monthGroups = {};
  days.forEach(day => {
    const mo = day.slice(0, 7);
    if (!monthGroups[mo]) monthGroups[mo] = { days: [], total: 0, count: 0 };
    monthGroups[mo].days.push(day);
    monthGroups[mo].total += grouped[day].reduce((s, it) => s + itemAmt(it), 0);
    monthGroups[mo].count += grouped[day].length;
  });
  const monthKeys = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

  function renderDay(day, collapsible) {
    const dayItems = grouped[day];
    const dayTotal = dayItems.reduce((s, it) => s + itemAmt(it), 0);
    const open = expanded[day] !== false;
    return (
      <div key={day} style={{ marginBottom: 4 }}>
        <div onClick={() => collapsible && toggleDay(day)}
          style={{ padding:'10px 14px', background:'rgba(176,96,255,0.08)', borderRadius:10, border:'1px solid rgba(176,96,255,0.25)', marginBottom:(!collapsible||open)?4:0, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:collapsible?'pointer':'default', userSelect:'none' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:13 }}>{fmtDay(day)}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>{dayItems.length} item{dayItems.length!==1?'s':''} sold</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontWeight:800, fontSize:15, color:'var(--purple)' }}>Rs {fmtAmt(dayTotal)}</div>
            {collapsible && <span style={{ color:'var(--muted)', fontSize:11 }}>{open?'▲':'▼'}</span>}
          </div>
        </div>
        {(!collapsible||open) && dayItems.map(it => {
          const amt   = itemAmt(it);
          const gross = Number(it.unit_price) * Number(it.quantity);
          return (
            <div key={it.id} className="card" style={{ marginBottom:6, marginLeft:collapsible?4:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>
                      {it.product_name}{Number(it.quantity) > 1 ? ` ×${it.quantity}` : ''}
                    </span>
                    <span style={{ fontSize:11, padding:'2px 7px', borderRadius:10, background: it.item_type==='phone' ? 'rgba(0,212,255,0.1)' : 'rgba(176,96,255,0.1)', color: it.item_type==='phone' ? 'var(--cyan)' : 'var(--purple)', fontWeight:700 }}>
                      {it.item_type==='phone' ? '📱' : '🏷'}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span>{fmtTime(it.created_at)}</span>
                    <span>· {payLabel(it)}</span>
                    {it.customer_name && <span style={{color:'var(--amber)'}}>· {it.customer_name}</span>}
                    {it.credit_customer && it.payment_method==='Credit' && !it.credit_cleared && <span style={{color:'var(--red)'}}>· Credit</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                  <div style={{ fontWeight:800, color:'var(--purple)', fontSize:15 }}>Rs {fmtAmt(amt)}</div>
                  {Number(it.item_discount) > 0 && (
                    <div style={{ fontSize:11, color:'var(--red)' }}>-Rs {fmtAmt(Number(it.item_discount))}</div>
                  )}
                </div>
              </div>
              {delConfirm === it.sale_id ? (
                <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', flex:1 }}>Delete this transaction?</span>
                  <button onClick={() => deleteSale(it.sale_id)} disabled={deleting[it.sale_id]}
                    style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'var(--red)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                    {deleting[it.sale_id] ? '…' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setDelConfirm(null)}
                    style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
                  <button onClick={() => setDelConfirm(it.sale_id)}
                    style={{ padding:'3px 10px', borderRadius:8, border:'1px solid rgba(255,70,70,0.3)', background:'transparent', color:'var(--red)', fontSize:11, cursor:'pointer', opacity:0.7 }}>
                    Del
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function WeekHeader({ wk }) {
    const w = weekGroups[wk];
    return (
      <div style={{ padding:'8px 12px', background:'rgba(176,96,255,0.07)', borderRadius:8, border:'1px solid rgba(176,96,255,0.22)', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--purple)' }}>Week of {fmtDay(wk)}</div>
          <div style={{ fontSize:11, color:'var(--muted)' }}>{w.count} items · {w.days.length} days</div>
        </div>
        <div style={{ fontSize:14, fontWeight:800, color:'var(--purple)' }}>Rs {fmtAmt(w.total)}</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <h2 style={{ fontWeight:800, fontSize:18 }}>Sales History</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
        {[['today','Today'],['week','Week'],['month','Month'],['all','All']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            className="btn btn-sm"
            style={{ padding:'8px 4px', fontSize:12, background: filter===v ? 'var(--purple)' : 'transparent', color: filter===v ? '#fff' : 'var(--text)', border: `1.5px solid ${filter===v ? 'var(--purple)' : 'var(--border)'}` }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div className="stat-card"><div className="val" style={{color:'var(--purple)',fontSize:16}}>Rs {fmtAmt(totalRev)}</div><div className="lbl">Revenue</div></div>
        <div className="stat-card"><div className="val" style={{color:'var(--amber)',fontSize:16}}>{items.length}</div><div className="lbl">Items Sold</div></div>
        <div className="stat-card"><div className="val" style={{color:'var(--red)',fontSize:16}}>Rs {fmtAmt(totalDisc)}</div><div className="lbl">Discounts</div></div>
      </div>

      {loading && <div style={{ textAlign:'center', padding:20, color:'var(--muted)' }}>Loading…</div>}
      {!loading && items.length===0 && <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>No sales found</div>}

      {!loading && filter==='today' && days.map(day => renderDay(day, false))}

      {!loading && filter==='week' && weekKeys.map(wk => (
        <div key={wk}>
          {weekKeys.length > 1 && <WeekHeader wk={wk} />}
          {weekGroups[wk].days.map(day => renderDay(day, true))}
        </div>
      ))}

      {!loading && filter==='month' && weekKeys.map(wk => (
        <div key={wk} style={{ marginBottom:8 }}>
          <WeekHeader wk={wk} />
          {weekGroups[wk].days.map(day => renderDay(day, true))}
        </div>
      ))}

      {!loading && filter==='all' && monthKeys.map(month => {
        const [yr, mo] = month.split('-');
        const mg = monthGroups[month];
        return (
          <div key={month} style={{ marginBottom:8 }}>
            <div style={{ padding:'10px 14px', background:'rgba(176,96,255,0.1)', borderRadius:10, border:'1px solid rgba(176,96,255,0.35)', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:'var(--purple)' }}>{MONTHS[parseInt(mo)-1]} {yr}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>{mg.count} items · {mg.days.length} days</div>
              </div>
              <div style={{ fontWeight:800, fontSize:18, color:'var(--purple)' }}>Rs {fmtAmt(mg.total)}</div>
            </div>
            {mg.days.map(day => renderDay(day, true))}
          </div>
        );
      })}
    </div>
  );
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000)    return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

function AnalyticsTab() {
  const curYear = new Date().getFullYear().toString();
  const [data, setData]   = useState(null);
  const [year, setYear]   = useState(curYear);
  const [view, setView]   = useState('monthly');   // 'monthly' | 'yearly'
  const [cat, setCat]     = useState('all');        // 'all' | 'products' | 'phones' | 'repairs'

  useEffect(() => {
    setData(null);
    fetch(`/api/analytics?year=${year}`).then(r => r.json()).then(setData);
    const iv = setInterval(() => {
      fetch(`/api/analytics?year=${year}`).then(r => r.json()).then(setData);
    }, 30000);
    return () => clearInterval(iv);
  }, [year]);

  if (!data) return <LoadingState />;

  function buildMonthly() {
    return data.products.map((row, i) => {
      const ph = data.phones[i];
      const rp = data.repairs[i];
      if (cat === 'all') {
        const grossProfit = row.profit + ph.profit + rp.profit;
        const expenses = Number(data.expensesByMonth?.[i + 1] || 0);
        return { label: MONTH_NAMES[i], revenue: row.revenue + ph.revenue + rp.revenue, grossProfit, expenses, profit: grossProfit - expenses, count: row.count + ph.count + rp.count };
      }
      if (cat === 'products') return { label: MONTH_NAMES[i], ...row };
      if (cat === 'phones')   return { label: MONTH_NAMES[i], ...ph };
      return { label: MONTH_NAMES[i], revenue: rp.revenue, profit: rp.profit, count: rp.count };
    });
  }

  function buildYearly() {
    const allYears = [...new Set([
      ...data.yearly.products.map(r => r.year),
      ...data.yearly.phones.map(r   => r.year),
      ...data.yearly.repairs.map(r  => r.year),
    ])].sort((a, b) => b.localeCompare(a));

    return allYears.map(yr => {
      const p  = data.yearly.products.find(r => r.year === yr) || { revenue: 0, profit: 0, count: 0 };
      const ph = data.yearly.phones.find(r   => r.year === yr) || { revenue: 0, profit: 0, count: 0 };
      const rp = data.yearly.repairs.find(r  => r.year === yr) || { revenue: 0, profit: 0, count: 0 };
      if (cat === 'all') {
        const grossProfit = p.profit + ph.profit + rp.profit;
        const expenses = Number(data.yearly.expenses?.[yr] || 0);
        return { label: yr, revenue: p.revenue + ph.revenue + rp.revenue, grossProfit, expenses, profit: grossProfit - expenses, count: p.count + ph.count + rp.count };
      }
      if (cat === 'products') return { label: yr, ...p };
      if (cat === 'phones')   return { label: yr, ...ph };
      return { label: yr, revenue: rp.revenue, profit: rp.profit, count: rp.count };
    });
  }

  const rows  = view === 'monthly' ? buildMonthly() : buildYearly();
  const total = rows.reduce((acc, r) => ({
    revenue:     acc.revenue     + r.revenue,
    grossProfit: acc.grossProfit + (r.grossProfit || 0),
    expenses:    acc.expenses    + (r.expenses    || 0),
    profit:      acc.profit      + r.profit,
    count:       acc.count       + r.count,
  }), { revenue: 0, grossProfit: 0, expenses: 0, profit: 0, count: 0 });

  const countLabel = cat === 'repairs' ? 'Jobs' : 'Sales';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Analytics</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['sales','Sales'],['repairs','Repairs'],['expenses','Expenses']].map(([t,lbl]) => (
            <a key={t} href={`/api/export?type=${t}`} download
              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              ⬇ {lbl}
            </a>
          ))}
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['monthly', 'Monthly'], ['yearly', 'All Years']].map(([v, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            className={`btn btn-sm ${view === v ? 'btn-cyan' : 'btn-ghost'}`}
            style={{ flex: 1 }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Year selector — only for monthly view */}
      {view === 'monthly' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.years.map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`btn btn-sm ${year === y ? 'btn-purple' : 'btn-ghost'}`}
              style={{ width: 'auto', padding: '6px 16px' }}>
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[['all','All'],['products','Products'],['phones','Phones'],['repairs','Repairs']].map(([c, lbl]) => (
          <button key={c} onClick={() => setCat(c)}
            className={`btn btn-sm ${cat === c ? 'btn-amber' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 11 }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Summary totals */}
      {cat === 'all' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--cyan)', fontSize: 17 }}>Rs {fmt(total.revenue)}</div>
            <div className="lbl">Revenue</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--green)', fontSize: 17 }}>Rs {fmt(total.grossProfit)}</div>
            <div className="lbl">Gross Profit</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--red)', fontSize: 17 }}>Rs {fmt(total.expenses)}</div>
            <div className="lbl">Expenses</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--green)', fontSize: 17 }}>Rs {fmt(total.profit)}</div>
            <div className="lbl">Net Profit</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--cyan)', fontSize: 18 }}>Rs {fmt(total.revenue)}</div>
            <div className="lbl">Revenue</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--green)', fontSize: 18 }}>Rs {fmt(total.profit)}</div>
            <div className="lbl">Profit</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--amber)', fontSize: 18 }}>{total.count}</div>
            <div className="lbl">{countLabel}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>
                {view === 'monthly' ? 'MONTH' : 'YEAR'}
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>REVENUE</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{cat === 'all' ? 'NET' : 'PROFIT'}</th>
              <th style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>
                {cat === 'all' ? 'EXP' : countLabel.toUpperCase()}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isEmpty = row.revenue === 0 && (cat === 'all' ? row.grossProfit === 0 : row.count === 0);
              return (
                <tr key={row.label} style={{ borderBottom: '1px solid var(--border)', opacity: isEmpty ? 0.35 : 1 }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text)' }}>{row.label}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--cyan)', fontWeight: 600 }}>
                    {row.revenue > 0 ? `Rs ${fmt(row.revenue)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 600,
                    color: row.profit > 0 ? 'var(--green)' : row.profit < 0 ? 'var(--red)' : 'var(--muted)' }}>
                    {row.profit !== 0 ? `Rs ${fmt(row.profit)}` : '—'}
                    {cat === 'all' && row.grossProfit > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>g: {fmt(row.grossProfit)}</div>
                    )}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>
                    {cat === 'all'
                      ? (row.expenses > 0 ? <span style={{ color: 'var(--red)', fontSize: 11 }}>{fmt(row.expenses)}</span> : '—')
                      : (row.count > 0 ? row.count : '—')}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(6,182,212,0.08)', borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '11px 12px', fontWeight: 800, color: 'var(--text)', fontSize: 13 }}>TOTAL</td>
              <td style={{ padding: '11px 8px', textAlign: 'right', color: 'var(--cyan)', fontWeight: 800 }}>Rs {fmt(total.revenue)}</td>
              <td style={{ padding: '11px 8px', textAlign: 'right', color: 'var(--green)', fontWeight: 800 }}>
                Rs {fmt(total.profit)}
                {cat === 'all' && total.grossProfit > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>g: {fmt(total.grossProfit)}</div>
                )}
              </td>
              <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800 }}>
                {cat === 'all'
                  ? <span style={{ color: 'var(--red)' }}>{fmt(total.expenses)}</span>
                  : <span style={{ color: 'var(--amber)' }}>{total.count}</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {cat === 'repairs' && (
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
          * Revenue and profit shown only for Done/Delivered repairs. Count includes all statuses.
        </p>
      )}
      {cat === 'all' && (
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
          * NET = Gross Profit minus Expenses. EXP column shows total expenses for the period. "g:" shows gross before deduction.
        </p>
      )}
    </div>
  );
}

// ─── OWNER CREDITS TAB ───────────────────────────────────────────────────────
function OwnerCreditsTab() {
  const [credits, setCredits] = useState({ sales: [], repairs: [] });
  const [filter, setFilter]   = useState('pending'); // 'pending' | 'all'
  const [clearing, setClearing] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [discounting, setDiscounting] = useState(null);
  const [lineDiscounts, setLineDiscounts] = useState({});
  const [clearedMethod, setClearedMethod] = useState('Cash');

  useEffect(() => { loadCredits(); }, []);

  async function loadCredits() {
    setLoading(true);
    const r = await fetch('/api/credits?all=1');
    setCredits(await r.json());
    setLoading(false);
  }

  async function clearCredit(type, id, totalDiscount, method) {
    setClearing(`${type}-${id}`);
    await fetch('/api/credits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, discount: Number(totalDiscount) || 0, clearedPaymentMethod: method }),
    });
    setClearing(null);
    setDiscounting(null);
    setLineDiscounts({});
    setClearedMethod('Cash');
    loadCredits();
  }

  const allItems = [
    ...(credits.sales  || []).map(s => ({ ...s, _type: 'sale' })),
    ...(credits.repairs || []).map(r => ({ ...r, _type: 'repair' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const displayed = filter === 'pending' ? allItems.filter(i => !i.credit_cleared) : allItems;
  const pending   = allItems.filter(i => !i.credit_cleared);
  const totalPending = pending.reduce((s, i) => s + Number(i._type === 'sale' ? i.total_amount : i.customer_price), 0);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Credits</h2>

      {/* Summary */}
      <div className="card" style={{ marginBottom: 16, background: pending.length > 0 ? 'rgba(255,176,32,0.06)' : 'rgba(0,230,118,0.06)', borderColor: pending.length > 0 ? 'rgba(255,176,32,0.25)' : 'rgba(0,230,118,0.25)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>{pending.length}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Pending</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber)' }}>Rs {totalPending.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Outstanding</div>
          </div>
        </div>
      </div>

      {/* Filter toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['pending', 'Pending'], ['all', 'All History']].map(([v, lbl]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`btn btn-sm ${filter === v ? 'btn-amber' : 'btn-ghost'}`}
            style={{ flex: 1 }}>
            {lbl}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>
          {filter === 'pending' ? '✅ No pending credits!' : 'No credit records yet'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayed.map(item => {
          const key = `${item._type}-${item.id}`;
          const isClearing = clearing === key;
          const isDiscounting = discounting === key;
          const amount = Number(item._type === 'sale' ? item.total_amount : item.customer_price);
          const disc   = Number(item.credit_discount) || 0;
          const collected = amount - disc;
          const name   = item._type === 'sale' ? (item.credit_customer || 'Unknown') : item.customer_name;
          const typeLabel = item._type === 'repair' ? 'REPAIR' : 'SALE';
          const totalDisc = isDiscounting ? Object.values(lineDiscounts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;

          return (
            <div key={key} className="card" style={{ opacity: item.credit_cleared ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    background: item._type === 'repair' ? 'rgba(176,96,255,0.12)' : 'rgba(0,212,255,0.12)',
                    color: item._type === 'repair' ? 'var(--purple)' : 'var(--cyan)' }}>
                    {typeLabel}
                  </span>
                  {item.credit_cleared ? (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,230,118,0.12)', color: 'var(--green)' }}>PAID</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,176,32,0.12)', color: 'var(--amber)' }}>PENDING</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {fmtDate(item.created_at, { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{name}</div>
              {item._type === 'sale' && item.items_summary && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{item.items_summary}</div>
              )}
              {item._type === 'repair' && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  {item.phone_model} — {item.issue?.slice(0, 50)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {item.credit_cleared && disc > 0 ? (
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'line-through', marginRight: 8 }}>Rs {amount.toLocaleString()}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>Rs {collected.toLocaleString()}</span>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>disc Rs {disc.toLocaleString()}</div>
                  </div>
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 800, color: item.credit_cleared ? 'var(--green)' : 'var(--amber)' }}>
                    Rs {amount.toLocaleString()}
                  </span>
                )}
                {!item.credit_cleared && !isDiscounting && (
                  <button className="btn btn-green btn-sm" style={{ width: 'auto', padding: '7px 16px' }}
                    onClick={() => { setDiscounting(key); setLineDiscounts({}); setClearedMethod('Cash'); }}>
                    ✓ Mark Paid
                  </button>
                )}
                {item.credit_cleared && !isDiscounting && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    {item.credit_cleared_at && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Paid {fmtDate(item.credit_cleared_at, { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}
                      onClick={() => { setDiscounting(key); setLineDiscounts({}); setClearedMethod(item.cleared_payment_method || 'Cash'); }}>
                      ✏️ Edit
                    </button>
                  </div>
                )}
              </div>
              {isDiscounting && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {item._type === 'sale' && (item.items || []).map(si => {
                    const lineAmt = Number(si.unit_price) * Number(si.quantity) - (Number(si.item_discount) || 0);
                    return (
                      <div key={si.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{si.product_name} ×{si.quantity}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Rs {lineAmt.toLocaleString()}</div>
                        </div>
                        <input type="number" min="0" max={lineAmt} value={lineDiscounts[si.id] ?? ''}
                          onChange={e => setLineDiscounts(prev => ({ ...prev, [si.id]: e.target.value }))}
                          placeholder="0" style={{ width: 78 }} />
                      </div>
                    );
                  })}
                  {item._type === 'repair' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.phone_model}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Rs {amount.toLocaleString()}</div>
                      </div>
                      <input type="number" min="0" max={amount} value={lineDiscounts['repair'] ?? ''}
                        onChange={e => setLineDiscounts(prev => ({ ...prev, repair: e.target.value }))}
                        placeholder="0" style={{ width: 78 }} />
                    </div>
                  )}
                  {totalDisc > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textAlign: 'right' }}>
                      Disc Rs {totalDisc.toLocaleString()} → <strong style={{ color: 'var(--fg)' }}>Collect Rs {Math.max(0, amount - totalDisc).toLocaleString()}</strong>
                    </div>
                  )}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Paid via:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'].map(m => (
                        <button key={m} className={`btn btn-sm ${clearedMethod === m ? 'btn-cyan' : 'btn-ghost'}`}
                          style={{ flex: 1, minWidth: 60 }} onClick={() => setClearedMethod(m)}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-green btn-sm" style={{ flex: 1 }}
                      onClick={() => clearCredit(item._type, item.id, totalDisc, clearedMethod)} disabled={isClearing}>
                      {isClearing ? '…' : '✓ Confirm'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}
                      onClick={() => { setDiscounting(null); setLineDiscounts({}); setClearedMethod('Cash'); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CASH BALANCE TAB ────────────────────────────────────────────────────────
const CASH_METHODS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'];
const CASH_COLORS  = { Cash: 'var(--green)', eSewa: 'var(--cyan)', 'Bank Transfer': 'var(--purple)', Fonepay: 'var(--amber)' };

function CashTab() {
  const [date, setDate]                 = useState(nptToday());
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingForm, setOpeningForm]   = useState({ Cash: '', eSewa: '', 'Bank Transfer': '', Fonepay: '' });
  const [savingOpening, setSavingOpening] = useState(false);

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/cash-balance?date=${date}`);
    const d = await r.json();
    setData(d);
    const f = {};
    CASH_METHODS.forEach(m => { f[m] = d.methods[m]?.opening ?? 0; });
    setOpeningForm(f);
    setLoading(false);
  }

  function navigateDate(delta) {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().split('T')[0];
    if (next <= nptToday()) setDate(next);
  }

  function fmtDay(dateStr) {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function fmtShort(dateStr) {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  async function saveOpening() {
    setSavingOpening(true);
    for (const m of CASH_METHODS) {
      const amt = Number(openingForm[m]) || 0;
      if (amt <= 0) continue;
      await fetch('/api/cash-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, payment_method: m, amount: amt }),
      });
    }
    setSavingOpening(false);
    setEditingOpening(false);
    load();
  }

  const isToday = date === nptToday();
  const totalBalance = data ? CASH_METHODS.reduce((s, m) => s + (data.methods[m]?.balance || 0), 0) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Cash Balance</h2>
      </div>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => navigateDate(-1)}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtDay(date)}</span>
          {isToday && <span style={{ fontSize: 11, color: 'var(--cyan)', marginLeft: 8 }}>TODAY</span>}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => navigateDate(1)} disabled={isToday}>→</button>
      </div>

      {/* Set opening balance */}
      <div style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: 12 }}
          onClick={() => setEditingOpening(p => !p)}>
          {editingOpening ? '✕ Cancel' : '⚙ Set Opening Balances'}
        </button>
        {editingOpening && (
          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Opening cash for {fmtDay(date)}</div>
            {CASH_METHODS.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, minWidth: 110, color: CASH_COLORS[m] }}>{m}</label>
                <input type="number" value={openingForm[m]}
                  onChange={e => setOpeningForm(f => ({ ...f, [m]: e.target.value }))}
                  placeholder="0" style={{ flex: 1 }} />
              </div>
            ))}
            <button className="btn btn-green" onClick={saveOpening} disabled={savingOpening}>
              {savingOpening ? 'Saving…' : 'Save Opening Balances'}
            </button>
          </div>
        )}
      </div>

      {loading && <LoadingState />}

      {!loading && data && (
        <>
          {/* Per-method cards */}
          {CASH_METHODS.map(m => {
            const md = data.methods[m];
            const hasActivity = md.inflows > 0 || md.opening > 0 || md.outflows > 0;
            const color = CASH_COLORS[m];
            return (
              <div key={m} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${color}`, opacity: hasActivity ? 1 : 0.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color }}>{m}</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: md.balance < 0 ? 'var(--red)' : color }}>
                    Rs {md.balance.toLocaleString()}
                  </span>
                </div>
                {hasActivity && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    {md.opening > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Opening</span>
                        <span>Rs {md.opening.toLocaleString()}</span>
                      </div>
                    )}
                    {md.inflows > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>+ Inflows</span>
                        <span style={{ color: 'var(--green)' }}>+Rs {md.inflows.toLocaleString()}</span>
                      </div>
                    )}
                    {md.outflows > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>− Outflows</span>
                        <span style={{ color: 'var(--red)' }}>-Rs {md.outflows.toLocaleString()}</span>
                      </div>
                    )}
                    {md.adjustment !== 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Adjustment</span>
                        <span style={{ color: md.adjustment > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {md.adjustment > 0 ? '+' : ''}Rs {md.adjustment.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>Balance</span>
                      <span style={{ fontWeight: 800, color: md.balance < 0 ? 'var(--red)' : color }}>
                        Rs {md.balance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className="card" style={{ marginBottom: 16, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Total (All Methods)</span>
              <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--cyan)' }}>
                Rs {totalBalance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* History */}
          {data.history?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>HISTORY — LAST 30 DAYS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.history.map(row => {
                  const salesIn  = Number(row.sales) + Number(row.repair_sales);
                  const totalOut = Number(row.expenses) + Number(row.supplier_payments);
                  const net      = salesIn - totalOut;
                  const isSelected = row.date === date;
                  return (
                    <div key={row.date} onClick={() => setDate(row.date)} className="card"
                      style={{ cursor: 'pointer', borderLeft: isSelected ? '3px solid var(--cyan)' : '3px solid transparent', padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--cyan)' : 'var(--text)' }}>{fmtShort(row.date)}</span>
                        <span style={{ fontWeight: 800, fontSize: 15, color: net >= 0 ? 'var(--cyan)' : 'var(--red)' }}>
                          {net >= 0 ? '+' : ''}Rs {net.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                        {salesIn > 0 && <span style={{ color: 'var(--green)' }}>↑ Rs {salesIn.toLocaleString()}</span>}
                        {Number(row.expenses) > 0 && <span style={{ color: 'var(--red)' }}>Exp Rs {Number(row.expenses).toLocaleString()}</span>}
                        {Number(row.supplier_payments) > 0 && <span style={{ color: 'var(--amber)' }}>Supp Rs {Number(row.supplier_payments).toLocaleString()}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
                Tap any card to view that day's breakdown. Supplier = settled shop tab debts.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── OWNER EXPENSES TAB ──────────────────────────────────────────────────────
function OwnerExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod]     = useState('month'); // 'today' | 'month' | 'all'
  const [type, setType]         = useState('all');   // 'all' | 'staff' | 'owner'
  const [form, setForm]         = useState({ description: '', amount: '', payment_method: 'Cash', category: 'expense' });
  const [saving, setSaving]     = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { load(); }, [period, type]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (period !== 'all') params.set('period', period);
    if (type !== 'all')   params.set('type', type);
    const r = await fetch(`/api/expenses?${params}`);
    setExpenses(await r.json());
    setLoading(false);
  }

  async function addExpense() {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: form.description.trim(), amount: Number(form.amount), payment_method: form.payment_method, category: form.category }),
    });
    setSaving(false);
    setForm({ description: '', amount: '', payment_method: 'Cash', category: 'expense' });
    setShowAdd(false);
    load();
  }

  async function deleteExpense(id) {
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    setDelConfirm(null);
    load();
  }

  const total      = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const staffTotal = expenses.filter(e => e.entered_by === 'staff').reduce((s, e) => s + Number(e.amount), 0);
  const ownerTotal = expenses.filter(e => e.entered_by === 'owner').reduce((s, e) => s + Number(e.amount), 0);

  const SUGGESTIONS = ['Rent', 'Salary', 'Utilities', 'Cleaning', 'Staff Lunch', 'Tea/Snacks', 'Transport', 'Maintenance', 'Equipment', 'Printing', 'Stationary', 'Marketing', 'Other'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Expenses</h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setShowAdd(p => !p)}>
          {showAdd ? '✕ Cancel' : '+ Add'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 14 }}>
          <datalist id="exp-owner-sugg">
            {SUGGESTIONS.map(s => <option key={s} value={s} />)}
          </datalist>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>CATEGORY</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { val: 'expense',      label: 'Operating Expense',        desc: 'Shows in dashboard & analytics', color: 'var(--red)' },
                { val: 'cogs',         label: 'Cost of Goods Sold',       desc: 'Deducted from cash only',        color: 'var(--amber)' },
                { val: 'service_cost', label: 'Cost of Outsourcing',      desc: 'Deducted from cash only',        color: 'var(--purple)' },
              ].map(({ val, label, desc, color }) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${form.category === val ? color : 'var(--border)'}`, background: form.category === val ? `${color}11` : 'transparent', cursor: 'pointer' }}>
                  <input type="radio" name="owner-cat" value={val} checked={form.category === val} onChange={() => setForm(f => ({ ...f, category: val }))} style={{ accentColor: color }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.category === val ? color : 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>DESCRIPTION</label>
            <input list="exp-owner-sugg" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Rent, Salary…" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>AMOUNT (RS)</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0"
              onKeyDown={e => e.key === 'Enter' && addExpense()} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>PAID FROM</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={{ fontWeight: 700 }}>
              {CASH_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button className="btn btn-green" onClick={addExpense}
            disabled={saving || !form.description.trim() || !form.amount}>
            {saving ? 'Saving…' : 'Add Expense'}
          </button>
        </div>
      )}

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[['today','Today'],['month','This Month'],['all','All Time']].map(([v, lbl]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`btn btn-sm ${period === v ? 'btn-cyan' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 11 }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['all','All'],['staff','Staff'],['owner','Owner']].map(([v, lbl]) => (
          <button key={v} onClick={() => setType(v)}
            className={`btn btn-sm ${type === v ? 'btn-amber' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 11 }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Summary */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--red)', fontSize: 16 }}>Rs {total.toLocaleString()}</div>
            <div className="lbl">Total</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--cyan)', fontSize: 16 }}>Rs {staffTotal.toLocaleString()}</div>
            <div className="lbl">Staff</div>
          </div>
          <div className="stat-card">
            <div className="val" style={{ color: 'var(--purple)', fontSize: 16 }}>Rs {ownerTotal.toLocaleString()}</div>
            <div className="lbl">Owner</div>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>}

      {!loading && expenses.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No expenses for this period</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {expenses.map(e => (
          <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{e.description}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                  background: e.entered_by === 'owner' ? 'rgba(176,96,255,0.12)' : 'rgba(0,212,255,0.12)',
                  color: e.entered_by === 'owner' ? 'var(--purple)' : 'var(--cyan)' }}>
                  {e.entered_by?.toUpperCase()}
                </span>
                {(() => { const pm = e.payment_method || 'Cash'; const c = CASH_COLORS[pm] || 'var(--muted)'; return (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${c}22`, color: c }}>
                    {pm === 'Bank Transfer' ? 'Bank' : pm}
                  </span>
                ); })()}
                {(() => {
                  const cat = e.category || 'expense';
                  if (cat === 'cogs') return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,176,32,0.12)', color: 'var(--amber)' }}>COGS</span>;
                  if (cat === 'service_cost') return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(176,96,255,0.12)', color: 'var(--purple)' }}>OUTSOURCING</span>;
                  return null;
                })()}
                {e.expense_date}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--red)' }}>Rs {Number(e.amount).toLocaleString()}</span>
              {delConfirm === e.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm" style={{ padding: '4px 10px', background: 'var(--red)', color: '#fff', border: 'none', fontSize: 12 }}
                    onClick={() => deleteExpense(e.id)}>Del</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => setDelConfirm(null)}>×</button>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1 }}
                  onClick={() => setDelConfirm(e.id)}>×</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function StatCard({ val, lbl, color }) {
  return (
    <div className="stat-card">
      <div className="val" style={{ color }}>{val}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>{children}</div>;
}

function StatusBadge({ status }) {
  const map = { 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Done': 'badge-done', 'Delivered': 'badge-delivered', 'Returned': 'badge-returned' };
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status}</span>;
}

function LoadingState() {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>;
}

// Format a phone number to international WhatsApp format (Nepal 977 prefix)
function toWhatsApp(phone) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('977')) return clean;
  if (clean.length === 10 && clean.startsWith('9')) return '977' + clean;
  if (clean.startsWith('0') && clean.length === 11) return '977' + clean.slice(1);
  return clean || null;
}

// Open a print window with a formatted repair receipt
function printRepairReceipt(r) {
  const charge = Number(r.customer_price) || 0;
  const disc   = Number(r.repair_discount) || 0;
  const final  = Math.max(0, charge - disc);
  const date   = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Repair Receipt</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:monospace;font-size:13px;max-width:300px;margin:0 auto;padding:16px}
    h2{text-align:center;font-size:16px;margin-bottom:2px}
    .center{text-align:center;color:#555;font-size:11px;margin-bottom:8px}
    .dash{border-top:1px dashed #000;margin:8px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:4px}
    .bold{font-weight:bold}
    .total{font-size:15px;font-weight:bold;margin-top:4px}
  </style></head><body>
  <h2>Univercell</h2>
  <p class="center">Mobile Accessories &amp; Repair</p>
  <div class="dash"></div>
  <div class="row"><span>Customer</span><span class="bold">${r.customer_name || ''}</span></div>
  ${r.customer_phone ? `<div class="row"><span>Phone</span><span>${r.customer_phone}</span></div>` : ''}
  <div class="row"><span>Device</span><span>${r.phone_model || '—'}</span></div>
  <div class="row"><span>Issue</span><span style="max-width:160px;text-align:right">${r.issue || '—'}</span></div>
  <div class="row"><span>Date</span><span>${date}</span></div>
  <div class="dash"></div>
  ${disc > 0 ? `<div class="row"><span>Charge</span><span>Rs ${charge.toLocaleString()}</span></div><div class="row"><span>Discount</span><span>- Rs ${disc.toLocaleString()}</span></div>` : ''}
  <div class="row total"><span>Total</span><span>Rs ${final.toLocaleString()}</span></div>
  <div class="row"><span>Payment</span><span>${r.payment_method || 'Cash'}</span></div>
  ${r.notes ? `<div class="dash"></div><div><span class="bold">Notes: </span>${r.notes}</div>` : ''}
  <div class="dash"></div>
  <p style="text-align:center;font-size:11px;margin-top:4px">Thank you for choosing Univercell!</p>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;
  const w = window.open('', '_blank', 'width=400,height=620');
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── NOTES TAB ───────────────────────────────────────────────────────────────
function NotesTab({ isOwner }) {
  const [items, setItems]         = useState([]);
  const [filter, setFilter]       = useState('out');
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [resolving, setResolving] = useState({});
  const [soldOpen, setSoldOpen]   = useState({});
  const [soldAmt, setSoldAmt]     = useState({});
  const [phones, setPhones]       = useState([]);
  const [products, setProducts]   = useState([]);
  const [form, setForm]           = useState({
    person_name: '', person_phone: '',
    item_type: 'phone', phone_id: '', product_id: '', custom_item: '', notes: ''
  });

  useEffect(() => {
    fetch('/api/phones').then(r=>r.json()).then(d => setPhones((d||[]).filter(p=>p.status==='available')));
    fetch('/api/products').then(r=>r.json()).then(setProducts);
    load();
  }, []);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/consignments?status=${filter}`);
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }

  function derivedItemName() {
    if (form.item_type === 'phone') {
      const p = phones.find(p => String(p.id) === String(form.phone_id));
      return p ? `${p.model} (${p.condition})` : '';
    }
    if (form.item_type === 'accessory') {
      const p = products.find(p => String(p.id) === String(form.product_id));
      return p ? p.name : '';
    }
    return form.custom_item;
  }

  function derivedPrice() {
    if (form.item_type === 'phone') {
      const p = phones.find(p => String(p.id) === String(form.phone_id));
      return p ? Number(p.selling_price) : 0;
    }
    if (form.item_type === 'accessory') {
      const p = products.find(p => String(p.id) === String(form.product_id));
      return p ? Number(p.selling_price) : 0;
    }
    return 0;
  }

  async function submit(e) {
    e.preventDefault();
    const item_name = derivedItemName();
    if (!form.person_name.trim() || !item_name.trim()) return;
    setSaving(true);
    const r = await fetch('/api/consignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_name: form.person_name.trim(), person_phone: form.person_phone.trim(), item_name, unit_price: derivedPrice(), notes: form.notes.trim(), phone_id: form.item_type === 'phone' ? Number(form.phone_id) || null : null, product_id: form.item_type === 'accessory' ? Number(form.product_id) || null : null, quantity: 1 }),
    });
    setSaving(false);
    if (!r.ok) return;
    load();
    setForm({ person_name: '', person_phone: '', item_type: 'phone', phone_id: '', product_id: '', custom_item: '', notes: '' });
    if (filter === 'out' || filter === 'all') load();
  }

  async function markSold(id) {
    setResolving(p => ({ ...p, [id]: true }));
    await fetch(`/api/consignments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sold', amount_received: Number(soldAmt[id]) || 0 }),
    });
    setResolving(p => ({ ...p, [id]: false }));
    setSoldOpen(p => ({ ...p, [id]: false }));
    load();
  }

  async function markReturned(id) {
    setResolving(p => ({ ...p, [id]: true }));
    await fetch(`/api/consignments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'returned', amount_received: 0 }),
    });
    setResolving(p => ({ ...p, [id]: false }));
    load();
  }

  async function del(id) {
    await fetch(`/api/consignments/${id}`, { method: 'DELETE' });
    load();
  }

  function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }

  const pendingCount = items.filter(i => i.status === 'out').length;
  const soldTotal    = items.filter(i => i.status==='sold').reduce((s,i) => s + Number(i.amount_received), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 18 }}>Notes</h2>

      {isOwner && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="stat-card"><div className="val" style={{color:'var(--amber)'}}>{pendingCount}</div><div className="lbl">Pending Out</div></div>
          <div className="stat-card"><div className="val" style={{color:'var(--green)', fontSize:14}}>Rs {soldTotal.toLocaleString()}</div><div className="lbl">Received</div></div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Record Item Given Out</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="Person name *" value={form.person_name} onChange={e => setForm(p => ({ ...p, person_name: e.target.value }))} />
            <input placeholder="Phone number" value={form.person_phone} onChange={e => setForm(p => ({ ...p, person_phone: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[['phone','📱 Phone'],['accessory','🏷 Item'],['custom','✏ Custom']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setForm(p => ({ ...p, item_type: v, phone_id: '', product_id: '', custom_item: '' }))}
                className="btn btn-sm"
                style={{ padding: '8px 4px', fontSize: 12, background: form.item_type===v ? 'var(--purple)' : 'transparent', color: form.item_type===v ? '#fff' : 'var(--text)', border: `1.5px solid ${form.item_type===v ? 'var(--purple)' : 'var(--border)'}` }}>
                {l}
              </button>
            ))}
          </div>

          {form.item_type === 'phone' && (
            <select value={form.phone_id} onChange={e => setForm(p => ({ ...p, phone_id: e.target.value }))} style={{ background: 'var(--card)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: '100%' }}>
              <option value="">Select phone…</option>
              {phones.map(p => <option key={p.id} value={p.id}>{p.model} — {p.condition} — Rs {Number(p.selling_price).toLocaleString()}</option>)}
            </select>
          )}

          {form.item_type === 'accessory' && (
            <select value={form.product_id} onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))} style={{ background: 'var(--card)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: '100%' }}>
              <option value="">Select item…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — Rs {p.selling_price}</option>)}
            </select>
          )}

          {form.item_type === 'custom' && (
            <input placeholder="Item name *" value={form.custom_item} onChange={e => setForm(p => ({ ...p, custom_item: e.target.value }))} />
          )}

          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <button type="submit" className="btn btn-sm" style={{ fontWeight: 700, background: 'var(--purple)', color: '#fff', border: 'none' }} disabled={saving}>{saving ? '…' : 'Give Out'}</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        {[['out','Pending'],['sold','Sold'],['returned','Returned'],['all','All']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} className="btn btn-sm"
            style={{ padding: '8px 4px', fontSize: 12, background: filter===v ? 'var(--purple)' : 'transparent', color: filter===v ? '#fff' : 'var(--text)', border: `1.5px solid ${filter===v ? 'var(--purple)' : 'var(--border)'}` }}>
            {l}{v==='out' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>Loading…</div>}
      {!loading && items.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Nothing here</div>}

      {!loading && items.map(item => (
        <div key={item.id} className="card" style={{ border: item.status==='out' ? '1.5px solid rgba(255,176,32,0.4)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{item.person_name}</div>
              {item.person_phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.person_phone}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: item.status==='out' ? 'rgba(255,176,32,0.2)' : item.status==='sold' ? 'rgba(0,230,118,0.15)' : 'rgba(112,112,160,0.15)',
                color: item.status==='out' ? 'var(--amber)' : item.status==='sold' ? 'var(--green)' : 'var(--muted)' }}>
                {item.status==='out' ? 'PENDING' : item.status==='sold' ? 'SOLD' : 'RETURNED'}
              </span>
              {isOwner && <button onClick={() => del(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>✕</button>}
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.item_name}</div>
          {item.unit_price > 0 && <div style={{ fontSize: 13, color: 'var(--purple)' }}>Rs {Number(item.unit_price).toLocaleString()}</div>}
          {item.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{item.notes}</div>}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {fmtDate(item.given_at)}{item.given_by_name ? ` · ${item.given_by_name}` : ''}
            {item.resolved_at && ` · Closed ${fmtDate(item.resolved_at)}`}
          </div>
          {item.status==='sold' && Number(item.amount_received) > 0 && (
            <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 4, fontWeight: 700 }}>Received: Rs {Number(item.amount_received).toLocaleString()}</div>
          )}

          {item.status === 'out' && (
            <div style={{ marginTop: 12 }}>
              {soldOpen[item.id] ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" placeholder={`Amount (Rs ${Number(item.unit_price).toLocaleString()})`}
                    value={soldAmt[item.id] || ''} onChange={e => setSoldAmt(p => ({ ...p, [item.id]: e.target.value }))}
                    style={{ flex: 1 }} autoFocus />
                  <button onClick={() => markSold(item.id)} className="btn btn-green btn-sm" style={{ whiteSpace: 'nowrap', padding: '10px 16px' }} disabled={resolving[item.id]}>
                    {resolving[item.id] ? '…' : '✓ Confirm'}
                  </button>
                  <button onClick={() => setSoldOpen(p => ({ ...p, [item.id]: false }))} className="btn btn-ghost btn-sm" style={{ padding: '10px 12px' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                  <button onClick={() => setSoldOpen(p => ({ ...p, [item.id]: true }))}
                    style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--green)', color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: 0.3 }}
                    disabled={resolving[item.id]}>
                    ✓ SOLD
                  </button>
                  <button onClick={() => markReturned(item.id)}
                    style={{ padding: '13px 0', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                    disabled={resolving[item.id]}>
                    ↩ Back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Loyalty Owner Tab ────────────────────────────────────────────────────────
function LoyaltyOwnerTab() {
  const [enabled, setEnabled]       = useState(null);
  const [customers, setCustomers]   = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [expanded, setExpanded]     = useState(null);
  const [adjusting, setAdjusting]   = useState({});
  const [adjAmt, setAdjAmt]         = useState({});
  const [saving, setSaving]         = useState(false);
  const [tierFilter, setTierFilter] = useState('all');
  const [issuing, setIssuing]       = useState(false);
  const [issueForm, setIssueForm]   = useState({ name: '', phone: '', notes: '' });
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issuedCard, setIssuedCard] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch('/api/settings?key=loyalty_enabled').then(r => r.json()).then(d => setEnabled(d.value === '1')).catch(() => setEnabled(false));
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    const r = await fetch('/api/customers');
    if (r.ok) setCustomers(await r.json());
    setLoading(false);
  }

  async function searchCustomers() {
    setLoading(true);
    const r = await fetch(`/api/customers?q=${encodeURIComponent(search)}`);
    if (r.ok) setCustomers(await r.json());
    setLoading(false);
  }

  async function toggleEnabled() {
    const next = !enabled;
    setSaving(true);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'loyalty_enabled', value: next ? '1' : '0' }) });
    setEnabled(next);
    setSaving(false);
  }

  async function applyAdjust(id) {
    const adj = Number(adjAmt[id] || 0);
    if (!adj) return;
    await fetch(`/api/customers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points_adjust: adj }) });
    setAdjusting(p => ({ ...p, [id]: false }));
    setAdjAmt(p => ({ ...p, [id]: '' }));
    loadCustomers();
  }

  async function setTierOverride(id, tier) {
    await fetch(`/api/customers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
    loadCustomers();
  }

  async function issueCard(e) {
    e.preventDefault();
    setIssueSaving(true);
    setIssueError('');
    const r = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issueForm),
    });
    setIssueSaving(false);
    if (r.ok) {
      const c = await r.json();
      setIssuedCard(c);
      setIssueForm({ name: '', phone: '', notes: '' });
      setIssuing(false);
      loadCustomers();
    } else {
      const d = await r.json();
      setIssueError(d.error || 'Failed to issue card');
    }
  }

  function tierBg(t) {
    return t === 'Platinum' ? 'linear-gradient(135deg,#334155,#93C5FD)' : t === 'Gold' ? 'linear-gradient(135deg,#92400E,#FCD34D)' : 'linear-gradient(135deg,#475569,#CBD5E1)';
  }

  function isNearUpgrade(c) {
    if (c.tier === 'Silver') return Number(c.phone_purchase_count || 0) >= 2 || Number(c.non_phone_spent || 0) >= 6000;
    if (c.tier === 'Gold')   return Number(c.phone_purchase_count || 0) >= 5 || Number(c.non_phone_spent || 0) >= 16000;
    return false;
  }

  const tierCounts = { Silver: 0, Gold: 0, Platinum: 0 };
  customers.forEach(c => { if (tierCounts[c.tier] !== undefined) tierCounts[c.tier]++; });
  const nearCount = customers.filter(isNearUpgrade).length;

  const displayed = customers.filter(c => {
    if (tierFilter === 'near') return isNearUpgrade(c);
    if (tierFilter === 'all')  return true;
    return c.tier === tierFilter;
  });

  const fmtIssuedAt = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const historyList = [...customers].sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>Loyalty Program</h2>
        <a href="/loyalty-cards" target="_blank" style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none', fontWeight: 700 }}>🖨 Print Cards ↗</a>
      </div>

      {/* Issue New Card */}
      {!issuing ? (
        <button onClick={() => { setIssuing(true); setIssuedCard(null); setIssueError(''); }}
          style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1.5px dashed rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.06)', color: 'var(--cyan)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Issue New Loyalty Card
        </button>
      ) : (
        <form onSubmit={issueCard} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Issue New Card</div>
            <button type="button" onClick={() => { setIssuing(false); setIssueError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: 0 }}>✕</button>
          </div>
          <input required placeholder="Customer name *" value={issueForm.name}
            onChange={e => setIssueForm(p => ({ ...p, name: e.target.value }))} />
          <input required placeholder="Phone number *" value={issueForm.phone}
            onChange={e => setIssueForm(p => ({ ...p, phone: e.target.value }))} />
          <input placeholder="Notes (optional)" value={issueForm.notes}
            onChange={e => setIssueForm(p => ({ ...p, notes: e.target.value }))} />
          {issueError && <div style={{ color: 'var(--red)', fontSize: 13 }}>⚠ {issueError}</div>}
          <button type="submit" disabled={issueSaving}
            style={{ padding: '12px', borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            {issueSaving ? 'Issuing…' : 'Issue Card'}
          </button>
        </form>
      )}

      {/* Newly issued card confirmation */}
      {issuedCard && (
        <div className="card" style={{ border: '1.5px solid rgba(0,230,118,0.35)', background: 'rgba(0,230,118,0.06)' }}>
          <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>✓ Card Issued Successfully</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--cyan)', letterSpacing: '0.08em', marginBottom: 4 }}>{issuedCard.card_number}</div>
          <div style={{ fontSize: 14 }}>{issuedCard.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{issuedCard.phone} · Silver tier · 0 pts</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Hand the printed card to the customer and write the card number on it.</div>
        </div>
      )}

      {/* Issuance History */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button onClick={() => setShowHistory(p => !p)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 14px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>📋 Issuance History</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{historyList.length} cards</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{showHistory ? '▲' : '▼'}</span>
          </span>
        </button>
        {showHistory && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {historyList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No cards issued yet.</div>
            ) : (
              historyList.map((c, i) => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '11px 14px', borderBottom: i < historyList.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--cyan)', letterSpacing: '0.06em' }}>{c.card_number}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.phone}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      Issued by <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{c.issued_by || '—'}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtIssuedAt(c.joined_at)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.tier === 'Platinum' ? '#93C5FD' : c.tier === 'Gold' ? '#FCD34D' : 'var(--muted)', marginTop: 2 }}>{c.tier}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Enable / Disable toggle */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Loyalty System</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {enabled ? 'Active — loyalty section shows in staff checkout' : 'Disabled — hidden from staff checkout'}
          </div>
        </div>
        <button onClick={toggleEnabled} disabled={saving || enabled === null}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            background: enabled ? 'var(--green)' : 'rgba(255,255,255,0.08)', color: enabled ? '#000' : 'var(--muted)' }}>
          {enabled ? '● ON' : '○ OFF'}
        </button>
      </div>

      {/* Tier summary — clickable to filter */}
      {customers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {['Silver','Gold','Platinum'].map(t => (
            <div key={t} className="card" style={{ textAlign: 'center', padding: '8px 6px', cursor: 'pointer',
              border: tierFilter === t ? '1.5px solid rgba(0,212,255,0.35)' : '1px solid var(--border)' }}
              onClick={() => setTierFilter(p => p === t ? 'all' : t)}>
              <div style={{ fontSize: 10, fontWeight: 800, background: tierBg(t), WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 3 }}>{t.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{tierCounts[t]}</div>
            </div>
          ))}
          <div className="card" style={{ textAlign: 'center', padding: '8px 6px', cursor: 'pointer',
            border: tierFilter === 'near' ? '1.5px solid rgba(0,212,255,0.35)' : '1px solid var(--border)' }}
            onClick={() => setTierFilter(p => p === 'near' ? 'all' : 'near')}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--amber)', marginBottom: 3 }}>⬆ NEAR</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{nearCount}</div>
          </div>
        </div>
      )}

      {/* Filter pills */}
      {customers.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all',      label: 'All' },
            { id: 'Silver',   label: '◆ Silver' },
            { id: 'Gold',     label: '◆ Gold' },
            { id: 'Platinum', label: '◆ Platinum' },
            { id: 'near',     label: '⬆ Near Upgrade' },
          ].map(f => (
            <button key={f.id} onClick={() => setTierFilter(f.id)}
              style={{ padding: '5px 12px', borderRadius: 20, fontFamily: 'inherit',
                border: `1.5px solid ${tierFilter === f.id ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
                background: tierFilter === f.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                color: tierFilter === f.id ? 'var(--cyan)' : 'var(--muted)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Name, phone or AES-XXXX" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchCustomers()}
          style={{ flex: 1, minWidth: 0, fontSize: 16, padding: '14px 14px', fontWeight: 500, color: '#e8e8f0', background: '#12122a', WebkitTextFillColor: '#e8e8f0' }} />
        <button onClick={searchCustomers} className="btn btn-sm" style={{ padding: '13px 18px', fontSize: 15, fontWeight: 800 }}>Search</button>
        <button onClick={() => { setSearch(''); setTierFilter('all'); loadCustomers(); }} className="btn btn-sm" style={{ padding: '13px 14px', fontSize: 14 }}>All</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>Loading…</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
          {tierFilter === 'near' ? 'No customers are close to upgrading yet.' :
           tierFilter !== 'all' ? `No ${tierFilter} members yet.` :
           'No customers yet. Staff can register customers at checkout.'}
        </div>
      )}

      {!loading && displayed.map(c => {
        const phonePc      = Number(c.phone_purchase_count || 0);
        const nonPhoneS    = Number(c.non_phone_spent || 0);
        const nextTier     = c.tier === 'Silver' ? 'Gold' : c.tier === 'Gold' ? 'Platinum' : null;
        const phoneTarget  = c.tier === 'Silver' ? 3 : 6;
        const spendTarget  = c.tier === 'Silver' ? 8000 : 20000;
        const phoneDone    = phonePc >= phoneTarget;
        const spendDone    = nonPhoneS >= spendTarget;

        return (
          <div key={c.id} className="card" style={{ border: expanded === c.id ? '1.5px solid rgba(0,212,255,0.25)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(p => p === c.id ? null : c.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, color: '#000', background: tierBg(c.tier) }}>{c.tier}</span>
                  {isNearUpgrade(c) && nextTier && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)' }}>⬆ Near {nextTier}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {c.card_number} · {c.phone}
                </div>
                <div style={{ fontSize: 12, marginTop: 3, display: 'flex', gap: 12 }}>
                  <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{c.points} pts</span>
                  <span style={{ color: 'var(--muted)' }}>Rs {Number(c.total_spent).toLocaleString()} total</span>
                  <span style={{ color: 'var(--muted)' }}>{c.visit_count} visits</span>
                </div>
                {/* Upgrade progress — only for Silver and Gold */}
                {nextTier && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 14 }}>📱</span>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, Math.round(phonePc / phoneTarget * 100))}%`,
                          background: phoneDone ? 'var(--green)' : 'var(--cyan)', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ color: phoneDone ? 'var(--green)' : 'inherit', minWidth: 54 }}>
                        {phonePc}/{phoneTarget} phones{phoneDone ? ' ✓' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 14 }}>🛍</span>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, Math.round(nonPhoneS / spendTarget * 100))}%`,
                          background: spendDone ? 'var(--green)' : 'var(--purple)', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ color: spendDone ? 'var(--green)' : 'inherit', minWidth: 54 }}>
                        Rs {nonPhoneS >= 1000 ? `${(nonPhoneS/1000).toFixed(1)}k` : nonPhoneS.toLocaleString()}/{spendTarget >= 1000 ? `${spendTarget/1000}k` : spendTarget}{spendDone ? ' ✓' : ''}
                      </span>
                    </div>
                    {(phoneDone || spendDone) && (
                      <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                        Eligible for {nextTier} — upgrade on next sale or override above
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 11, cursor: 'pointer', paddingLeft: 8 }} onClick={() => setExpanded(p => p === c.id ? null : c.id)}>{expanded === c.id ? '▲' : '▼'}</span>
            </div>

            {expanded === c.id && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Tier override */}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 700 }}>OVERRIDE TIER</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['Silver','Gold','Platinum'].map(t => (
                      <button key={t} onClick={() => setTierOverride(c.id, t)}
                        style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${c.tier === t ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
                          background: c.tier === t ? 'rgba(0,212,255,0.08)' : 'transparent', color: c.tier === t ? 'var(--cyan)' : 'var(--muted)',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spending detail */}
                <div style={{ fontSize: 11, color: 'var(--muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>SPENDING BREAKDOWN</div>
                  <div>📱 Phones: {phonePc} bought</div>
                  <div>🛍 Accessories/Repairs: Rs {nonPhoneS.toLocaleString()}</div>
                  <div>📦 Total: Rs {Number(c.total_spent).toLocaleString()}</div>
                </div>

                {/* Points adjustment */}
                {adjusting[c.id] ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" placeholder="Points (+/-)" value={adjAmt[c.id] || ''}
                      onChange={e => setAdjAmt(p => ({ ...p, [c.id]: e.target.value }))}
                      style={{ flex: 1 }} autoFocus />
                    <button onClick={() => applyAdjust(c.id)} className="btn btn-cyan btn-sm" style={{ padding: '10px 14px' }}>Apply</button>
                    <button onClick={() => setAdjusting(p => ({ ...p, [c.id]: false }))} className="btn btn-ghost btn-sm" style={{ padding: '10px 12px' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setAdjusting(p => ({ ...p, [c.id]: true }))}
                    style={{ padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Adjust Points
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
