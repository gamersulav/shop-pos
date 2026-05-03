import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const TABS = [
  { id: 'dash',     label: '📊 Dashboard' },
  { id: 'products', label: '🏷 Products' },
  { id: 'costs',    label: '💲 Costs' },
  { id: 'repairs',  label: '🔧 Repairs' },
];

export default function Owner() {
  const router = useRouter();
  const [tab, setTab] = useState('dash');
  const [products, setProducts] = useState([]);

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
          <div>
            <span style={{ fontWeight: 700, color: 'var(--purple)', fontSize: 16 }}>👑 Owner Panel</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => router.push('/staff')} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}>
              Staff View
            </button>
            <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}>Logout</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tab-bar">
          {TABS.map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              style={{ fontSize: 12 }} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '16px' }}>
          {tab === 'dash'     && <DashboardTab />}
          {tab === 'products' && <ProductsTab products={products} reload={loadProducts} />}
          {tab === 'costs'    && <CostsTab    products={products} />}
          {tab === 'repairs'  && <RepairsTab />}
        </div>
      </div>
    </>
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

  const { today, weekly, monthly, topProducts, pendingRepairs, payments } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Today's numbers */}
      <div>
        <SectionLabel>TODAY</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard val={`Rs ${today.revenue.toFixed(0)}`} lbl="Revenue" color="var(--cyan)" />
          <StatCard val={`Rs ${today.profit.toFixed(0)}`} lbl="Profit" color="var(--green)" />
          <StatCard val={today.sales} lbl="Sales" color="var(--amber)" />
          <StatCard val={today.items} lbl="Items Sold" color="var(--purple)" />
        </div>
      </div>

      {/* Monthly numbers */}
      <div>
        <SectionLabel>THIS MONTH</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard val={`Rs ${monthly.revenue.toFixed(0)}`} lbl="Revenue" color="var(--cyan)" />
          <StatCard val={`Rs ${monthly.profit.toFixed(0)}`} lbl="Profit" color="var(--green)" />
          <StatCard val={`${monthly.margin.toFixed(1)}%`} lbl="Margin" color="var(--amber)" />
          <StatCard val={monthly.sales} lbl="Sales" color="var(--purple)" />
        </div>
      </div>

      {/* Payment breakdown */}
      {payments.length > 0 && (
        <div>
          <SectionLabel>TODAY'S PAYMENTS</SectionLabel>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.map(p => (
              <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>{p.method}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {p.total.toFixed(0)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{p.count} sale{p.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>Rs {p.revenue.toFixed(0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>+Rs {p.profit.toFixed(0)} profit</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending repairs */}
      {pendingRepairs.length > 0 && (
        <div>
          <SectionLabel>PENDING REPAIRS ({pendingRepairs.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRepairs.map(r => (
              <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.customer_name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{r.phone_model} — {r.issue.slice(0, 40)}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRODUCTS TAB ─────────────────────────────────────────────────────────────
function ProductsTab({ products, reload }) {
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', selling_price: '', cost_price: '', stock: '' });
  const [saving, setSaving] = useState(false);

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
    const p = products.find(p => p.id === id);
    if (!p) return;
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
                <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}
                  onClick={() => setEditing({ id: p.id, selling_price: p.selling_price, cost_price: p.cost_price, stock: p.stock })}>
                  Edit
                </button>
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
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Purchase Costs</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
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
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {e.quantity} units · {new Date(e.created_at).toLocaleDateString('en-IN')}
                </div>
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
                <div style={{ fontWeight: 700, color: 'var(--cyan)' }}>{r.customer_name} — {r.phone_model}</div>
                {[['Customer Price (Rs)', 'customer_price', 'number'], ['Your Cost (Rs)', 'cost_price', 'number'], ['Notes', 'notes', 'text']].map(([lbl, key, type]) => (
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={() => saveRepair(r.id)} disabled={saving}>Save</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.customer_name}</div>
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
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}
                    onClick={() => setEditing({ id: r.id, customer_price: r.customer_price, cost_price: r.cost_price, status: r.status, notes: r.notes || '' })}>
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
