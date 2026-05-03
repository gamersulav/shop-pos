import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const TABS = [
  { id: 'sale',     label: '💰 Sale' },
  { id: 'phones',   label: '📱 Phones' },
  { id: 'stock',    label: '📦 Stock' },
  { id: 'repair',   label: '🔧 Repair' },
  { id: 'products', label: '🏷 Products' },
];

const PAYMENTS = ['Cash', 'eSewa', 'FonePay', 'Bank'];
const emptyItem = () => ({ productId: '', qty: 1, price: 0, name: '' });

export default function Staff() {
  const router = useRouter();
  const [tab, setTab]         = useState('sale');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) router.push('/');
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
      <Head><title>Staff — Shop POS</title></Head>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 20 }}>
          <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 16 }}>📱 Shop POS <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 400 }}>Staff</span></span>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 14px' }}>Logout</button>
        </div>

        <div className="tab-bar">
          {TABS.map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              style={{ fontSize: 11 }} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px' }}>
          {tab === 'sale'     && <SaleTab     products={products} />}
          {tab === 'phones'   && <PhonesTab />}
          {tab === 'stock'    && <StockTab    products={products} />}
          {tab === 'repair'   && <RepairTab />}
          {tab === 'products' && <StaffProductsTab products={products} reload={loadProducts} />}
        </div>
      </div>
    </>
  );
}

// ─── SALE TAB ────────────────────────────────────────────────────────────────
function SaleTab({ products }) {
  const [items, setItems]     = useState([emptyItem(), emptyItem()]);
  const [payment, setPayment] = useState('Cash');
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

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
      setTimeout(() => { setItems([emptyItem(), emptyItem()]); setPayment('Cash'); setDone(false); }, 1800);
    } else alert('Error saving sale. Try again.');
  }

  if (done) return <SuccessScreen emoji="✅" title="Sale Saved!" sub={`Total: Rs ${total.toFixed(0)}`} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Sale</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{items.length} items</span>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="item-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>ITEM {idx + 1}</span>
            {items.length > 2 && (
              <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 20, padding: 0 }}>×</button>
            )}
          </div>
          <select value={item.productId} onChange={e => setItem(idx, 'productId', e.target.value)} style={{ marginBottom: 8 }}>
            <option value="">— Select product —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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

      <button className="btn btn-ghost" onClick={() => setItems(p => [...p, emptyItem()])}
        style={{ marginBottom: 16, border: '1.5px dashed var(--border)' }}>
        + Add Another Item
      </button>

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

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>PAYMENT METHOD</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PAYMENTS.map(p => (
            <button key={p} className={`pay-btn ${payment === p ? 'selected' : ''}`} onClick={() => setPayment(p)}>{p}</button>
          ))}
        </div>
      </div>

      <button className="btn btn-green" onClick={saveSale} disabled={saving || !activeItems.length}
        style={{ fontSize: 17, minHeight: 58, opacity: !activeItems.length ? 0.4 : 1 }}>
        {saving ? 'Saving…' : '✅ Save Sale'}
      </button>
    </div>
  );
}

