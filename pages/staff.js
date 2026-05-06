import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

async function compressImage(file, maxPx = 540, quality = 0.58) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const TABS = [
  { id: 'sale',        label: '💰 Sale' },
  { id: 'phones',      label: '📱 Phones' },
  { id: 'repair',      label: '🔧 Repair' },
  { id: 'stock',       label: '📦 Stock' },
  { id: 'accessories', label: '🏷 Accessories' },
  { id: 'returns',     label: '↩ Returns' },
  { id: 'credits',     label: '💳 Credits' },
  { id: 'balance',     label: '💰 Balance' },
  { id: 'expenses',    label: '💸 Expenses' },
];

const PAYMENTS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay', 'Credit'];
const PAYMENT_COLORS = {
  Cash: 'var(--green)', eSewa: 'var(--cyan)',
  'Bank Transfer': 'var(--purple)', Fonepay: 'var(--amber)', Credit: 'var(--red)',
};
const CASH_METHODS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'];
const CASH_COLORS  = { Cash: 'var(--green)', eSewa: 'var(--cyan)', 'Bank Transfer': 'var(--purple)', Fonepay: 'var(--amber)' };
const STATUSES = ['Pending', 'In Progress', 'Done', 'Delivered'];

const NPT = { timeZone: 'Asia/Kathmandu' };
function nptToday() { return new Date(Date.now() + (5*60+45)*60*1000).toISOString().split('T')[0]; }
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
  const [phones, setPhones]     = useState([]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) router.push('/');
    });
    loadProducts();
    loadPhones();
  }, []);

  function loadProducts() { fetch('/api/products').then(r => r.json()).then(setProducts); }
  function loadPhones() {
    fetch('/api/phones').then(r => r.json()).then(data => {
      setPhones((data || []).filter(p => p.status === 'available' && Number(p.selling_price) > 0));
    });
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
              style={{ fontSize: 10, minWidth: 52 }} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px' }}>
          {tab === 'sale'        && <SaleTab products={products} phones={phones} />}
          {tab === 'phones'      && <PhonesTab onPhoneSold={loadPhones} />}
          {tab === 'repair'      && <RepairTab />}
          {tab === 'stock'       && <StockTab products={products} />}
          {tab === 'accessories' && <AccessoriesTab products={products} reload={loadProducts} />}
          {tab === 'returns'     && <ReturnsTab products={products} />}
          {tab === 'credits'     && <CreditsTab />}
          {tab === 'balance'     && <StaffPaymentBalanceTab />}
          {tab === 'expenses'    && <StaffExpensesTab />}
        </div>
      </div>
    </>
  );
}

// ─── ITEM COMBO BOX ───────────────────────────────────────────────────────────
function ItemComboBox({ items, value, onChange, placeholder }) {
  const selected = items.find(i => String(i.id) === String(value));
  const [search, setSearch] = useState(selected ? selected.label : '');
  const [open, setOpen]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!value) setSearch('');
    else {
      const found = items.find(i => String(i.id) === String(value));
      if (found) setSearch(found.label);
    }
  }, [value, items.length]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search.trim()
    ? items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  function select(item) { onChange(item.id); setSearch(item.label); setOpen(false); }
  function clear() { setSearch(''); onChange(''); setOpen(false); }

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={search}
          onChange={e => { setSearch(e.target.value); onChange(''); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search or select…'}
          style={{ flex: 1 }}
        />
        {(search || value) && (
          <button onMouseDown={clear}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '0 12px', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>×</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#12122a', border: '1.5px solid var(--cyan)', borderRadius: 10, zIndex: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          {filtered.map(item => (
            <div key={item.id} onMouseDown={() => select(item)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: value && String(item.id) === String(value) ? 'rgba(0,212,255,0.12)' : 'transparent' }}>
              <span style={{ fontSize: 14 }}>{item.label}</span>
              <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{item.sublabel}</span>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search.trim() && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#12122a', border: '1.5px solid var(--border)', borderRadius: 10, zIndex: 200, padding: '12px 14px', color: 'var(--muted)', fontSize: 13 }}>
          No results for "{search}"
        </div>
      )}
    </div>
  );
}

// ─── PAYMENT BUTTON ───────────────────────────────────────────────────────────
function PayButton({ method, selected, onClick }) {
  const color = PAYMENT_COLORS[method] || 'var(--cyan)';
  return (
    <button onClick={onClick}
      style={{
        flex: 1, padding: '10px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700, textAlign: 'center',
        border: selected ? `2px solid ${color}` : '2px solid var(--border)',
        background: selected ? `${color}26` : 'transparent',
        color: selected ? color : 'var(--muted)',
        cursor: 'pointer', transition: 'all 0.18s',
      }}>
      {method}
    </button>
  );
}

// ─── SALE TAB ────────────────────────────────────────────────────────────────
const emptyItem = () => ({ type: 'accessory', productId: '', phoneId: '', qty: 1, price: 0, discount: '', name: '' });

