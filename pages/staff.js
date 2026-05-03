import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const TABS = [
  { id: 'sale',     label: '💰 Sale' },
  { id: 'stock',    label: '📦 Stock' },
  { id: 'repair',   label: '🔧 Repair' },
  { id: 'products', label: '🏷 Products' },
];

const PAYMENTS = ['Cash', 'eSewa', 'FonePay', 'Bank'];

const emptyItem = () => ({ productId: '', qty: 1, price: 0, name: '' });

export default function Staff() {
  const router = useRouter();
  const [tab, setTab] = useState('sale');
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) { router.push('/'); return; }
      setUser(d);
    });
    fetch('/api/products').then(r => r.json()).then(setProducts);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <>
      <Head><title>Staff — Mobile Shop POS</title></Head>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 16 }}>📱 Shop POS</span>
            <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>Staff</span>
          </div>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 14px' }}>Logout</button>
        </div>

        {/* Tab bar */}
        <div className="tab-bar">
          {TABS.map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '16px' }}>
          {tab === 'sale'     && <SaleTab    products={products} />}
          {tab === 'stock'    && <StockTab   products={products} />}
          {tab === 'repair'   && <RepairTab />}
          {tab === 'products' && <StaffProductsTab products={products} reload={() => fetch('/api/products').then(r => r.json()).then(setProducts)} />}
        </div>
      </div>
    </>
  );
}

