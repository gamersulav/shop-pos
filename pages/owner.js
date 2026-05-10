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
  { id: 'credits',   label: '💳 Credits' },
  { id: 'expenses',  label: '💸 Expenses' },
  { id: 'cash',      label: '💰 Cash' },
];

export default function Owner() {
  const router = useRouter();
  const [tab, setTab] = useState('dash');
  const [products, setProducts] = useState([]);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d || d.role !== 'owner') { router.push('/'); }
    });
    loadProducts();
  }, []);

  function loadProducts() {
    fetch('/api/products').then(r => r.json()).then(setProducts);
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <span style={{ fontWeight: 700, color: 'var(--purple)', fontSize: 16 }}>👑 Owner Panel</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => router.push('/staff')} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}>
              Staff View
            </button>
            <button onClick={() => setShowChangePw(true)} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}>🔑 Password</button>
            <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}>Logout</button>
          </div>
        </div>

        {/* Change password modal */}
        {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

        {/* Tab bar */}
        <div className="tab-bar" style={{ overflowX: 'auto' }}>
          {TABS.map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              style={{ fontSize: 10, minWidth: 60 }} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '16px' }}>
          {tab === 'dash'      && <DashboardTab />}
          {tab === 'analytics' && <AnalyticsTab />}
          {tab === 'products'  && <ProductsTab products={products} reload={loadProducts} />}
          {tab === 'phones'    && <OwnerPhonesTab />}
          {tab === 'costs'     && <CostsTab products={products} />}
          {tab === 'repairs'   && <RepairsTab />}
          {tab === 'credits'   && <OwnerCreditsTab />}
          {tab === 'expenses'  && <OwnerExpensesTab />}
          {tab === 'cash'      && <CashTab />}
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

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
    const iv = setInterval(() => fetch('/api/dashboard').then(r => r.json()).then(setData), 30000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return <LoadingState />;

  const { today, monthly, payments, topProducts, repairStats, activeRepairs, phoneStats } = data;

  const repairStatusColors = { Pending: 'var(--amber)', 'In Progress': 'var(--cyan)', Done: 'var(--green)', Delivered: 'var(--muted)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', selling_price: '', cost_price: '', stock: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

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
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setNewProd({ name: '', selling_price: '', cost_price: '', stock: '' });
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
  }

  async function deleteProduct(id) {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    reload();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Products</h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setShowAdd(p => !p)}>
          {showAdd ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)', marginBottom: 4 }}>New Product</div>
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

      {/* Delete confirmation */}
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
        {products.map(p => (
          <div key={p.id} className="card">
            {editing?.id === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyan)' }}>Editing: {p.name}</div>
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
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Sell: <span style={{ color: 'var(--cyan)' }}>Rs {p.selling_price}</span>
                    <span style={{ margin: '0 6px' }}>·</span>
                    Cost: <span style={{ color: 'var(--green)' }}>Rs {p.cost_price}</span>
                    <span style={{ margin: '0 6px' }}>·</span>
                    Stock: <span style={{ color: p.stock < 5 ? 'var(--red)' : 'var(--amber)' }}>{p.stock}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}
                    onClick={() => setEditing({ id: p.id, selling_price: p.selling_price, cost_price: p.cost_price, stock: p.stock })}>
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
function OwnerPhonesTab() {
  const [phones, setPhones] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [view, setView] = useState('available'); // 'available' | 'sold'

  useEffect(() => { loadPhones(); }, []);
  function loadPhones() {
    fetch('/api/phones').then(r => r.json()).then(setPhones);
  }

  async function savePrice(id) {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/phones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cost_price:    parseFloat(editing.cost_price)    || 0,
        selling_price: parseFloat(editing.selling_price) || 0,
        condition:     editing.condition,
        notes:         editing.notes,
        discount:      parseFloat(editing.sale_discount) || 0,
      }),
    });
    setSaving(false);
    setEditing(null);
    loadPhones();
  }

  async function deletePhone(id) {
    await fetch(`/api/phones/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    loadPhones();
  }

  const available = phones.filter(p => p.status === 'available');
  const sold      = phones.filter(p => p.status === 'sold');
  const needsPricing = available.filter(p => !Number(p.selling_price));
  const readyToSell  = available.filter(p =>  Number(p.selling_price));
  const displayed    = view === 'available' ? available : sold;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Used Phones</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{available.length} available · {sold.length} sold</div>
      </div>

      {needsPricing.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.12)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--amber)' }}>
          ⚠ {needsPricing.length} phone{needsPricing.length !== 1 ? 's' : ''} need pricing before staff can sell
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['available', `Available (${available.length})`], ['sold', `Sold (${sold.length})`]].map(([v, lbl]) => (
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

      {displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          {view === 'available' ? 'No phones in stock' : 'No phones sold yet'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayed.map(p => (
          <div key={p.id} className="card">
            {editing?.id === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyan)' }}>Pricing: {p.model}</div>
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
                    Margin: <strong style={{ color: 'var(--green)' }}>
                      Rs {(Number(editing.selling_price) - Number(editing.cost_price)).toFixed(0)}
                    </strong>
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
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.model}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {p.condition}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                      onClick={() => setEditing({ id: p.id, cost_price: p.cost_price ?? 0, selling_price: p.selling_price ?? 0, condition: p.condition, notes: p.notes || '', sale_discount: Number(p.sale_discount || 0) })}>
                      {Number(p.selling_price) ? 'Edit' : '+ Price'}
                    </button>
                    <button className="btn btn-sm" style={{ width: 'auto', padding: '5px 8px', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12 }}
                      onClick={() => setConfirmDelete({ id: p.id, model: p.model })}>
                      Del
                    </button>
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
                    {Number(p.sale_discount) > 0 && (
                      <span style={{ color: 'var(--amber)' }}>Discount given: Rs {Number(p.sale_discount).toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
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

  useEffect(() => {
    fetch('/api/stock').then(r => r.json()).then(setEntries);
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
      {entries.length === 0 && (
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

  useEffect(() => { loadRepairs(); }, []);
  function loadRepairs() {
    fetch('/api/repairs').then(r => r.json()).then(setRepairs);
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

      {repairs.length === 0 && (
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
                    <option>Pending</option><option>In Progress</option><option>Done</option><option>Delivered</option>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(r.created_at)}</span>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}
                    onClick={() => setEditing({ id: r.id, customer_name: r.customer_name || '', customer_phone: r.customer_phone || '', phone_model: r.phone_model || '', issue: r.issue || '', customer_price: r.customer_price, repair_discount: r.repair_discount || 0, cost_price: r.cost_price, status: r.status, notes: r.notes || '', payment_method: r.payment_method || 'Cash' })}>
                    Edit
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
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Analytics</h2>

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

  useEffect(() => { loadCredits(); }, []);

  async function loadCredits() {
    setLoading(true);
    const r = await fetch('/api/credits?all=1');
    setCredits(await r.json());
    setLoading(false);
  }

  async function clearCredit(type, id, totalDiscount) {
    setClearing(`${type}-${id}`);
    await fetch('/api/credits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, discount: Number(totalDiscount) || 0 }),
    });
    setClearing(null);
    setDiscounting(null);
    setLineDiscounts({});
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
                    onClick={() => { setDiscounting(key); setLineDiscounts({}); }}>
                    ✓ Mark Paid
                  </button>
                )}
                {item.credit_cleared && item.credit_cleared_at && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Paid {fmtDate(item.credit_cleared_at, { day: 'numeric', month: 'short' })}
                  </span>
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-green btn-sm" style={{ flex: 1 }}
                      onClick={() => clearCredit(item._type, item.id, totalDisc)} disabled={isClearing}>
                      {isClearing ? '…' : '✓ Confirm'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}
                      onClick={() => { setDiscounting(null); setLineDiscounts({}); }}>
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
      await fetch('/api/cash-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, payment_method: m, amount: Number(openingForm[m]) || 0 }),
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
                    {md.productSales > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>+ Product Sales</span>
                        <span style={{ color: 'var(--green)' }}>+Rs {md.productSales.toLocaleString()}</span>
                      </div>
                    )}
                    {md.repairSales > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>+ Repair Collections</span>
                        <span style={{ color: 'var(--green)' }}>+Rs {md.repairSales.toLocaleString()}</span>
                      </div>
                    )}
                    {m === 'Cash' && data.expenses > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>− Expenses</span>
                        <span style={{ color: 'var(--red)' }}>-Rs {data.expenses.toLocaleString()}</span>
                      </div>
                    )}
                    {m === 'Cash' && data.supplierPayments > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>− Supplier Payments</span>
                        <span style={{ color: 'var(--red)' }}>-Rs {data.supplierPayments.toLocaleString()}</span>
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
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left',  color: 'var(--muted)', fontWeight: 700, fontSize: 10 }}>DATE</th>
                      <th style={{ padding: '8px 6px',  textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 10 }}>SALES IN</th>
                      <th style={{ padding: '8px 6px',  textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 10 }}>EXP</th>
                      <th style={{ padding: '8px 6px',  textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 10 }}>SUPP</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700, fontSize: 10 }}>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map(row => {
                      const salesIn  = Number(row.sales) + Number(row.repair_sales);
                      const totalOut = Number(row.expenses) + Number(row.supplier_payments);
                      const net      = salesIn - totalOut;
                      const isSelected = row.date === date;
                      return (
                        <tr key={row.date} style={{ borderBottom: '1px solid var(--border)', background: isSelected ? 'rgba(6,182,212,0.06)' : 'transparent', cursor: 'pointer' }}
                          onClick={() => setDate(row.date)}>
                          <td style={{ padding: '8px 10px', color: isSelected ? 'var(--cyan)' : 'var(--text)', fontWeight: isSelected ? 700 : 400 }}>
                            {fmtShort(row.date)}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                            {salesIn > 0 ? salesIn.toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--red)' }}>
                            {Number(row.expenses) > 0 ? Number(row.expenses).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--amber)' }}>
                            {Number(row.supplier_payments) > 0 ? Number(row.supplier_payments).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: net >= 0 ? 'var(--cyan)' : 'var(--red)' }}>
                            {net >= 0 ? '+' : ''}{net.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
                Tap any row to view that day's breakdown. Phone sales excluded. Supplier = settled shop tab debts.
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
  const [form, setForm]         = useState({ description: '', amount: '', payment_method: 'Cash' });
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
      body: JSON.stringify({ description: form.description.trim(), amount: Number(form.amount), payment_method: form.payment_method }),
    });
    setSaving(false);
    setForm({ description: '', amount: '', payment_method: 'Cash' });
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
  const map = { 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Done': 'badge-done', 'Delivered': 'badge-delivered' };
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status}</span>;
}

function LoadingState() {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>;
}
