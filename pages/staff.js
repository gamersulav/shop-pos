import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const TABS = [
  { id: 'sale',     label: '💰 Sale' },
  { id: 'phones',   label: '📱 Phones' },
  { id: 'stock',    label: '📦 Stock' },
  { id: 'repair',   label: '🔧 Repair' },
  { id: 'products', label: '🏷 Products' },
  { id: 'returns',  label: '↩ Returns' },
  { id: 'credits',  label: '💳 Credits' },
];

const PAYMENTS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay', 'Credit'];
const STATUSES = ['Pending', 'In Progress', 'Done', 'Delivered'];
const emptyItem = () => ({ productId: '', qty: 1, price: 0, name: '' });

const NPT = { timeZone: 'Asia/Kathmandu' };
function fmtDate(str, opts = {}) {
  if (!str) return '';
  const d = new Date(str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-IN', { ...NPT, ...opts });
}
function fmtDateTime(str) {
  if (!str) return '';
  const d = new Date(str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-IN', { ...NPT, dateStyle: 'short', timeStyle: 'short' });
}

export default function Staff() {
  const router = useRouter();
  const [tab, setTab]           = useState('sale');
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

        <div className="tab-bar" style={{ overflowX: 'auto' }}>
          {TABS.map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              style={{ fontSize: 10, minWidth: 58 }} onClick={() => setTab(t.id)}>
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
          {tab === 'returns'  && <ReturnsTab  products={products} />}
          {tab === 'credits'  && <CreditsTab />}
        </div>
      </div>
    </>
  );
}

// ─── PRODUCT COMBO BOX ────────────────────────────────────────────────────────
function ProductComboBox({ products, value, onChange }) {
  const selected = products.find(p => p.id === Number(value));
  const [search, setSearch] = useState(selected ? selected.name : '');
  const [open, setOpen]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!value) setSearch('');
    else {
      const p = products.find(p => p.id === Number(value));
      if (p) setSearch(p.name);
    }
  }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  function select(p) {
    onChange(p.id);
    setSearch(p.name);
    setOpen(false);
  }

  function handleInput(e) {
    setSearch(e.target.value);
    onChange('');
    setOpen(true);
  }

  function clear() {
    setSearch('');
    onChange('');
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={search}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder="Search or select product…"
          style={{ flex: 1 }}
        />
        {(search || value) && (
          <button onMouseDown={clear}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '0 12px', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>
            ×
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#12122a', border: '1.5px solid var(--cyan)', borderRadius: 10, zIndex: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          {filtered.map(p => (
            <div key={p.id} onMouseDown={() => select(p)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: value && p.id === Number(value) ? 'rgba(0,212,255,0.12)' : 'transparent' }}>
              <span style={{ fontSize: 14 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700 }}>Rs {p.selling_price}</span>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search.trim() && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#12122a', border: '1.5px solid var(--border)', borderRadius: 10, zIndex: 200, padding: '12px 14px', color: 'var(--muted)', fontSize: 13 }}>
          No products match "{search}"
        </div>
      )}
    </div>
  );
}