function SaleTab({ products, phones }) {
  const [items, setItems]             = useState([emptyItem(), emptyItem()]);
  const [payment, setPayment]         = useState(null);
  const [creditCustomer, setCreditCustomer] = useState('');
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);
  const [payError, setPayError]       = useState(false);

  const accItems = products.map(p => ({ id: p.id, label: p.name, price: p.selling_price, sublabel: `Rs ${p.selling_price}` }));
  const phoneItems = phones.map(p => ({ id: p.id, label: p.model, price: Number(p.selling_price), sublabel: `${p.condition} · Rs ${Number(p.selling_price).toLocaleString()}` }));

  const activeItems = items.filter(i =>
    (i.type === 'accessory' && i.productId && i.price > 0) ||
    (i.type === 'phone' && i.phoneId && i.price > 0)
  );

  const grandTotal = activeItems.reduce((s, i) => {
    const disc = Math.min(Math.max(0, parseFloat(i.discount) || 0), i.price * (i.type === 'phone' ? 1 : i.qty));
    return s + Math.max(0, i.price * (i.type === 'phone' ? 1 : i.qty) - disc);
  }, 0);

  const totalDiscount = activeItems.reduce((s, i) => {
    return s + Math.min(Math.max(0, parseFloat(i.discount) || 0), i.price * (i.type === 'phone' ? 1 : i.qty));
  }, 0);

  function setItem(idx, field, val) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'type') {
        next[idx] = { ...emptyItem(), type: val };
      }
      if (field === 'productId') {
        const p = products.find(p => String(p.id) === String(val));
        next[idx].price = p ? p.selling_price : 0;
        next[idx].name  = p ? p.name : '';
      }
      if (field === 'phoneId') {
        const p = phones.find(p => String(p.id) === String(val));
        next[idx].price = p ? Number(p.selling_price) : 0;
        next[idx].name  = p ? p.model : '';
      }
      return next;
    });
  }

  async function saveSale() {
    if (!activeItems.length) { alert('Add at least one item'); return; }
    if (!payment) { setPayError(true); return; }
    if (payment === 'Credit' && !creditCustomer.trim()) { alert('Enter customer name for credit sale'); return; }
    setPayError(false);
    setSaving(true);
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: activeItems.map(i => ({
          type: i.type,
          productId: i.type === 'accessory' ? Number(i.productId) : undefined,
          phoneId:   i.type === 'phone'      ? Number(i.phoneId)   : undefined,
          qty:   i.type === 'phone' ? 1 : i.qty,
          price: i.price,
          itemDiscount: Math.min(Math.max(0, parseFloat(i.discount) || 0), i.price * (i.type === 'phone' ? 1 : i.qty)),
        })),
        payment,
        creditCustomer,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => {
        setItems([emptyItem(), emptyItem()]);
        setPayment(null);
        setCreditCustomer('');
        setPayError(false);
        setDone(false);
      }, 1800);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Error saving sale. Try again.');
    }
  }

  if (done) return <SuccessScreen emoji="✅" title="Sale Saved!" sub={`Total: Rs ${grandTotal.toFixed(0)}`} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Sale</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{items.length} rows</span>
      </div>

      {items.map((item, idx) => {
        const lineQty  = item.type === 'phone' ? 1 : item.qty;
        const lineMax  = item.price * lineQty;
        const lineDisc = Math.min(Math.max(0, parseFloat(item.discount) || 0), lineMax);
        const lineNet  = Math.max(0, lineMax - lineDisc);
        const hasItem  = item.type === 'accessory' ? !!item.productId : !!item.phoneId;

        return (
          <div key={idx} className="item-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>ITEM {idx + 1}</span>
              {items.length > 2 && (
                <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 20, padding: 0 }}>×</button>
              )}
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[['accessory','🏷 Accessories'],['phone','📱 Phone']].map(([v, lbl]) => (
                <button key={v} onClick={() => setItem(idx, 'type', v)}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1.5px solid ${item.type === v ? 'var(--cyan)' : 'var(--border)'}`, background: item.type === v ? 'rgba(0,212,255,0.1)' : 'transparent', color: item.type === v ? 'var(--cyan)' : 'var(--muted)', cursor: 'pointer' }}>
                  {lbl}
                </button>
              ))}
            </div>

            {item.type === 'accessory' ? (
              <ItemComboBox
                items={accItems}
                value={item.productId}
                onChange={val => setItem(idx, 'productId', String(val))}
                placeholder="Search accessory…"
              />
            ) : (
              <ItemComboBox
                items={phoneItems}
                value={item.phoneId}
                onChange={val => setItem(idx, 'phoneId', String(val))}
                placeholder="Search phone…"
              />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {item.type === 'accessory' && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>QTY</label>
                  <input type="number" min="1" value={item.qty}
                    onChange={e => setItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }} />
                </div>
              )}
              <div style={{ flex: 1.5 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>PRICE (Rs)</label>
                <div style={{ padding: '12px 14px', background: '#12122a', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 18, fontWeight: 700, color: item.price ? 'var(--cyan)' : 'var(--muted)', textAlign: 'right' }}>
                  {item.price ? `Rs ${item.price.toLocaleString()}` : '—'}
                </div>
              </div>
            </div>

            {hasItem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Discount (Rs)</label>
                <input type="number" min="0" placeholder="0"
                  value={item.discount}
                  onChange={e => setItem(idx, 'discount', e.target.value)}
                  style={{ flex: 1, textAlign: 'right', fontSize: 15 }} />
              </div>
            )}

            {hasItem && item.price > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: 'var(--muted)' }}>
                  {item.type === 'phone' ? item.name : `${item.name} × ${item.qty}`}
                </span>
                <span style={{ color: lineDisc > 0 ? 'var(--amber)' : 'var(--green)' }}>
                  {lineDisc > 0 && <span style={{ textDecoration: 'line-through', color: 'var(--muted)', marginRight: 6, fontSize: 12 }}>Rs {lineMax.toLocaleString()}</span>}
                  Rs {lineNet.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <button className="btn btn-ghost" onClick={() => setItems(p => [...p, emptyItem()])}
        style={{ marginBottom: 16, border: '1.5px dashed var(--border)' }}>
        + Add Another Item
      </button>

      {/* Summary */}
      {activeItems.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: 'rgba(0,212,255,0.04)', borderColor: 'rgba(0,212,255,0.18)' }}>
          {activeItems.map((it, i) => {
            const qty = it.type === 'phone' ? 1 : it.qty;
            const disc = Math.min(Math.max(0, parseFloat(it.discount) || 0), it.price * qty);
            const net  = Math.max(0, it.price * qty - disc);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--muted)' }}>{it.type === 'phone' ? '📱' : '🏷'} {it.name}{it.type === 'accessory' && qty > 1 ? ` ×${qty}` : ''}</span>
                <span style={{ fontWeight: 600 }}>Rs {net.toLocaleString()}{disc > 0 ? ` (−${disc.toLocaleString()})` : ''}</span>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Grand Total</span>
            <div style={{ textAlign: 'right' }}>
              {totalDiscount > 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Discount Rs {totalDiscount.toLocaleString()}</div>}
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--cyan)' }}>Rs {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment method */}
      <div style={{ marginBottom: payment === 'Credit' ? 12 : 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: payError ? 'var(--red)' : 'var(--muted)' }}>
          {payError ? '⚠ SELECT PAYMENT METHOD (required)' : 'PAYMENT METHOD'}
        </div>
        <select value={payment || ''} onChange={e => { setPayment(e.target.value); setPayError(false); }} style={{ fontWeight: 700 }}>
          <option value="" disabled>Select payment method…</option>
          {PAYMENTS.map(p => <option key={p}>{p}</option>)}
        </select>
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

// ─── PHONES TAB (stock-in only, no sell) ────────────────────────────────────
function PhonesTab({ onPhoneSold }) {
  const [phones, setPhones]   = useState([]);
  const [view, setView]       = useState('list');
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState('');
  const [sortBy, setSortBy]   = useState('recents');
  const [search, setSearch]   = useState('');
  const [stockForm, setStockForm] = useState({ model: '', condition: 'Good', notes: '', photos: [] });
  const [shareToast, setShareToast] = useState('');

  useEffect(() => { loadPhones(); }, []);

  function loadPhones() { fetch('/api/phones').then(r => r.json()).then(setPhones); }

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

  async function sharePhone(p) {
    const txt = `📱 ${p.model}\nCondition: ${p.condition}\nPrice: Rs ${Number(p.selling_price).toLocaleString()}${p.notes ? '\nNotes: ' + p.notes : ''}`;
    if (navigator.share) { try { await navigator.share({ text: txt }); return; } catch {} }
    try { await navigator.clipboard.writeText(txt); } catch {}
    setShareToast(p.id);
    setTimeout(() => setShareToast(''), 2200);
  }

  async function addPhonePhoto(e) {
    const files = Array.from(e.target.files || []);
    const current = stockForm.photos || [];
    if (current.length >= 6) { alert('Max 6 photos'); return; }
    const toAdd = files.slice(0, 6 - current.length);
    const compressed = await Promise.all(toAdd.map(f => compressImage(f)));
    setStockForm(f => ({ ...f, photos: [...(f.photos || []), ...compressed] }));
    e.target.value = '';
  }

  async function stockIn() {
    if (!stockForm.model.trim()) { alert('Enter phone model'); return; }
    setSaving(true);
    const res = await fetch('/api/phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: stockForm.model, condition: stockForm.condition, notes: stockForm.notes, photos: stockForm.photos }),
    });
    setSaving(false);
    if (res.ok) {
      setDone('stocked');
      setStockForm({ model: '', condition: 'Good', notes: '', photos: [] });
      setView('list');
      loadPhones();
      setTimeout(() => setDone(''), 3000);
    } else alert('Error. Try again.');
  }

  if (view === 'stockin') {
    return (
      <div>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, marginBottom: 16, padding: 0 }}>← Back</button>
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
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>PHOTOS ({(stockForm.photos||[]).length}/6) — Optional</label>
            <label style={{ display: 'block', cursor: 'pointer', padding: '10px 14px', background: 'rgba(0,212,255,0.06)', border: '1.5px dashed rgba(0,212,255,0.3)', borderRadius: 10, textAlign: 'center', fontSize: 13, color: 'var(--cyan)' }}>
              📷 Take Photo / Choose from Gallery
              <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={addPhonePhoto} disabled={(stockForm.photos||[]).length >= 6} />
            </label>
            {(stockForm.photos||[]).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {stockForm.photos.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border)' }} />
                    <button onClick={() => setStockForm(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--red)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Used Phones</h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setView('stockin')}>+ Stock In</button>
      </div>

      {done === 'stocked' && <AlertBox color="green" text="Phone stocked in successfully!" />}

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
        <SectionLabel>AVAILABLE TO SELL ({available.length})</SectionLabel>
      </div>

      {available.length > 0 && (
        <input type="text" placeholder="Search phones…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
      )}

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
          No priced phones in stock.<br />
          <span style={{ fontSize: 12, marginTop: 6, display: 'block', color: 'var(--cyan)' }}>Use Sale tab to record phone sales</span>
        </div>
      )}

      {shareToast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e1e3a', border: '1.5px solid var(--cyan)', borderRadius: 10, padding: '10px 20px', fontSize: 13, color: 'var(--cyan)', fontWeight: 700, zIndex: 999, whiteSpace: 'nowrap' }}>
          ✓ Copied to clipboard!
        </div>
      )}

      {filteredPhones.map(p => {
        const photos = (() => { try { return p.photos ? JSON.parse(p.photos) : []; } catch { return []; } })();
        return (
          <div key={p.id} className="card" style={{ marginBottom: 10 }}>
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ height: 80, width: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1.5px solid var(--border)' }} />
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => sharePhone(p)}
                style={{ padding: '0 14px', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--border)', background: shareToast === p.id ? 'rgba(0,212,255,0.12)' : 'transparent', color: shareToast === p.id ? 'var(--cyan)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                📤 Share
              </button>
              <div style={{ flex: 1, padding: '0 14px', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--border)', background: 'rgba(0,212,255,0.05)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                Sell via 💰 Sale tab
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── REPAIR TAB ───────────────────────────────────────────────────────────────
function RepairTab() {
  const [view, setView]         = useState('list');
  const [repairs, setRepairs]   = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDelivered, setShowDelivered] = useState(false);
  const [loadingList, setLoadingList]   = useState(false);
  const [updatingId, setUpdatingId]     = useState(null);
  const [discountInputs, setDiscountInputs] = useState({});

  const init = { phone: '', customer: '', customerPhone: '', issue: '', customerPrice: '', status: 'Pending', payment: 'Cash' };
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
    if (!form.phone.trim() || !form.customer.trim() || !form.customerPhone.trim() || !form.issue.trim()) {
      alert('Device model, customer name, phone number, and issue are all required');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:  form.customer,
        customer_phone: form.customerPhone,
        phone_model:    form.phone,
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

  // Hide delivered + paid repairs by default
  const activeRepairs = repairs.filter(r =>
    r.status !== 'Delivered' ||
    (r.payment_method === 'Credit' && !r.credit_cleared)
  );
  const hiddenCount = repairs.length - activeRepairs.length;
  const baseRepairs  = showDelivered ? repairs : activeRepairs;
  const filtered     = statusFilter === 'all' ? baseRepairs : baseRepairs.filter(r => r.status === statusFilter);

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
                  {/* Phone model at top */}
                  <div style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 700, marginBottom: 6 }}>
                    📱 {r.phone_model && r.phone_model !== '—' ? r.phone_model : 'Unknown Device'}
                  </div>
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
                    <select value={r.payment_method || 'Cash'} disabled={updatingId === r.id}
                      onChange={e => updatePayment(r.id, e.target.value)} style={{ fontWeight: 700, opacity: updatingId === r.id ? 0.5 : 1 }}>
                      {PAYMENTS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {!loadingList && hiddenCount > 0 && (
            <button onClick={() => setShowDelivered(p => !p)}
              style={{ marginTop: 12, width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '10px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
              {showDelivered ? '▲ Hide delivered' : `▼ Show ${hiddenCount} delivered & paid`}
            </button>
          )}
        </div>
      )}

      {view === 'add' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>DEVICE / PHONE MODEL *</label>
            <input type="text" placeholder="e.g. iPhone 14 Pro, Samsung S23" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER NAME *</label>
            <input type="text" placeholder="e.g. Ram Bahadur" value={form.customer} onChange={e => set('customer', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CUSTOMER PHONE NUMBER *</label>
            <input type="tel" placeholder="e.g. 98XXXXXXXX" value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} />
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
            <select value={form.payment} onChange={e => set('payment', e.target.value)} style={{ fontWeight: 700 }}>
              {PAYMENTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button className="btn btn-cyan" onClick={saveRepair} disabled={saving}>
            {saving ? 'Saving…' : '🔧 Save Repair'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
function StockTab({ products }) {
  const [subTab, setSubTab] = useState('regular');
  const [productId, setProductId] = useState('');
  const [qty, setQty]             = useState(1);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);

  const [shopView, setShopView]     = useState('list');
  const [shopRows, setShopRows]     = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [settling, setSettling]     = useState('');

  const blankShopItem = () => ({ productId: '', productName: '', qty: 1, unitCost: '' });
  const [direction, setDirection]   = useState('in');
  const [shopName, setShopName]     = useState('');
  const [shopItems, setShopItems]   = useState([blankShopItem()]);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopDone, setShopDone]     = useState(false);

  const accItems = products.map(p => ({ id: p.id, label: p.name, price: p.selling_price, sublabel: `stock: ${p.stock}` }));

  useEffect(() => {
    if (subTab === 'shop' && shopView === 'list') loadShops();
  }, [subTab, shopView]);

  async function loadShops() {
    setLoadingShops(true);
    const r = await fetch('/api/shop-tabs');
    setShopRows(await r.json());
    setLoadingShops(false);
  }

  async function settleShop(name) {
    setSettling(name);
    await fetch('/api/shop-tabs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopName: name }) });
    setSettling('');
    loadShops();
  }

  const grouped = {};
  shopRows.forEach(r => { if (!grouped[r.shop_name]) grouped[r.shop_name] = []; grouped[r.shop_name].push(r); });
  const shopNames   = Object.keys(grouped).sort();
  const recentShops = shopNames.slice(0, 8);

  async function saveRegularStock() {
    if (!productId) { alert('Select a product'); return; }
    setSaving(true);
    const res = await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: Number(productId), qty: Number(qty) }) });
    setSaving(false);
    if (res.ok) { setDone(true); setTimeout(() => { setProductId(''); setQty(1); setDone(false); }, 1800); }
    else alert('Error saving. Try again.');
  }

  function setShopItem(idx, field, val) {
    setShopItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'productId') {
        const p = products.find(p => String(p.id) === String(val));
        next[idx].productName = p ? p.name : '';
      }
      return next;
    });
  }

  async function saveShopPurchase() {
    if (!shopName.trim()) { alert('Enter shop name'); return; }
    const filled = shopItems.filter(i => i.productName && i.qty > 0);
    if (!filled.length) { alert('Add at least one product'); return; }
    setShopSaving(true);
    const res = await fetch('/api/shop-tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName: shopName.trim(), direction, items: filled.map(i => ({ productId: i.productId ? Number(i.productId) : null, productName: i.productName, quantity: Number(i.qty), unitCost: Number(i.unitCost) || 0 })) }),
    });
    setShopSaving(false);
    if (res.ok) {
      setShopDone(true);
      setTimeout(() => { setDirection('in'); setShopName(''); setShopItems([blankShopItem()]); setShopDone(false); setShopView('list'); }, 1500);
    } else alert('Error saving. Try again.');
  }

  if (done)     return <SuccessScreen emoji="📦" title="Stock Added!" />;
  if (shopDone) return <SuccessScreen emoji="🛍️" title="Shop Purchase Recorded!" />;

  const shopTotal = shopItems.filter(i => i.productName && Number(i.unitCost) >= 0).reduce((s, i) => s + Number(i.unitCost || 0) * Number(i.qty || 1), 0);

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Stock</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['regular','📦 Regular'],['shop','🛍️ Shop Tab']].map(([v, lbl]) => (
          <button key={v} onClick={() => setSubTab(v)} className={`btn btn-sm ${subTab === v ? 'btn-cyan' : 'btn-ghost'}`} style={{ flex: 1 }}>{lbl}</button>
        ))}
      </div>

      {subTab === 'regular' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>ACCESSORY</label>
            <ItemComboBox items={accItems} value={productId} onChange={val => setProductId(val ? String(val) : '')} placeholder="Search accessory…" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>QUANTITY RECEIVED</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ textAlign: 'center', fontWeight: 700, fontSize: 24 }} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
            ℹ️ Purchase price will be set by the owner
          </div>
          <button className="btn btn-cyan" onClick={saveRegularStock} disabled={saving || !productId}>
            {saving ? 'Saving…' : '📦 Save Stock Entry'}
          </button>
        </div>
      )}

      {subTab === 'shop' && shopView === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{shopNames.length} shop{shopNames.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setShopView('add')}>+ Add Entry</button>
          </div>
          {loadingShops && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Loading…</div>}
          {!loadingShops && shopNames.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>No shop tabs yet.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shopNames.map(name => {
              const items   = grouped[name];
              const weOwe   = items.filter(i => i.direction !== 'out').reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);
              const theyOwe = items.filter(i => i.direction === 'out').reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);
              const net     = theyOwe - weOwe;
              return (
                <div key={name} className="card">
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(255,176,32,0.08)', borderRadius: 10, border: '1px solid rgba(255,176,32,0.2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>We owe them</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--amber)' }}>Rs {weOwe.toLocaleString()}</div>
                    </div>
                    <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,230,118,0.08)', borderRadius: 10, border: '1px solid rgba(0,230,118,0.2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>They owe us</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--green)' }}>Rs {theyOwe.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: net === 0 ? 'rgba(112,112,160,0.08)' : net > 0 ? 'rgba(0,230,118,0.08)' : 'rgba(255,176,32,0.08)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>Net balance</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: net === 0 ? 'var(--muted)' : net > 0 ? 'var(--green)' : 'var(--amber)' }}>Rs {Math.abs(net).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{net === 0 ? 'Even' : net > 0 ? 'they owe us' : 'we owe them'}</div>
                    </div>
                  </div>
                  <button className="btn btn-green" style={{ minHeight: 44 }} onClick={() => settleShop(name)} disabled={settling === name || (weOwe === 0 && theyOwe === 0)}>
                    {settling === name ? 'Settling…' : `✓ Settle Tab with ${name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'shop' && shopView === 'add' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => { setShopView('list'); setShopName(''); setShopItems([blankShopItem()]); }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, padding: 0, textAlign: 'left' }}>← Back</button>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>DIRECTION</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['in','📥 We bought from them'],['out','📤 They took from us']].map(([v, lbl]) => (
                  <button key={v} onClick={() => setDirection(v)} className={`btn btn-sm ${direction === v ? (v === 'out' ? 'btn-green' : 'btn-amber') : 'btn-ghost'}`} style={{ flex: 1, fontSize: 11 }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>SHOP NAME *</label>
              <input type="text" placeholder="e.g. Sharma Traders" value={shopName} onChange={e => setShopName(e.target.value)} list="recent-shops-list" />
              <datalist id="recent-shops-list">{recentShops.map(s => <option key={s} value={s} />)}</datalist>
            </div>
          </div>
          {shopItems.map((item, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>ITEM {idx + 1}</span>
                {shopItems.length > 1 && <button onClick={() => setShopItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 20, padding: 0 }}>×</button>}
              </div>
              <ItemComboBox items={accItems} value={item.productId} onChange={val => setShopItem(idx, 'productId', String(val))} placeholder="Search accessory…" />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>QTY</label>
                  <input type="number" min="1" value={item.qty} onChange={e => setShopItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))} style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }} />
                </div>
                <div style={{ flex: 1.5 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>PRICE/UNIT (Rs)</label>
                  <input type="number" min="0" placeholder="0" value={item.unitCost} onChange={e => setShopItem(idx, 'unitCost', e.target.value)} style={{ textAlign: 'right', fontWeight: 700 }} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => setShopItems(p => [...p, blankShopItem()])} style={{ border: '1.5px dashed var(--border)' }}>+ Add Another Item</button>
          {shopTotal > 0 && (
            <div className="card" style={{ background: direction === 'out' ? 'rgba(0,230,118,0.06)' : 'rgba(255,176,32,0.06)', borderColor: direction === 'out' ? 'rgba(0,230,118,0.25)' : 'rgba(255,176,32,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{direction === 'out' ? `${shopName || '…'} owes us` : `We owe ${shopName || '…'}`}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: direction === 'out' ? 'var(--green)' : 'var(--amber)' }}>Rs {shopTotal.toLocaleString()}</span>
            </div>
          )}
          <button className="btn btn-cyan" onClick={saveShopPurchase} disabled={shopSaving}>{shopSaving ? 'Saving…' : '💾 Save Entry'}</button>
        </div>
      )}
    </div>
  );
}

// ─── ACCESSORIES TAB (renamed from Products) ──────────────────────────────────
function AccessoriesTab({ products, reload }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name: '', selling_price: '', photo: '' });
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState('');

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, photo: '' }));
    const compressed = await compressImage(file, 480, 0.6);
    setForm(f => ({ ...f, photo: compressed }));
    e.target.value = '';
  }

  async function addProduct() {
    if (!form.name.trim() || !form.selling_price) { alert('Enter accessory name and selling price'); return; }
    setSaving(true);
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), selling_price: parseFloat(form.selling_price), photo: form.photo || null }) });
    setSaving(false);
    if (res.ok) { setDone(form.name); setForm({ name: '', selling_price: '', photo: '' }); setShowAdd(false); reload(); setTimeout(() => setDone(''), 3000); }
    else alert('Error saving. Try again.');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Accessories</h2>
        <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setShowAdd(p => !p)}>
          {showAdd ? '✕ Cancel' : '+ Add Accessory'}
        </button>
      </div>
      {done && <AlertBox color="green" text={`"${done}" added successfully`} />}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)' }}>New Accessory</div>
          {[['ACCESSORY NAME', 'name', 'text', 'e.g. iPhone 15 Case'], ['SELLING PRICE (Rs)', 'selling_price', 'number', '0']].map(([lbl, key, type, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>{lbl}</label>
              <input type={type} placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>PHOTO — Optional</label>
            {form.photo ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img src={form.photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border)' }} />
                <button onClick={() => setForm(f => ({ ...f, photo: '' }))} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>Remove</button>
              </div>
            ) : (
              <label style={{ display: 'block', cursor: 'pointer', padding: '10px 14px', background: 'rgba(0,212,255,0.06)', border: '1.5px dashed rgba(0,212,255,0.3)', borderRadius: 10, textAlign: 'center', fontSize: 13, color: 'var(--cyan)' }}>
                📷 Take Photo / Choose from Gallery
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
            )}
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
            ℹ️ Purchase cost will be set by the owner
          </div>
          <button className="btn btn-green" onClick={addProduct} disabled={saving}>{saving ? 'Saving…' : 'Save Accessory'}</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {products.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No accessories yet.</div>}
        {products.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            {p.photo && <img src={p.photo} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1.5px solid var(--border)' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                Price: <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {p.selling_price}</span>
                <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
                Stock: <span style={{ color: p.stock < 5 ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>{p.stock}</span>
              </div>
            </div>
            {p.stock < 5 && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, background: 'rgba(255,51,85,0.1)', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>LOW</span>}
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

  useEffect(() => { fetch('/api/phones').then(r => r.json()).then(setPhones); }, []);

  const availablePhones = phones.filter(p => p.status === 'available');
  const soldPhones      = phones.filter(p => p.status === 'sold');

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Returns</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['purchase','↩ Purchase Return'],['salesreturn','↩ Sales Return']].map(([v,l]) => (
          <button key={v} onClick={() => setSubTab(v)} className={`btn btn-sm ${subTab === v ? 'btn-cyan' : 'btn-ghost'}`} style={{ flex: 1 }}>{l}</button>
        ))}
      </div>
      {subTab === 'purchase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ReturnForm title="Accessory Purchase Return" description="Returning accessories to supplier — stock will be deducted." endpoint="/api/returns/purchase" itemType="product" items={products.map(p => ({ id: p.id, label: `${p.name} (stock: ${p.stock})` }))} showQty />
          <ReturnForm title="Phone Purchase Return" description="Returning a stocked phone back to supplier." endpoint="/api/returns/purchase" itemType="phone" items={availablePhones.map(p => ({ id: p.id, label: `${p.model} · ${p.condition}` }))} showQty={false} />
        </div>
      )}
      {subTab === 'salesreturn' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ReturnForm title="Accessory Sales Return" description="Customer returning an accessory — stock will be added back." endpoint="/api/returns/sales" itemType="product" items={products.map(p => ({ id: p.id, label: p.name }))} showQty showAmount />
          <ReturnForm title="Phone Sales Return" description="Customer returning a phone — phone will go back to available." endpoint="/api/returns/sales" itemType="phone" items={soldPhones.map(p => ({ id: p.id, label: `${p.model} · ${p.condition}` }))} showQty={false} showAmount />
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
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemType, itemId: Number(itemId), itemName: selected?.label || '', quantity: Number(quantity), reason, return_amount: showAmount ? (parseFloat(returnAmount) || 0) : 0 }) });
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
          <input type="number" min="0" placeholder="Amount customer paid" value={returnAmount} onChange={e => setReturnAmount(e.target.value)} style={{ textAlign: 'right', fontSize: 16 }} />
        </div>
      )}
      <div>
        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>REASON (optional)</label>
        <input type="text" placeholder="e.g. Defective, wrong item…" value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <button className="btn btn-cyan" onClick={submit} disabled={saving || !itemId}>{saving ? 'Recording…' : 'Record Return'}</button>
    </div>
  );
}