// ─── PHONES TAB ───────────────────────────────────────────────────────────────
function PhonesTab() {
  const [phones, setPhones]     = useState([]);
  const [view, setView]         = useState('list'); // 'list' | 'stockin' | 'selling'
  const [selling, setSelling]   = useState(null);
  const [payment, setPayment]   = useState('Cash');
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState('');
  const [stockForm, setStockForm] = useState({ model: '', condition: 'Good', notes: '' });

  useEffect(() => { loadPhones(); }, []);

  function loadPhones() {
    fetch('/api/phones').then(r => r.json()).then(setPhones);
  }

  const available     = phones.filter(p => p.status === 'available' && Number(p.selling_price) > 0);
  const awaitingPrice = phones.filter(p => p.status === 'available' && !Number(p.selling_price));

  async function stockIn() {
    if (!stockForm.model.trim()) { alert('Enter phone model'); return; }
    setSaving(true);
    const res = await fetch('/api/phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stockForm),
    });
    setSaving(false);
    if (res.ok) {
      setDone('stocked');
      setStockForm({ model: '', condition: 'Good', notes: '' });
      setView('list');
      loadPhones();
      setTimeout(() => setDone(''), 3000);
    } else alert('Error. Try again.');
  }

  async function sellPhone() {
    setSaving(true);
    const res = await fetch(`/api/phones/${selling.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment }),
    });
    setSaving(false);
    if (res.ok) {
      setDone('sold');
      setSelling(null);
      setView('list');
      loadPhones();
      setTimeout(() => setDone(''), 3000);
    } else {
      const d = await res.json();
      alert(d.error || 'Error. Try again.');
    }
  }

  // ── Sell confirmation screen
  if (view === 'selling' && selling) {
    return (
      <div>
        <button onClick={() => { setView('list'); setSelling(null); }}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, marginBottom: 16, padding: 0 }}>
          ← Back
        </button>
        <div className="card" style={{ marginBottom: 16, background: 'rgba(0,230,118,0.05)', borderColor: 'rgba(0,230,118,0.2)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Selling</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{selling.model}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Condition: {selling.condition}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', marginTop: 10 }}>
            Rs {Number(selling.selling_price).toLocaleString()}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>PAYMENT METHOD</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PAYMENTS.map(p => (
              <button key={p} className={`pay-btn ${payment === p ? 'selected' : ''}`} onClick={() => setPayment(p)}>{p}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-green" onClick={sellPhone} disabled={saving} style={{ fontSize: 17, minHeight: 58 }}>
          {saving ? 'Processing…' : '✅ Confirm Sale'}
        </button>
      </div>
    );
  }

  // ── Stock In form
  if (view === 'stockin') {
    return (
      <div>
        <button onClick={() => setView('list')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, marginBottom: 16, padding: 0 }}>
          ← Back
        </button>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Stock In Used Phone</h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>PHONE MODEL & STORAGE</label>
            <input type="text" placeholder="e.g. iPhone 12 Pro 256GB Black"
              value={stockForm.model} onChange={e => setStockForm(f => ({ ...f, model: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CONDITION</label>
            <select value={stockForm.condition} onChange={e => setStockForm(f => ({ ...f, condition: e.target.value }))}>
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>NOTES (Optional)</label>
            <input type="text" placeholder="Any damage, accessories included, etc."
              value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
            ℹ️ Price will be set by the owner before selling
          </div>
          <button className="btn btn-cyan" onClick={stockIn} disabled={saving}>
            {saving ? 'Saving…' : '📱 Save Phone'}
          </button>
        </div>
      </div>
    );
  }

  // ── Main list
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Used Phones</h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setView('stockin')}>
          + Stock In
        </button>
      </div>

      {done === 'stocked' && <AlertBox color="green" text="Phone stocked in successfully!" />}
      {done === 'sold'    && <AlertBox color="green" text="Phone sold successfully!" />}

      {awaitingPrice.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>AWAITING PRICING ({awaitingPrice.length})</SectionLabel>
          {awaitingPrice.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 8, opacity: 0.7 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.model}</div>
              <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>⏳ Waiting for owner to set price</div>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>READY TO SELL ({available.length})</SectionLabel>
      {available.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)', fontSize: 14 }}>
          No phones ready to sell.<br />Stock in a phone or ask owner to set prices.
        </div>
      )}
      {available.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.model}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                Condition: <span style={{ color: 'var(--text)' }}>{p.condition}</span>
                {p.notes ? <span> · {p.notes}</span> : null}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan)', marginLeft: 12 }}>
              Rs {Number(p.selling_price).toLocaleString()}
            </div>
          </div>
          <button className="btn btn-green" style={{ minHeight: 44 }}
            onClick={() => { setSelling(p); setPayment('Cash'); setView('selling'); }}>
            💰 Sell This Phone
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
function StockTab({ products }) {
  const [productId, setProductId] = useState('');
  const [qty, setQty]             = useState(1);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);

  async function saveStock() {
    if (!productId) { alert('Select a product'); return; }
    setSaving(true);
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: Number(productId), qty: Number(qty) }),
    });
    setSaving(false);
    if (res.ok) { setDone(true); setTimeout(() => { setProductId(''); setQty(1); setDone(false); }, 1800); }
    else alert('Error saving. Try again.');
  }

  if (done) return <SuccessScreen emoji="📦" title="Stock Added!" />;

  return (
    <div>
      <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Add Stock</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>PRODUCT</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">— Select product —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>QUANTITY RECEIVED</label>
          <input type="number" min="1" value={qty}
            onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
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
  const [form, setForm]   = useState(init);
  const [saving, setSaving] = useState(false);
  const [done, setDone]   = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function saveRepair() {
    if (!form.customer || !form.phone || !form.issue) { alert('Fill customer name, phone model, and issue'); return; }
    setSaving(true);
    const res = await fetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: form.customer, phone_model: form.phone, issue: form.issue, customer_price: parseFloat(form.customerPrice) || 0, status: form.status }),
    });
    setSaving(false);
    if (res.ok) { setDone(true); setTimeout(() => { setForm(init); setDone(false); }, 1800); }
    else alert('Error saving. Try again.');
  }

  if (done) return <SuccessScreen emoji="🔧" title="Repair Added!" />;

  return (
    <div>
      <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Add Repair</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['CUSTOMER NAME', 'customer', 'text', 'e.g. Ram Bahadur'], ['PHONE MODEL', 'phone', 'text', 'e.g. iPhone 14 Pro'], ['CUSTOMER PRICE (Rs)', 'customerPrice', 'number', '0']].map(([lbl, key, type, ph]) => (
          <div key={key}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>{lbl}</label>
            <input type={type} placeholder={ph} value={form[key]} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>ISSUE</label>
          <textarea value={form.issue} onChange={e => set('issue', e.target.value)} placeholder="Describe the problem…" rows={3}
            style={{ background: '#12122a', border: '1.5px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '12px 14px', fontSize: 15, width: '100%', outline: 'none', resize: 'vertical' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>STATUS</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option>Pending</option><option>In Progress</option><option>Done</option><option>Delivered</option>
          </select>
        </div>
        <button className="btn btn-cyan" onClick={saveRepair} disabled={saving}>
          {saving ? 'Saving…' : '🔧 Save Repair'}
        </button>
      </div>
    </div>
  );
}

// ─── PRODUCTS TAB ─────────────────────────────────────────────────────────────
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
      setDone(form.name); setForm({ name: '', selling_price: '' }); setShowAdd(false); reload();
      setTimeout(() => setDone(''), 3000);
    } else alert('Error saving. Try again.');
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

      {done && <AlertBox color="green" text={`"${done}" added successfully`} />}

      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)' }}>New Product</div>
          {[['PRODUCT NAME', 'name', 'text', 'e.g. iPhone 15 Case'], ['SELLING PRICE (Rs)', 'selling_price', 'number', '0']].map(([lbl, key, type, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>{lbl}</label>
              <input type={type} placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
            ℹ️ Purchase cost will be set by the owner
          </div>
          <button className="btn btn-green" onClick={addProduct} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {products.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No products yet.</div>}
        {products.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                Price: <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {p.selling_price}</span>
                <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
                Stock: <span style={{ color: p.stock < 5 ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>{p.stock}</span>
              </div>
            </div>
            {p.stock < 5 && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, background: 'rgba(255,51,85,0.1)', padding: '3px 8px', borderRadius: 6 }}>LOW</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
function SuccessScreen({ emoji, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{title}</div>
      {sub && <div style={{ color: 'var(--muted)', marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>{children}</div>;
}

function AlertBox({ color, text }) {
  const c = color === 'green' ? { bg: 'rgba(0,230,118,0.12)', border: 'rgba(0,230,118,0.3)', text: 'var(--green)' }
                              : { bg: 'rgba(255,176,32,0.12)', border: 'rgba(255,176,32,0.3)', text: 'var(--amber)' };
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: c.text, fontWeight: 600 }}>
      ✅ {text}
    </div>
  );
}