// ─── SALE TAB ────────────────────────────────────────────────────────────────
function SaleTab({ products }) {
  const [items, setItems]               = useState([emptyItem(), emptyItem()]);
  const [payment, setPayment]           = useState('Cash');
  const [billDiscount, setBillDiscount] = useState('');
  const [creditCustomer, setCreditCustomer] = useState('');
  const [saving, setSaving]             = useState(false);
  const [done, setDone]                 = useState(false);

  const activeItems = items.filter(i => i.productId);
  const subtotal    = activeItems.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt     = Math.min(Math.max(0, parseFloat(billDiscount) || 0), subtotal);
  const total       = subtotal - discAmt;

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
    if (payment === 'Credit' && !creditCustomer.trim()) { alert('Enter customer name for credit sale'); return; }
    setSaving(true);
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: filled, payment, billDiscount: discAmt, creditCustomer }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => {
        setItems([emptyItem(), emptyItem()]);
        setPayment('Cash');
        setBillDiscount('');
        setCreditCustomer('');
        setDone(false);
      }, 1800);
    } else alert('Error saving sale. Try again.');
  }

  if (done) return <SuccessScreen emoji="✅" title="Sale Saved!" sub={`Total: Rs ${total.toFixed(0)}`} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Sale</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{items.length} rows</span>
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
          <ProductComboBox
            products={products}
            value={item.productId}
            onChange={val => setItem(idx, 'productId', String(val))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>QTY</label>
              <input type="number" min="1" value={item.qty}
                onChange={e => setItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }} />
            </div>
            <div style={{ flex: 1.5 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>PRICE (Rs)</label>
              <div style={{ padding: '12px 14px', background: '#12122a', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 18, fontWeight: 700, color: item.price ? 'var(--cyan)' : 'var(--muted)', textAlign: 'right' }}>
                {item.price ? `Rs ${item.price}` : '—'}
              </div>
            </div>
          </div>
          {item.productId && (
            <div style={{ textAlign: 'right', marginTop: 6, fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
              Rs {(item.price * item.qty).toFixed(0)}
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-ghost" onClick={() => setItems(p => [...p, emptyItem()])}
        style={{ marginBottom: 16, border: '1.5px dashed var(--border)' }}>
        + Add Another Item
      </button>

      <div className="card" style={{ marginBottom: 16, background: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.2)' }}>
        {activeItems.length > 0 && (
          <div style={{ marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            {activeItems.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                <span>{it.name} × {it.qty}</span>
                <span>Rs {(it.price * it.qty).toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Discount (Rs)</span>
          <input type="number" min="0" placeholder="0"
            value={billDiscount} onChange={e => setBillDiscount(e.target.value)}
            style={{ flex: 1, textAlign: 'right', fontSize: 16 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
          <div style={{ textAlign: 'right' }}>
            {discAmt > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'line-through' }}>Rs {subtotal.toFixed(0)}</div>}
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--cyan)' }}>Rs {total.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: payment === 'Credit' ? 12 : 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>PAYMENT METHOD</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PAYMENTS.map(p => (
            <button key={p} className={`pay-btn ${payment === p ? 'selected' : ''}`}
              style={{ fontSize: 11 }} onClick={() => setPayment(p)}>{p}</button>
          ))}
        </div>
      </div>

      {payment === 'Credit' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER NAME (required for credit)</label>
          <input type="text" placeholder="Who is taking on credit?" value={creditCustomer}
            onChange={e => setCreditCustomer(e.target.value)} />
        </div>
      )}

      <button className="btn btn-green" onClick={saveSale} disabled={saving || !activeItems.length}
        style={{ fontSize: 17, minHeight: 58, opacity: !activeItems.length ? 0.4 : 1 }}>
        {saving ? 'Saving…' : '✅ Save Sale'}
      </button>
    </div>
  );
}

// ─── PHONES TAB ───────────────────────────────────────────────────────────────
function PhonesTab() {
  const [phones, setPhones]               = useState([]);
  const [view, setView]                   = useState('list');
  const [selling, setSelling]             = useState(null);
  const [payment, setPayment]             = useState('Cash');
  const [phoneDiscount, setPhoneDiscount] = useState('');
  const [creditCustomer, setCreditCustomer] = useState('');
  const [saving, setSaving]               = useState(false);
  const [done, setDone]                   = useState('');
  const [sortBy, setSortBy]               = useState('recents');
  const [search, setSearch]               = useState('');
  const [stockForm, setStockForm]         = useState({ model: '', condition: 'Good', notes: '' });

  useEffect(() => { loadPhones(); }, []);

  function loadPhones() {
    fetch('/api/phones').then(r => r.json()).then(setPhones);
  }

  const available     = phones.filter(p => p.status === 'available' && Number(p.selling_price) > 0);
  const awaitingPrice = phones.filter(p => p.status === 'available' && !Number(p.selling_price));

  function sortedAvailable() {
    const list = [...available];
    if (sortBy === 'name')       return list.sort((a, b) => a.model.localeCompare(b.model));
    if (sortBy === 'price_asc')  return list.sort((a, b) => Number(a.selling_price) - Number(b.selling_price));
    if (sortBy === 'price_desc') return list.sort((a, b) => Number(b.selling_price) - Number(a.selling_price));
    if (sortBy === 'oldest')     return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return list;
  }

  const filteredPhones = search.trim()
    ? sortedAvailable().filter(p => p.model.toLowerCase().includes(search.toLowerCase()))
    : sortedAvailable();

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
    if (payment === 'Credit' && !creditCustomer.trim()) { alert('Enter customer name for credit sale'); return; }
    const discAmt = Math.min(Math.max(0, parseFloat(phoneDiscount) || 0), Number(selling.selling_price));
    setSaving(true);
    const res = await fetch(`/api/phones/${selling.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment, discount: discAmt, creditCustomer }),
    });
    setSaving(false);
    if (res.ok) {
      setDone('sold');
      setSelling(null);
      setPhoneDiscount('');
      setCreditCustomer('');
      setPayment('Cash');
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
    const discAmt  = Math.min(Math.max(0, parseFloat(phoneDiscount) || 0), Number(selling.selling_price));
    const finalAmt = Number(selling.selling_price) - discAmt;
    return (
      <div>
        <button onClick={() => { setView('list'); setSelling(null); setPhoneDiscount(''); setCreditCustomer(''); setPayment('Cash'); }}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, marginBottom: 16, padding: 0 }}>
          ← Back
        </button>
        <div className="card" style={{ marginBottom: 16, background: 'rgba(0,230,118,0.05)', borderColor: 'rgba(0,230,118,0.2)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Selling</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{selling.model}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Condition: {selling.condition}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Discount (Rs)</span>
            <input type="number" min="0" max={selling.selling_price} placeholder="0"
              value={phoneDiscount} onChange={e => setPhoneDiscount(e.target.value)}
              style={{ flex: 1, textAlign: 'right', fontSize: 16 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Sale Price</span>
            <div style={{ textAlign: 'right' }}>
              {discAmt > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'line-through' }}>Rs {Number(selling.selling_price).toLocaleString()}</div>}
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>Rs {finalAmt.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: payment === 'Credit' ? 12 : 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>PAYMENT METHOD</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PAYMENTS.map(p => (
              <button key={p} className={`pay-btn ${payment === p ? 'selected' : ''}`}
                style={{ fontSize: 11 }} onClick={() => setPayment(p)}>{p}</button>
            ))}
          </div>
        </div>

        {payment === 'Credit' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER NAME (required for credit)</label>
            <input type="text" placeholder="Who is taking on credit?" value={creditCustomer}
              onChange={e => setCreditCustomer(e.target.value)} />
          </div>
        )}

        <button className="btn btn-green" onClick={sellPhone} disabled={saving} style={{ fontSize: 17, minHeight: 58 }}>
          {saving ? 'Processing…' : `✅ Confirm Sale · Rs ${finalAmt.toLocaleString()}`}
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
              <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionLabel>READY TO SELL ({available.length})</SectionLabel>
      </div>

      {/* Search bar */}
      {available.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search phones…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Sort controls */}
      {available.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[['recents','Recent'],['oldest','Oldest'],['name','Name'],['price_asc','Price ↑'],['price_desc','Price ↓']].map(([v,l]) => (
            <button key={v} onClick={() => setSortBy(v)}
              style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 20, border: '1.5px solid var(--border)', background: sortBy === v ? 'var(--cyan)' : 'transparent', color: sortBy === v ? '#000' : 'var(--muted)', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {filteredPhones.length === 0 && available.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)', fontSize: 14 }}>
          No phones ready to sell.<br />Stock in a phone or ask owner to set prices.
        </div>
      )}
      {filteredPhones.length === 0 && available.length > 0 && search && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 14 }}>
          No phones match "{search}"
        </div>
      )}
      {filteredPhones.map(p => (
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
            onClick={() => { setSelling(p); setPayment('Cash'); setPhoneDiscount(''); setCreditCustomer(''); setView('selling'); }}>
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
          <ProductComboBox
            products={products}
            value={productId}
            onChange={val => setProductId(val ? String(val) : '')}
          />
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
  const [view, setView]         = useState('list');
  const [repairs, setRepairs]   = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingList, setLoadingList]   = useState(false);
  const [updatingId, setUpdatingId]     = useState(null);
  const [discountInputs, setDiscountInputs] = useState({});

  const init = { customer: '', customerPhone: '', phone: '', issue: '', customerPrice: '', status: 'Pending', payment: 'Cash' };
  const [form, setForm]   = useState(init);
  const [saving, setSaving] = useState(false);
  const [done, setDone]   = useState(false);

  useEffect(() => { if (view === 'list') loadRepairs(); }, [view]);

  async function loadRepairs() {
    setLoadingList(true);
    const r = await fetch('/api/repairs');
    const data = await r.json();
    setRepairs(data);
    const inits = {};
    data.forEach(rep => { inits[rep.id] = Number(rep.repair_discount) || 0; });
    setDiscountInputs(inits);
    setLoadingList(false);
  }

  async function updateStatus(id, status) {
    setUpdatingId(id);
    await fetch(`/api/repairs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setUpdatingId(null);
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  async function updatePayment(id, payment_method) {
    setUpdatingId(id);
    await fetch(`/api/repairs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_method }) });
    setUpdatingId(null);
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, payment_method } : r));
  }

  async function updateDiscount(id) {
    const disc = Math.max(0, parseFloat(discountInputs[id]) || 0);
    setUpdatingId(id);
    await fetch(`/api/repairs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repair_discount: disc }) });
    setUpdatingId(null);
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, repair_discount: disc } : r));
    setDiscountInputs(prev => ({ ...prev, [id]: disc }));
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function saveRepair() {
    if (!form.customer || !form.customerPhone || !form.issue) {
      alert('Customer name, phone number, and issue are all required');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:  form.customer,
        customer_phone: form.customerPhone,
        phone_model:    form.phone || '—',
        issue:          form.issue,
        customer_price: parseFloat(form.customerPrice) || 0,
        status:         form.status,
        payment_method: form.payment,
      }),
    });
    setSaving(false);
    if (res.ok) { setDone(true); setTimeout(() => { setForm(init); setDone(false); setView('list'); }, 1500); }
    else alert('Error saving. Try again.');
  }

  const filtered = statusFilter === 'all' ? repairs : repairs.filter(r => r.status === statusFilter);
  const statusColor = { Pending: 'var(--amber)', 'In Progress': 'var(--cyan)', Done: 'var(--green)', Delivered: 'var(--muted)' };
  const statusBg    = { Pending: 'rgba(255,176,32,0.12)', 'In Progress': 'rgba(0,212,255,0.12)', Done: 'rgba(0,230,118,0.12)', Delivered: 'rgba(112,112,160,0.12)' };

  if (done) return <SuccessScreen emoji="🔧" title="Repair Added!" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Repairs</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('list')} className={`btn btn-sm ${view === 'list' ? 'btn-cyan' : 'btn-ghost'}`} style={{ width: 'auto', padding: '7px 14px' }}>List</button>
          <button onClick={() => setView('add')}  className={`btn btn-sm ${view === 'add'  ? 'btn-cyan' : 'btn-ghost'}`} style={{ width: 'auto', padding: '7px 14px' }}>+ Add</button>
        </div>
      </div>

      {/* ── List view ── */}
      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {[['all','All'],['Pending','Pending'],['In Progress','In Progress'],['Done','Done'],['Delivered','Delivered']].map(([v,l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20, border: '1.5px solid var(--border)', background: statusFilter === v ? 'var(--cyan)' : 'transparent', color: statusFilter === v ? '#000' : 'var(--muted)', cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          {loadingList && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Loading…</div>}
          {!loadingList && filtered.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No repairs found</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => {
              const charge      = Number(r.customer_price) || 0;
              const savedDisc   = Number(r.repair_discount) || 0;
              const finalAmt    = Math.max(0, charge - savedDisc);
              const pendingDisc = discountInputs[r.id] ?? savedDisc;
              return (
                <div key={r.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{r.customer_name}</div>
                        {r.payment_method === 'Credit' && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,176,32,0.15)', color: 'var(--amber)' }}>
                            CREDIT{r.credit_cleared ? ' ✓' : ''}
                          </span>
                        )}
                      </div>
                      {r.customer_phone && (
                        <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 2, fontWeight: 600 }}>📞 {r.customer_phone}</div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{r.phone_model !== '—' ? r.phone_model : ''}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4 }}>{r.issue}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusBg[r.status], color: statusColor[r.status], whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {r.status}
                    </span>
                  </div>

                  {charge > 0 && (
                    <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Charge 🔒</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>Rs {charge.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Discount (Rs)</span>
                        <input type="number" min="0" max={charge}
                          value={pendingDisc}
                          onChange={e => setDiscountInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ flex: 1, textAlign: 'right', fontSize: 14, padding: '6px 10px' }} />
                        <button onClick={() => updateDiscount(r.id)} disabled={updatingId === r.id}
                          style={{ padding: '6px 11px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#000', cursor: 'pointer', opacity: updatingId === r.id ? 0.5 : 1 }}>
                          Save
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Final</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>Rs {finalAmt.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{fmtDateTime(r.created_at)}</div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>UPDATE STATUS</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {STATUSES.map(s => (
                        <button key={s} onClick={() => updateStatus(r.id, s)} disabled={updatingId === r.id || r.status === s}
                          style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: '1.5px solid var(--border)', background: r.status === s ? statusBg[s] : 'transparent', color: r.status === s ? statusColor[s] : 'var(--muted)', cursor: r.status === s ? 'default' : 'pointer', opacity: updatingId === r.id ? 0.5 : 1 }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>PAYMENT</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {PAYMENTS.map(p => {
                        const cur = r.payment_method || 'Cash';
                        return (
                          <button key={p} onClick={() => updatePayment(r.id, p)} disabled={updatingId === r.id || cur === p}
                            style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, borderRadius: 8, border: '1.5px solid var(--border)',
                              background: cur === p ? (p === 'Credit' ? 'rgba(255,176,32,0.15)' : 'rgba(0,212,255,0.12)') : 'transparent',
                              color: cur === p ? (p === 'Credit' ? 'var(--amber)' : 'var(--cyan)') : 'var(--muted)',
                              cursor: cur === p ? 'default' : 'pointer', opacity: updatingId === r.id ? 0.5 : 1 }}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add view ── */}
      {view === 'add' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER NAME *</label>
            <input type="text" placeholder="e.g. Ram Bahadur" value={form.customer} onChange={e => set('customer', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER PHONE NUMBER *</label>
            <input type="tel" placeholder="e.g. 98XXXXXXXX" value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>DEVICE MODEL (Optional)</label>
            <input type="text" placeholder="e.g. iPhone 14 Pro" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>ISSUE / DESCRIPTION *</label>
            <textarea value={form.issue} onChange={e => set('issue', e.target.value)} placeholder="Describe the problem…" rows={3}
              style={{ background: '#12122a', border: '1.5px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '12px 14px', fontSize: 15, width: '100%', outline: 'none', resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER PRICE (Rs)</label>
            <input type="number" placeholder="0" value={form.customerPrice} onChange={e => set('customerPrice', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Once saved, amount is locked. Use Discount on the card to adjust later.</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>STATUS</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8, fontWeight: 700 }}>PAYMENT METHOD</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PAYMENTS.map(p => (
                <button key={p} type="button" className={`pay-btn ${form.payment === p ? 'selected' : ''}`}
                  style={{ fontSize: 11 }} onClick={() => set('payment', p)}>{p}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-cyan" onClick={saveRepair} disabled={saving}>
            {saving ? 'Saving…' : '🔧 Save Repair'}
          </button>
        </div>
      )}
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

// ─── RETURNS TAB ─────────────────────────────────────────────────────────────
function ReturnsTab({ products }) {
  const [subTab, setSubTab] = useState('purchase');
  const [phones, setPhones] = useState([]);

  useEffect(() => {
    fetch('/api/phones').then(r => r.json()).then(setPhones);
  }, []);

  const availablePhones = phones.filter(p => p.status === 'available');
  const soldPhones      = phones.filter(p => p.status === 'sold');

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Returns</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['purchase','↩ Purchase Return'],['salesreturn','↩ Sales Return']].map(([v,l]) => (
          <button key={v} onClick={() => setSubTab(v)}
            className={`btn btn-sm ${subTab === v ? 'btn-cyan' : 'btn-ghost'}`} style={{ flex: 1 }}>{l}</button>
        ))}
      </div>

      {subTab === 'purchase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ReturnForm
            title="Product Purchase Return"
            description="Returning accessories/products to supplier — stock will be deducted."
            endpoint="/api/returns/purchase"
            itemType="product"
            items={products.map(p => ({ id: p.id, label: `${p.name} (stock: ${p.stock})` }))}
            showQty
          />
          <ReturnForm
            title="Phone Purchase Return"
            description="Returning a stocked phone back to supplier."
            endpoint="/api/returns/purchase"
            itemType="phone"
            items={availablePhones.map(p => ({ id: p.id, label: `${p.model} · ${p.condition}` }))}
            showQty={false}
          />
        </div>
      )}

      {subTab === 'salesreturn' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ReturnForm
            title="Product Sales Return"
            description="Customer returning an accessory — stock will be added back."
            endpoint="/api/returns/sales"
            itemType="product"
            items={products.map(p => ({ id: p.id, label: p.name }))}
            showQty
            showAmount
          />
          <ReturnForm
            title="Phone Sales Return"
            description="Customer returning a phone — phone will go back to available."
            endpoint="/api/returns/sales"
            itemType="phone"
            items={soldPhones.map(p => ({ id: p.id, label: `${p.model} · ${p.condition}` }))}
            showQty={false}
            showAmount
          />
        </div>
      )}
    </div>
  );
}

function ReturnForm({ title, description, endpoint, itemType, items, showQty, showAmount }) {
  const [itemId, setItemId]         = useState('');
  const [quantity, setQuantity]     = useState(1);
  const [reason, setReason]         = useState('');
  const [returnAmount, setReturnAmount] = useState('');
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');

  const selected = items.find(i => i.id === Number(itemId));

  async function submit() {
    if (!itemId) { alert('Select an item'); return; }
    setSaving(true);
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType,
        itemId: Number(itemId),
        itemName: selected?.label || '',
        quantity: Number(quantity),
        reason,
        return_amount: showAmount ? (parseFloat(returnAmount) || 0) : 0,
      }),
    });
    setSaving(false);
    if (!r.ok) { alert('Failed'); return; }
    setMsg(`✓ Return recorded for: ${selected?.label}`);
    setItemId(''); setQuantity(1); setReason(''); setReturnAmount('');
    setTimeout(() => setMsg(''), 4000);
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{description}</div>
      {msg && <AlertBox color="green" text={msg} />}
      <div>
        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>SELECT ITEM</label>
        <select value={itemId} onChange={e => setItemId(e.target.value)}>
          <option value="">— Select —</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>No items available</div>}
      </div>
      {showQty && (
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>QUANTITY</label>
          <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} style={{ textAlign: 'center', fontSize: 18, fontWeight: 700 }} />
        </div>
      )}
      {showAmount && (
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>AMOUNT REFUNDED (Rs)</label>
          <input type="number" min="0" placeholder="Amount customer paid (after any discounts)" value={returnAmount}
            onChange={e => setReturnAmount(e.target.value)} style={{ textAlign: 'right', fontSize: 16 }} />
        </div>
      )}
      <div>
        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>REASON (optional)</label>
        <input type="text" placeholder="e.g. Defective, wrong item…" value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <button className="btn btn-cyan" onClick={submit} disabled={saving || !itemId}>
        {saving ? 'Recording…' : 'Record Return'}
      </button>
    </div>
  );
}

// ─── CREDITS TAB ──────────────────────────────────────────────────────────────
function CreditsTab() {
  const [credits, setCredits] = useState({ sales: [], repairs: [] });
  const [clearing, setClearing] = useState(null);
  const [cleared, setCleared]   = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadCredits(); }, []);

  async function loadCredits() {
    setLoading(true);
    const r = await fetch('/api/credits');
    setCredits(await r.json());
    setLoading(false);
  }

  async function clearCredit(type, id) {
    setClearing(`${type}-${id}`);
    await fetch('/api/credits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    });
    setClearing(null);
    setCleared(prev => ({ ...prev, [`${type}-${id}`]: true }));
    setTimeout(() => {
      setCleared(prev => { const n = { ...prev }; delete n[`${type}-${id}`]; return n; });
      loadCredits();
    }, 1500);
  }

  const pending = [
    ...(credits.sales  || []).map(s => ({ ...s, _type: 'sale' })),
    ...(credits.repairs || []).map(r => ({ ...r, _type: 'repair' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalPending = pending.reduce((sum, item) => {
    return sum + Number(item._type === 'sale' ? item.total_amount : item.customer_price);
  }, 0);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Pending Credits</h2>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: 'rgba(255,176,32,0.06)', borderColor: 'rgba(255,176,32,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{pending.length} pending credit{pending.length !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Total outstanding</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>Rs {totalPending.toLocaleString()}</div>
        </div>
      )}

      {pending.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          No pending credits!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map(item => {
          const key = `${item._type}-${item.id}`;
          const isClearing = clearing === key;
          const isCleared  = cleared[key];
          const amount = Number(item._type === 'sale' ? item.total_amount : item.customer_price);
          const name   = item._type === 'sale' ? (item.credit_customer || 'Unknown') : item.customer_name;
          const typeLabel = item._type === 'repair' ? 'REPAIR'
            : (item.items_summary && !item.items_summary.match(/^\d/)) ? 'SALE' : 'PHONE SALE';

          return (
            <div key={key} className="card" style={{ opacity: isCleared ? 0.5 : 1, transition: 'opacity 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: item._type === 'repair' ? 'rgba(176,96,255,0.12)' : 'rgba(0,212,255,0.12)',
                  color: item._type === 'repair' ? 'var(--purple)' : 'var(--cyan)' }}>
                  {typeLabel}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {fmtDate(item.created_at, { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{name}</div>
              {item._type === 'sale' && item.items_summary && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{item.items_summary}</div>
              )}
              {item._type === 'repair' && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  {item.phone_model} — {item.issue?.slice(0, 50)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>
                  Rs {amount.toLocaleString()}
                </span>
                {isCleared ? (
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>✓ Paid!</span>
                ) : (
                  <button className="btn btn-green btn-sm" style={{ width: 'auto', padding: '8px 18px' }}
                    onClick={() => clearCredit(item._type, item.id)} disabled={isClearing}>
                    {isClearing ? '…' : '✓ Mark Paid'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 14, color: c.text, fontWeight: 600 }}>
      ✅ {text}
    </div>
  );
}