// ─── CREDITS TAB ──────────────────────────────────────────────────────────────
function CreditsTab() {
  const [credits, setCredits]   = useState({ sales: [], repairs: [] });
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
    await fetch('/api/credits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }) });
    setClearing(null);
    setCleared(prev => ({ ...prev, [`${type}-${id}`]: true }));
    setTimeout(() => { setCleared(prev => { const n = { ...prev }; delete n[`${type}-${id}`]; return n; }); loadCredits(); }, 1500);
  }

  const pending = [
    ...(credits.sales  || []).map(s => ({ ...s, _type: 'sale' })),
    ...(credits.repairs || []).map(r => ({ ...r, _type: 'repair' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalPending = pending.reduce((sum, item) => sum + Number(item._type === 'sale' ? item.total_amount : item.customer_price), 0);

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
      {pending.length === 0 && <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)', fontSize: 14 }}><div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>No pending credits!</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map(item => {
          const key = `${item._type}-${item.id}`;
          const isClearing = clearing === key, isCleared = cleared[key];
          const amount = Number(item._type === 'sale' ? item.total_amount : item.customer_price);
          const name   = item._type === 'sale' ? (item.credit_customer || 'Unknown') : item.customer_name;
          const typeLabel = item._type === 'repair' ? 'REPAIR' : 'SALE';
          return (
            <div key={key} className="card" style={{ opacity: isCleared ? 0.5 : 1, transition: 'opacity 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: item._type === 'repair' ? 'rgba(176,96,255,0.12)' : 'rgba(0,212,255,0.12)', color: item._type === 'repair' ? 'var(--purple)' : 'var(--cyan)' }}>{typeLabel}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(item.created_at, { day: 'numeric', month: 'short' })}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{name}</div>
              {item._type === 'sale' && item.items_summary && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{item.items_summary}</div>}
              {item._type === 'repair' && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{item.phone_model} — {item.issue?.slice(0, 50)}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>Rs {amount.toLocaleString()}</span>
                {isCleared ? (
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>✓ Paid!</span>
                ) : (
                  <button className="btn btn-green btn-sm" style={{ width: 'auto', padding: '8px 18px' }} onClick={() => clearCredit(item._type, item.id)} disabled={isClearing}>
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

// ─── PAYMENT BALANCE TAB ──────────────────────────────────────────────────────
function StaffPaymentBalanceTab() {
  const today = nptToday();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [adjustments, setAdjustments] = useState({ Cash: 0, eSewa: 0, 'Bank Transfer': 0, Fonepay: 0 });
  const [savingAdj, setSavingAdj] = useState('');
  const [activeMethod, setActiveMethod] = useState('Cash');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/cash-balance?date=${today}`);
    const d = await r.json();
    setData(d);
    const adjs = {};
    CASH_METHODS.forEach(m => { adjs[m] = d.methods?.[m]?.adjustment ?? 0; });
    setAdjustments(adjs);
    setLoading(false);
  }

  async function saveAdjustment(method) {
    setSavingAdj(method);
    await fetch('/api/cash-balance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, payment_method: method, adjustment: Number(adjustments[method]) || 0 }),
    });
    setSavingAdj('');
    load();
  }

  const fmtDay = dateStr => new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>;
  if (!data) return null;

  const totalBalance = CASH_METHODS.reduce((s, m) => s + (data.methods[m]?.balance || 0), 0);
  const txns = data.methods[activeMethod]?.transactions || [];

  const kindIcon = { sale: '🏷', repair: '🔧', expense: '💸', supplier: '🛒' };

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Payment Balance</h2>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{fmtDay(today)} · Today</div>

      {/* Summary columns table */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '6px 6px', textAlign: 'left', color: 'var(--muted)', fontSize: 10, fontWeight: 700, width: 68 }}></th>
              {CASH_METHODS.map(m => (
                <th key={m} style={{ padding: '6px 4px', textAlign: 'right', color: CASH_COLORS[m], fontSize: 11, fontWeight: 700 }}>
                  {m === 'Bank Transfer' ? 'Bank' : m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 6px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Opening</td>
              {CASH_METHODS.map(m => (
                <td key={m} style={{ padding: '7px 4px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                  {Number(data.methods[m]?.opening || 0).toLocaleString()}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 6px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>In</td>
              {CASH_METHODS.map(m => {
                const v = Number(data.methods[m]?.inflows || 0);
                return (
                  <td key={m} style={{ padding: '7px 4px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: v > 0 ? 'var(--green)' : 'var(--muted)' }}>
                    {v > 0 ? `+${v.toLocaleString()}` : '—'}
                  </td>
                );
              })}
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 6px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Out</td>
              {CASH_METHODS.map(m => {
                const v = m === 'Cash' ? Number(data.methods[m]?.outflows || 0) : 0;
                return (
                  <td key={m} style={{ padding: '7px 4px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                    {v > 0 ? <span style={{ color: 'var(--red)' }}>-{v.toLocaleString()}</span> : '—'}
                  </td>
                );
              })}
            </tr>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <td style={{ padding: '6px 6px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Adjust</td>
              {CASH_METHODS.map(m => (
                <td key={m} style={{ padding: '3px 3px' }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <input type="number" value={adjustments[m]}
                      onChange={e => setAdjustments(a => ({ ...a, [m]: e.target.value }))}
                      style={{ width: 56, padding: '4px 5px', fontSize: 11, textAlign: 'right', borderRadius: 6, minWidth: 0 }} />
                    <button onClick={() => saveAdjustment(m)} disabled={savingAdj === m}
                      style={{ padding: '4px 5px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: 'none', background: CASH_COLORS[m], color: '#000', cursor: 'pointer', opacity: savingAdj === m ? 0.5 : 1, flexShrink: 0 }}>
                      {savingAdj === m ? '…' : '✓'}
                    </button>
                  </div>
                </td>
              ))}
            </tr>
            <tr style={{ background: 'rgba(0,212,255,0.04)' }}>
              <td style={{ padding: '10px 6px', fontSize: 12, fontWeight: 800 }}>Balance</td>
              {CASH_METHODS.map(m => {
                const bal = Number(data.methods[m]?.balance || 0);
                return (
                  <td key={m} style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: bal < 0 ? 'var(--red)' : CASH_COLORS[m] }}>
                    {bal.toLocaleString()}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Grand total */}
      <div className="card" style={{ marginBottom: 16, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>Total All Methods</span>
        <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--cyan)' }}>Rs {totalBalance.toLocaleString()}</span>
      </div>

      {/* All transactions flat list */}
      {(() => {
        const all = CASH_METHODS.flatMap(m =>
          (data.methods[m]?.transactions || [])
            .filter(t => t.kind === 'sale' || t.kind === 'repair')
            .map(t => ({ ...t, method: m }))
        ).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        return (
          <>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
              TODAY'S SALES & REPAIRS ({all.length})
            </div>
            {all.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 12 }}>
                No sales or repairs recorded today
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {all.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{kindIcon[t.kind]} {t.description}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: `${CASH_COLORS[t.method]}22`, color: CASH_COLORS[t.method] }}>
                          {t.method === 'Bank Transfer' ? 'Bank' : t.method}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDateTime(t.time)}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)', flexShrink: 0 }}>
                      +Rs {Number(t.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* Expenses & outflows per method */}
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>OUTFLOWS</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {CASH_METHODS.map(m => (
          <button key={m} onClick={() => setActiveMethod(m)}
            style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, border: `1.5px solid ${activeMethod === m ? CASH_COLORS[m] : 'var(--border)'}`, background: activeMethod === m ? `${CASH_COLORS[m]}22` : 'transparent', color: activeMethod === m ? CASH_COLORS[m] : 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {m === 'Bank Transfer' ? 'Bank' : m}
          </button>
        ))}
      </div>
      {txns.filter(t => t.kind === 'expense' || t.kind === 'supplier').length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 12 }}>
          No outflows for {activeMethod} today
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {txns.filter(t => t.kind === 'expense' || t.kind === 'supplier').map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{kindIcon[t.kind]} {t.description}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmtDateTime(t.time)}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)', flexShrink: 0 }}>
                Rs {Math.abs(t.amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STAFF EXPENSES TAB ───────────────────────────────────────────────────────
function StaffExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm]         = useState({ description: '', amount: '', payment_method: 'Cash' });
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(null);

  const SUGGESTIONS = ['Cleaning', 'Staff Lunch', 'Tea/Snacks', 'Transport', 'Printing', 'Stationary', 'Other'];

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await fetch('/api/expenses?period=month');
    setExpenses(await r.json());
    setLoading(false);
  }

  async function save() {
    if (!form.description.trim()) { alert('Enter a description'); return; }
    if (!form.amount || Number(form.amount) <= 0) { alert('Enter a valid amount'); return; }
    setSaving(true);
    const r = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: form.description.trim(), amount: parseFloat(form.amount), payment_method: form.payment_method }) });
    setSaving(false);
    if (r.ok) { setForm({ description: '', amount: '', payment_method: 'Cash' }); load(); }
    else alert('Error saving. Try again.');
  }

  async function del(id) {
    setDeleting(id);
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    setDeleting(null);
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  const today      = nptToday();
  const todayExp   = expenses.filter(e => e.expense_date === today);
  const earlierExp = expenses.filter(e => e.expense_date !== today);
  const todayTotal = todayExp.reduce((s, e) => s + Number(e.amount), 0);
  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  function fmtExpDate(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Expenses</h2>
      <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyan)' }}>Record Expense</div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>DESCRIPTION</label>
          <input type="text" placeholder="e.g. Staff Lunch" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} list="expense-suggestions" />
          <datalist id="expense-suggestions">{SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>AMOUNT (Rs)</label>
          <input type="number" min="0" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ textAlign: 'right', fontWeight: 700, fontSize: 20 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>PAID FROM</label>
          <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={{ fontWeight: 700 }}>
            {CASH_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <button className="btn btn-cyan" onClick={save} disabled={saving}>{saving ? 'Saving…' : '💸 Add Expense'}</button>
      </div>

      {!loading && expenses.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="card" style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'rgba(255,51,85,0.06)', borderColor: 'rgba(255,51,85,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>Rs {todayTotal.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Today</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'rgba(255,51,85,0.06)', borderColor: 'rgba(255,51,85,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>Rs {monthTotal.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>This Month</div>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Loading…</div>}

      {todayExp.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>TODAY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {todayExp.map(e => <ExpenseRow key={e.id} e={e} onDelete={del} deleting={deleting} showDate={false} />)}
          </div>
        </>
      )}
      {earlierExp.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>EARLIER THIS MONTH</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {earlierExp.map(e => <ExpenseRow key={e.id} e={e} onDelete={del} deleting={deleting} showDate fmtDate={fmtExpDate} />)}
          </div>
        </>
      )}
      {!loading && expenses.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>No expenses recorded this month.</div>}
    </div>
  );
}

function ExpenseRow({ e, onDelete, deleting, showDate, fmtDate }) {
  const [confirm, setConfirm] = useState(false);
  const pm = e.payment_method || 'Cash';
  const pmColor = CASH_COLORS[pm] || 'var(--muted)';
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{e.description}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: `${pmColor}22`, color: pmColor }}>
            {pm === 'Bank Transfer' ? 'Bank' : pm}
          </span>
          {showDate && fmtDate && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(e.expense_date)}</span>}
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', flexShrink: 0 }}>Rs {Number(e.amount).toLocaleString()}</div>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '4px 8px', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>×</button>
      ) : (
        <button onClick={() => { setConfirm(false); onDelete(e.id); }} disabled={deleting === e.id} style={{ background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {deleting === e.id ? '…' : 'Del?'}
        </button>
      )}
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