// ─── SALE TAB ────────────────────────────────────────────────────────────────
function SaleTab({ products }) {
  const [items, setItems] = useState([emptyItem(), emptyItem()]);
  const [payment, setPayment] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const activeItems = items.filter(i => i.productId);
  const total = activeItems.reduce((s, i) => s + i.price * i.qty, 0);

  function setItem(idx, field, val) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'productId') {
        const p = products.find(p => p.id === Number(val));
        next[idx].price = p ? p.selling_price : 0;
        next[idx].name  = p ? p.name : '';
      }
      return next;
    });
  }

  function addItem() { setItems(p => [...p, emptyItem()]); }
  function removeItem(idx) { setItems(p => p.filter((_, i) => i !== idx)); }

  async function saveSale() {
    const filled = items.filter(i => i.productId && i.qty > 0);
    if (!filled.length) { alert('Add at least one product'); return; }
    setSaving(true);
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: filled, payment }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => {
        setItems([emptyItem(), emptyItem()]);
        setPayment('Cash');
        setDone(false);
      }, 1800);
    } else {
      alert('Error saving sale. Try again.');
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>Sale Saved!</div>
        <div style={{ color: 'var(--muted)', marginTop: 8 }}>Total: Rs {total.toFixed(0)}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Sale</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Item rows */}
      {items.map((item, idx) => (
        <div key={idx} className="item-row">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ITEM {idx + 1}</span>
            {items.length > 2 && (
              <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>

          <select value={item.productId} onChange={e => setItem(idx, 'productId', e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">— Select product —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>QTY</label>
              <input type="number" min="1" value={item.qty}
                onChange={e => setItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }} />
            </div>
            <div style={{ flex: 1.5 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>PRICE (Rs)</label>
              <input type="number" value={item.price}
                onChange={e => setItem(idx, 'price', parseFloat(e.target.value) || 0)}
                style={{ textAlign: 'right', fontWeight: 700, fontSize: 18, color: item.price ? 'var(--cyan)' : 'var(--muted)' }} />
            </div>
          </div>

          {item.productId && (
            <div style={{ textAlign: 'right', marginTop: 6, fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
              Subtotal: Rs {(item.price * item.qty).toFixed(0)}
            </div>
          )}
        </div>
      ))}

      {/* Add item */}
      <button className="btn btn-ghost" onClick={addItem} style={{ marginBottom: 16, border: '1.5px dashed var(--border)' }}>
        + Add Another Item
      </button>

      {/* Total */}
      <div className="card" style={{ marginBottom: 16, background: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--cyan)' }}>Rs {total.toFixed(0)}</span>
        </div>
        {activeItems.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {activeItems.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                <span>{it.name} × {it.qty}</span>
                <span>Rs {(it.price * it.qty).toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment method */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>PAYMENT METHOD</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PAYMENTS.map(p => (
            <button key={p} className={`pay-btn ${payment === p ? 'selected' : ''}`} onClick={() => setPayment(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button className="btn btn-green" onClick={saveSale} disabled={saving || !activeItems.length}
        style={{ fontSize: 17, minHeight: 58, opacity: !activeItems.length ? 0.4 : 1 }}>
        {saving ? 'Saving…' : '✅ Save Sale'}
      </button>
    </div>
  );
}

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
function StockTab({ products }) {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function saveStock() {
    if (!productId) { alert('Select a product'); return; }
    setSaving(true);
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: Number(productId), qty: Number(qty) }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => { setProductId(''); setQty(1); setDone(false); }, 1800);
    } else {
      alert('Error saving. Try again.');
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>Stock Added!</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Add Stock</h2>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>PRODUCT</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">— Select product —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>QUANTITY RECEIVED</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ textAlign: 'center', fontWeight: 700, fontSize: 24 }} />
        </div>

        <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
          ℹ️ Purchase price will be set by the owner
        </div>

        <button className="btn btn-cyan" onClick={saveStock} disabled={saving || !productId}>
          {saving ? 'Saving…' : '📦 Save Stock Entry'}
        </button>
      </div>
    </div>
  );
}

// ─── REPAIR TAB ───────────────────────────────────────────────────────────────
function RepairTab() {
  const init = { customer: '', phone: '', issue: '', customerPrice: '', status: 'Pending' };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function saveRepair() {
    if (!form.customer || !form.phone || !form.issue) { alert('Fill in customer name, phone model, and issue'); return; }
    setSaving(true);
    const res = await fetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: form.customer,
        phone_model:   form.phone,
        issue:         form.issue,
        customer_price: parseFloat(form.customerPrice) || 0,
        status:        form.status,
      }),
    });
    setSaving(false);
    if (res.ok) { setDone(true); setTimeout(() => { setForm(init); setDone(false); }, 1800); }
    else alert('Error saving. Try again.');
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔧</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>Repair Added!</div>
      </div>
    );
  }

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Add Repair</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {field('CUSTOMER NAME', 'customer', 'text', 'e.g. Ram Bahadur')}
        {field('PHONE MODEL', 'phone', 'text', 'e.g. iPhone 14 Pro')}

        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>ISSUE</label>
          <textarea value={form.issue} onChange={e => set('issue', e.target.value)}
            placeholder="Describe the problem…" rows={3}
            style={{ background: '#12122a', border: '1.5px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '12px 14px', fontSize: 15, width: '100%', outline: 'none', resize: 'vertical' }} />
        </div>

        {field('CUSTOMER PRICE (Rs)', 'customerPrice', 'number', '0')}

        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>STATUS</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Delivered</option>
          </select>
        </div>

        <button className="btn btn-cyan" onClick={saveRepair} disabled={saving}>
          {saving ? 'Saving…' : '🔧 Save Repair'}
        </button>
      </div>
    </div>
  );
}

// ─── STAFF PRODUCTS TAB ───────────────────────────────────────────────────────
function StaffProductsTab({ products, reload }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name: '', selling_price: '' });
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState('');

  async function addProduct() {
    if (!form.name.trim() || !form.selling_price) { alert('Enter product name and selling price'); return; }
    setSaving(true);
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), selling_price: parseFloat(form.selling_price) }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(form.name);
      setForm({ name: '', selling_price: '' });
      setShowAdd(false);
      reload();
      setTimeout(() => setDone(''), 3000);
    } else {
      alert('Error saving. Try again.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Product List</h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }}
          onClick={() => setShowAdd(p => !p)}>
          {showAdd ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {done && (
        <div style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>
          ✅ "{done}" added successfully
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)' }}>New Product</div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>PRODUCT NAME</label>
            <input type="text" placeholder="e.g. iPhone 15 Case" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>SELLING PRICE (Rs)</label>
            <input type="number" placeholder="0" value={form.selling_price}
              onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
              style={{ fontWeight: 700, fontSize: 18 }} />
          </div>

          <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
            ℹ️ Purchase cost will be set by the owner
          </div>

          <button className="btn btn-green" onClick={addProduct} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      )}

      {/* Product list — no cost price shown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {products.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No products yet. Add one above.</div>
        )}
        {products.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                Price: <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {p.selling_price}</span>
                <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
                Stock: <span style={{ color: p.stock < 5 ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>{p.stock} units</span>
              </div>
            </div>
            {p.stock < 5 && (
              <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, background: 'rgba(255,51,85,0.1)', padding: '3px 8px', borderRadius: 6 }}>
                LOW
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
