import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { enqueue, dequeue, getQueue, queueSize } from '../lib/offline-queue';
function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

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
  { id: 'history',     label: '👤 History' },
  { id: 'notes', label: '📝 Notes' },
];

const PAYMENTS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay', 'Credit'];
const SPLIT_METHODS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'];
const PAYMENT_COLORS = {
  Cash: 'var(--green)', eSewa: 'var(--cyan)',
  'Bank Transfer': 'var(--purple)', Fonepay: 'var(--amber)', Credit: 'var(--red)',
};
const CASH_METHODS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'];
const CASH_COLORS  = { Cash: 'var(--green)', eSewa: 'var(--cyan)', 'Bank Transfer': 'var(--purple)', Fonepay: 'var(--amber)' };
const STATUSES = ['Pending', 'In Progress', 'Done', 'Delivered', 'Returned'];
const PRIMARY_TAB_IDS = ['sale', 'repair'];
const MENU_TABS = TABS.filter(t => !PRIMARY_TAB_IDS.includes(t.id));

// ─── TOAST ────────────────────────────────────────────────────────────────────
let _showToast = null;
function showToast(msg, type = 'error') { _showToast?.(msg, type); }

// ─── OFFLINE SYNC TRIGGER ─────────────────────────────────────────────────────
let _onOfflineSave = null;
function notifyOfflineSave() { _onOfflineSave?.(); }

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
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['sale']));
  const [aiTip, setAiTip]       = useState(null);
  const [aiTipDismissed, setAiTipDismissed] = useState(false);
  function switchTab(id) {
    setTab(id);
    setMountedTabs(prev => { const s = new Set(prev); s.add(id); return s; });
  }
  const [products, setProducts] = useState([]);
  const [phones, setPhones]     = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [toastState, setToastState] = useState(null);
  const toastTimer = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline]       = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus]   = useState('idle'); // 'idle'|'syncing'|'done'


  useEffect(() => {
    // Register global toast function
    _showToast = (msg, type) => {
      clearTimeout(toastTimer.current);
      setToastState({ msg, type });
      toastTimer.current = setTimeout(() => setToastState(null), 2800);
    };

    loadProducts();
    loadPhones();
    loadToday();
    // Show cached tip instantly, only re-fetch if older than 1 hour
    try {
      const cachedTip = localStorage.getItem('pos_ai_tip');
      const tipTime   = Number(localStorage.getItem('pos_ai_tip_time') || 0);
      if (cachedTip && Date.now() - tipTime < 3600000) { setAiTip(cachedTip); }
      else {
        fetch('/api/ai/staff-tip').then(r => r.json()).then(d => {
          if (d.tip) {
            setAiTip(d.tip);
            try { localStorage.setItem('pos_ai_tip', d.tip); localStorage.setItem('pos_ai_tip_time', String(Date.now())); } catch {}
          }
        }).catch(() => {});
      }
    } catch {
      fetch('/api/ai/staff-tip').then(r => r.json()).then(d => { if (d.tip) setAiTip(d.tip); }).catch(() => {});
    }
    const iv = setInterval(loadToday, 60000);

    // Offline queue
    _onOfflineSave = () => setPendingCount(queueSize());
    setIsOnline(navigator.onLine);
    setPendingCount(queueSize());

    async function syncQueue() {
      const queue = getQueue();
      if (!queue.length) return;
      setSyncStatus('syncing');
      let ok = 0, fail = 0;
      for (const item of queue) {
        try {
          const endpoint = item.type === 'sale' ? '/api/sales' : '/api/repairs';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
          });
          if (res.ok) { dequeue(item.id); ok++; }
          else fail++;
        } catch { fail++; }
      }
      setPendingCount(queueSize());
      if (ok > 0) showToast(`Synced ${ok} offline entr${ok === 1 ? 'y' : 'ies'}`, 'success');
      if (fail > 0) showToast(`${fail} entr${fail === 1 ? 'y' : 'ies'} failed to sync — retry manually`, 'error');
      setSyncStatus(ok > 0 ? 'done' : 'idle');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }

    function onOnline()  { setIsOnline(true);  syncQueue(); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine && queueSize() > 0) syncQueue();

    return () => {
      _showToast = null;
      _onOfflineSave = null;
      clearTimeout(toastTimer.current);
      clearInterval(iv);
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  function loadToday() {
    fetch('/api/today').then(r => r.ok ? r.json() : null).then(d => { if (d) setTodayData(d); });
  }

  function loadProducts() {
    try { const c = JSON.parse(localStorage.getItem('pos_products') || 'null'); if (c?.length) setProducts(c); } catch {}
    fetch('/api/products').then(r => r.json()).then(data => {
      setProducts(data);
      try { localStorage.setItem('pos_products', JSON.stringify(data)); } catch {}
    });
  }
  function loadPhones() {
    try { const c = JSON.parse(localStorage.getItem('pos_phones') || 'null'); if (c?.length) setPhones(c); } catch {}
    fetch('/api/phones?slim=1').then(r => r.json()).then(data => {
      const avail = (data || []).filter(p => p.status === 'available' && Number(p.selling_price) > 0);
      setPhones(avail);
      try { localStorage.setItem('pos_phones', JSON.stringify(avail)); } catch {}
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

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Hamburger */}
            <button onClick={() => setMenuOpen(p => !p)}
              style={{ background: menuOpen ? 'rgba(0,212,255,0.12)' : 'transparent', border: `1.5px solid ${menuOpen ? 'var(--cyan)' : 'var(--border)'}`, borderRadius: 8, color: menuOpen ? 'var(--cyan)' : 'var(--text)', padding: '5px 10px', cursor: 'pointer', fontSize: 17, lineHeight: 1, fontWeight: 700, flexShrink: 0 }}>
              {menuOpen ? '✕' : '☰'}
            </button>
            {/* Active section label — shows current menu tab name, or app name when on primary tab */}
            {(() => {
              const active = MENU_TABS.find(t => t.id === tab);
              return active
                ? <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 15 }}>{active.label}</span>
                : <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 15 }}>📱 Shop POS <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 400 }}>Staff</span></span>;
            })()}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={logout} className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '6px 12px' }}>Logout</button>
          </div>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 24, background: 'rgba(0,0,0,0.35)' }} />
            <div style={{ position: 'fixed', top: 53, left: 0, right: 0, zIndex: 25, maxWidth: 480, margin: '0 auto' }}>
              <div style={{ background: 'var(--card)', borderRadius: '0 0 16px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
                {MENU_TABS.map((t, i) => (
                  <button key={t.id} onClick={() => { switchTab(t.id); setMenuOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', textAlign: 'left',
                      background: tab === t.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                      border: 'none', borderBottom: i < MENU_TABS.length - 1 ? '1px solid var(--border)' : 'none',
                      color: tab === t.id ? 'var(--cyan)' : 'var(--text)',
                      fontSize: 15, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer' }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{t.label.split(' ')[0]}</span>
                    <span>{t.label.split(' ').slice(1).join(' ')}</span>
                    {tab === t.id && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--cyan)' }}>● active</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!isOnline && (
          <div style={{ background: '#dc2626', color: '#fff', fontSize: 12, padding: '7px 16px', fontWeight: 700, textAlign: 'center', letterSpacing: 0.3 }}>
            📵 Offline — sales & repairs will sync when reconnected{pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
          </div>
        )}
        {isOnline && syncStatus === 'syncing' && (
          <div style={{ background: '#d97706', color: '#fff', fontSize: 12, padding: '7px 16px', fontWeight: 700, textAlign: 'center' }}>
            🔄 Syncing offline entries…
          </div>
        )}
        {isOnline && syncStatus === 'done' && (
          <div style={{ background: 'var(--green)', color: '#fff', fontSize: 12, padding: '7px 16px', fontWeight: 700, textAlign: 'center' }}>
            ✓ All offline entries synced
          </div>
        )}
        {isOnline && pendingCount > 0 && syncStatus === 'idle' && (
          <div style={{ background: 'rgba(255,176,32,0.15)', color: 'var(--amber)', fontSize: 12, padding: '7px 16px', fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(255,176,32,0.3)' }}>
            ⏳ {pendingCount} offline entr{pendingCount === 1 ? 'y' : 'ies'} pending sync
          </div>
        )}

        {/* Primary tab bar — Sale and Repair only */}
        <div className="tab-bar">
          {TABS.filter(t => PRIMARY_TAB_IDS.includes(t.id)).map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              style={{ fontSize: 13, flex: 1, minWidth: 0 }} onClick={() => switchTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {todayData?.targets && (() => {
          const bars = [
            { label: '📱', actual: todayData.phonesQty,      target: todayData.targets.phonesQty,      fmt: v => `${v} sold` },
            { label: '🏷', actual: todayData.accessoriesAmt, target: todayData.targets.accessoriesAmt, fmt: v => `Rs ${Math.round(v).toLocaleString()}` },
            { label: '🔧', actual: todayData.repairsAmt,     target: todayData.targets.repairsAmt,     fmt: v => `Rs ${Math.round(v).toLocaleString()}` },
          ].filter(b => b.target > 0);
          if (!bars.length) return null;
          return (
            <div style={{ padding: '6px 16px 6px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {bars.map(({ label, actual, target, fmt }) => {
                const pct = Math.min(100, (actual / target) * 100);
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>
                      <span>{label} {fmt(actual)}</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--cyan)' : 'var(--amber)', borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {aiTip && !aiTipDismissed && (
          <div style={{ margin: '0 16px 0', padding: '10px 14px', background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🤖</span>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, lineHeight: 1.5 }}>{aiTip}</span>
            <button onClick={() => setAiTipDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}>×</button>
          </div>
        )}

        <div style={{ padding: '16px' }}>
          {mountedTabs.has('sale')        && <div style={{ display: tab==='sale'        ? 'block':'none' }}><SaleTab products={products} phones={phones} /></div>}
          {mountedTabs.has('phones')      && <div style={{ display: tab==='phones'      ? 'block':'none' }}><PhonesTab onPhoneSold={loadPhones} /></div>}
          {mountedTabs.has('repair')      && <div style={{ display: tab==='repair'      ? 'block':'none' }}><RepairTab /></div>}
          {mountedTabs.has('stock')       && <div style={{ display: tab==='stock'       ? 'block':'none' }}><StockTab products={products} /></div>}
          {mountedTabs.has('accessories') && <div style={{ display: tab==='accessories' ? 'block':'none' }}><AccessoriesTab products={products} reload={loadProducts} /></div>}
          {mountedTabs.has('returns')     && <div style={{ display: tab==='returns'     ? 'block':'none' }}><ReturnsTab products={products} /></div>}
          {mountedTabs.has('credits')     && <div style={{ display: tab==='credits'     ? 'block':'none' }}><CreditsTab /></div>}
          {mountedTabs.has('balance')     && <div style={{ display: tab==='balance'     ? 'block':'none' }}><StaffPaymentBalanceTab /></div>}
          {mountedTabs.has('expenses')    && <div style={{ display: tab==='expenses'    ? 'block':'none' }}><StaffExpensesTab /></div>}
          {mountedTabs.has('history')     && <div style={{ display: tab==='history'     ? 'block':'none' }}><CustomerHistoryTab /></div>}
          {mountedTabs.has('notes')       && <div style={{ display: tab==='notes'       ? 'block':'none' }}><NotesTab products={products} phones={phones} onPhoneChange={loadPhones} /></div>}
        </div>

        {/* Global toast notification */}
        {toastState && (
          <div onClick={() => { clearTimeout(toastTimer.current); setToastState(null); }}
            style={{ position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)',
              background: toastState.type === 'success' ? 'var(--green)' : 'var(--red)',
              color: '#fff', padding: '10px 22px', borderRadius: 50,
              fontSize: 14, fontWeight: 700, zIndex: 9999,
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)', cursor: 'pointer',
              whiteSpace: 'nowrap', maxWidth: '88vw', textAlign: 'center' }}>
            {toastState.type === 'success' ? '✓ ' : '⚠ '}{toastState.msg}
          </div>
        )}
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
  const [payMode, setPayMode]         = useState('single');
  const [singleMethod, setSingleMethod] = useState('');
  const [splits, setSplits]           = useState([{ method: '', amount: '' }, { method: '', amount: '' }]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saving, setSaving]           = useState(false);
  const savingRef                     = useRef(false);
  const [done, setDone]               = useState(false);
  const [payError, setPayError]       = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyQuery, setLoyaltyQuery]     = useState('');
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
  const [loyaltySearching, setLoyaltySearching] = useState(false);
  const [usePoints, setUsePoints]           = useState(false);
  const [loyaltyNotFound, setLoyaltyNotFound] = useState(false);
  const [regForm, setRegForm]               = useState({ name: '', phone: '' });
  const [regSaving, setRegSaving]           = useState(false);
  const [regError, setRegError]             = useState('');

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

  const maxLoyaltyPts = loyaltyCustomer ? Math.min(loyaltyCustomer.points, Math.floor(grandTotal / 10) * 100) : 0;
  const loyaltyDiscount = usePoints && loyaltyCustomer && maxLoyaltyPts >= 100
    ? Math.floor(maxLoyaltyPts / 100) * 10 : 0;
  const finalTotal = Math.max(0, grandTotal - loyaltyDiscount);

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

  useEffect(() => {
    fetch('/api/settings?key=loyalty_enabled')
      .then(r => r.json()).then(d => setLoyaltyEnabled(d.value === '1')).catch(() => {});
  }, []);

  async function lookupLoyaltyCustomer() {
    if (!loyaltyQuery.trim()) return;
    setLoyaltySearching(true);
    setLoyaltyNotFound(false);
    const r = await fetch(`/api/customers/lookup?q=${encodeURIComponent(loyaltyQuery.trim())}`);
    setLoyaltySearching(false);
    if (r.ok) {
      const c = await r.json();
      setLoyaltyCustomer(c);
      setLoyaltyNotFound(false);
      if (!customerName.trim()) setCustomerName(c.name);
      if (!customerPhone.trim()) setCustomerPhone(c.phone);
    } else {
      setLoyaltyNotFound(true);
      setRegForm({ name: '', phone: loyaltyQuery.trim().startsWith('AES') ? '' : loyaltyQuery.trim() });
      setRegError('');
    }
  }

  async function registerAndAddLoyalty(e) {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.phone.trim()) return;
    setRegSaving(true);
    setRegError('');
    const r = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regForm.name.trim(), phone: regForm.phone.trim() }),
    });
    setRegSaving(false);
    if (r.ok) {
      const c = await r.json();
      setLoyaltyCustomer(c);
      setLoyaltyNotFound(false);
      setLoyaltyQuery('');
      if (!customerName.trim()) setCustomerName(c.name);
      if (!customerPhone.trim()) setCustomerPhone(c.phone);
    } else {
      const d = await r.json();
      setRegError(d.error || 'Registration failed');
    }
  }

  function handleBarcode(raw) {
    const parsed = parseCode(raw);
    if (!parsed) { showToast(`Unrecognised barcode: ${raw}`); return; }

    if (parsed.type === 'product') {
      const prod = products.find(p => p.id === parsed.id);
      if (!prod) { showToast('Product not found'); return; }
      setItems(prev => {
        const next = [...prev];
        const existIdx = next.findIndex(i => i.type === 'accessory' && String(i.productId) === String(prod.id));
        if (existIdx >= 0) {
          next[existIdx] = { ...next[existIdx], qty: (Number(next[existIdx].qty) || 1) + 1 };
        } else {
          const emptyIdx = next.findIndex(i => !i.productId && !i.phoneId);
          const newItem  = { type: 'accessory', productId: String(prod.id), phoneId: '', qty: 1, price: prod.selling_price, discount: '', name: prod.name };
          if (emptyIdx >= 0) next[emptyIdx] = newItem;
          else next.push(newItem);
        }
        return next;
      });
    } else {
      const phone = phones.find(p => p.id === parsed.id);
      if (!phone) { showToast('Phone not found or not available'); return; }
      setItems(prev => {
        const next = [...prev];
        const emptyIdx = next.findIndex(i => !i.productId && !i.phoneId);
        const newItem  = { type: 'phone', productId: '', phoneId: String(phone.id), qty: 1, price: Number(phone.selling_price), discount: '', name: phone.model };
        if (emptyIdx >= 0) next[emptyIdx] = newItem;
        else next.push(newItem);
        return next;
      });
    }
  }

  async function saveSale() {
    if (savingRef.current) return;
    if (!activeItems.length) { showToast('Add at least one item'); return; }
    if (!customerName.trim()) { setPayError('name'); return; }
    if (!customerPhone.trim()) { setPayError('phone'); return; }

    let payForBody, splitPaymentsForBody = null;
    if (payMode === 'single') {
      if (!singleMethod) { setPayError('method'); return; }
      payForBody = singleMethod;
    } else {
      const validSplits = splits.filter(s => s.method && Number(s.amount) > 0);
      if (validSplits.length < 2) { setPayError('method'); return; }
      const splitTotal = validSplits.reduce((s, x) => s + Number(x.amount), 0);
      if (Math.abs(splitTotal - grandTotal) > 0.5) { setPayError('amount'); return; }
      payForBody = validSplits[0].method;
      splitPaymentsForBody = validSplits;
    }

    const isCredit = payMode === 'single' && singleMethod === 'Credit';

    // Client-side stock check
    for (const item of activeItems) {
      if (item.type === 'accessory') {
        const prod = products.find(p => String(p.id) === String(item.productId));
        if (prod && prod.stock < (item.qty || 1)) {
          showToast(`Not enough stock for ${prod.name}. Only ${prod.stock} left.`);
          return;
        }
      }
    }

    // Warn if any accessory has no cost price (won't block sale)
    const zeroCost = activeItems.filter(i => {
      if (i.type !== 'accessory') return false;
      const prod = products.find(p => String(p.id) === String(i.productId));
      return prod && Number(prod.cost_price) === 0;
    });
    if (zeroCost.length > 0) {
      showToast(`⚠ No cost price for: ${zeroCost.map(i => i.name).join(', ')} — profit will show as 0`, 'error');
    }

    const paymentLabel = splitPaymentsForBody
      ? splitPaymentsForBody.map(s => `${s.method} Rs${Number(s.amount).toLocaleString()}`).join(' + ')
      : singleMethod;

    const saleBody = {
      items: activeItems.map(i => ({
        type: i.type,
        productId: i.type === 'accessory' ? Number(i.productId) : undefined,
        phoneId:   i.type === 'phone'      ? Number(i.phoneId)   : undefined,
        qty:   i.type === 'phone' ? 1 : i.qty,
        price: i.price,
        itemDiscount: Math.min(Math.max(0, parseFloat(i.discount) || 0), i.price * (i.type === 'phone' ? 1 : i.qty)),
      })),
      payment: payForBody,
      splitPayments: splitPaymentsForBody,
      customerName,
      customerPhone,
      creditCustomer: isCredit ? customerName : '',
      creditCustomerPhone: isCredit ? customerPhone : '',
      loyaltyDiscount,
    };

    const receiptItems = activeItems.map(i => ({
      name:  i.name || '?',
      qty:   i.type === 'phone' ? 1 : Number(i.qty),
      price: Number(i.price),
    }));

    // Offline path — queue and show receipt immediately
    if (!navigator.onLine) {
      enqueue('sale', saleBody);
      notifyOfflineSave();
      setDone({ items: receiptItems, total: grandTotal, payment: paymentLabel, discount: totalDiscount, customerName, offline: true });
      showToast(`Saved offline — will sync when connected`, 'success');
      return;
    }

    setPayError('');
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleBody),
      });
      const saleData = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ items: receiptItems, total: finalTotal, payment: paymentLabel, discount: totalDiscount, loyaltyDiscount, customerName });
        showToast(`Sale saved — Rs ${Math.round(finalTotal).toLocaleString()}`, 'success');
        if (loyaltyCustomer) {
          fetch('/api/loyalty/award', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: loyaltyCustomer.id, sale_id: saleData.id, amount: grandTotal, loyalty_discount: loyaltyDiscount }),
          }).catch(() => {});
        }
      } else {
        showToast(saleData.error || 'Error saving sale. Try again.');
      }
    } catch {
      showToast('Network error. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function resetSale() {
    setItems([emptyItem(), emptyItem()]);
    setPayMode('single');
    setSingleMethod('');
    setSplits([{ method: '', amount: '' }, { method: '', amount: '' }]);
    setCustomerName('');
    setCustomerPhone('');
    setPayError('');
    setDone(false);
    setLoyaltyQuery('');
    setLoyaltyCustomer(null);
    setUsePoints(false);
    setLoyaltyNotFound(false);
    setRegForm({ name: '', phone: '' });
    setRegError('');
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{done.offline ? '📵' : '✅'}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: done.offline ? 'var(--amber)' : 'var(--green)' }}>
        {done.offline ? 'Saved Offline!' : 'Sale Saved!'}
      </div>
      <div style={{ color: 'var(--muted)', marginTop: 6 }}>
        Rs {done.total?.toFixed(0)} · {done.payment}
        {done.offline && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>Will sync automatically when connected</div>}
      </div>
      <button onClick={resetSale} className="btn btn-green"
        style={{ marginTop: 10, width: '100%', padding: '16px 0', fontSize: 17, fontWeight: 700 }}>
        + New Sale
      </button>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Sale</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{items.length} rows</span>
      </div>

      {/* Barcode scanner input */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input
          ref={barcodeRef}
          value={barcodeInput}
          onChange={e => setBarcodeInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && barcodeInput.trim()) {
              handleBarcode(barcodeInput.trim());
              setBarcodeInput('');
            }
          }}
          placeholder="📷 Scan barcode or type code + Enter"
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, letterSpacing: 1 }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
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
              {totalDiscount > 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Item discount Rs {totalDiscount.toLocaleString()}</div>}
              {loyaltyDiscount > 0 && <div style={{ fontSize: 11, color: 'var(--amber)' }}>Loyalty pts −Rs {loyaltyDiscount.toLocaleString()}</div>}
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--cyan)' }}>Rs {finalTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Customer — always required */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: payError === 'name' ? 'var(--red)' : 'var(--muted)' }}>
            {payError === 'name' ? '⚠ CUSTOMER NAME (required)' : 'CUSTOMER NAME'}
          </label>
          <input type="text" placeholder="e.g. Ram Bahadur" value={customerName}
            onChange={e => { setCustomerName(e.target.value); if (payError === 'name') setPayError(''); }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: payError === 'phone' ? 'var(--red)' : 'var(--muted)' }}>
            {payError === 'phone' ? '⚠ CUSTOMER PHONE (required)' : 'CUSTOMER PHONE'}
          </label>
          <input type="tel" placeholder="e.g. 98XXXXXXXX" value={customerPhone}
            onChange={e => { setCustomerPhone(e.target.value); if (payError === 'phone') setPayError(''); }} />
        </div>
      </div>

      {/* Loyalty card lookup */}
      {loyaltyEnabled && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>LOYALTY CARD</div>
          {loyaltyCustomer ? (
            <div style={{ background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{loyaltyCustomer.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {loyaltyCustomer.card_number} · {loyaltyCustomer.points} pts
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 6, color: '#000',
                    background: loyaltyCustomer.tier === 'Platinum' ? 'linear-gradient(135deg,#334155,#93C5FD)' : loyaltyCustomer.tier === 'Gold' ? 'linear-gradient(135deg,#92400E,#FCD34D)' : 'linear-gradient(135deg,#475569,#CBD5E1)' }}>
                    {loyaltyCustomer.tier}
                  </span>
                  <button onClick={() => { setLoyaltyCustomer(null); setUsePoints(false); setLoyaltyQuery(''); setLoyaltyNotFound(false); }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                </div>
              </div>
              {maxLoyaltyPts >= 100 && (
                <button onClick={() => setUsePoints(p => !p)}
                  style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                    border: `1.5px solid ${usePoints ? 'var(--green)' : 'var(--border)'}`,
                    background: usePoints ? 'rgba(0,230,118,0.1)' : 'transparent',
                    color: usePoints ? 'var(--green)' : 'var(--muted)' }}>
                  {usePoints
                    ? `✓ Using ${Math.floor(maxLoyaltyPts/100)*100} pts = Rs ${loyaltyDiscount} off`
                    : `Use ${Math.floor(maxLoyaltyPts/100)*100} pts = Rs ${Math.floor(maxLoyaltyPts/100)*10} off`}
                </button>
              )}
              {maxLoyaltyPts < 100 && loyaltyCustomer.points > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  {loyaltyCustomer.points} pts — need 100 pts minimum to redeem
                </div>
              )}
              {loyaltyCustomer.points === 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>No points yet — will earn from this sale</div>
              )}
            </div>
          ) : loyaltyNotFound ? (
            <div style={{ background: 'rgba(255,99,71,0.06)', border: '1px solid rgba(255,99,71,0.25)', borderRadius: 10, padding: '12px' }}>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>No card found — Register New Customer</div>
              <form onSubmit={registerAndAddLoyalty} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input required placeholder="Customer name *" value={regForm.name}
                  onChange={e => setRegForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                <input required placeholder="Phone number *" value={regForm.phone}
                  onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} />
                {regError && <div style={{ fontSize: 12, color: 'var(--red)' }}>⚠ {regError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setLoyaltyNotFound(false); setLoyaltyQuery(''); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={regSaving}
                    style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {regSaving ? 'Registering…' : 'Register & Add'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Phone number or Card No. (AES-XXXX)"
                value={loyaltyQuery} onChange={e => setLoyaltyQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupLoyaltyCustomer()}
                style={{ flex: 1 }} />
              <button onClick={lookupLoyaltyCustomer} className="btn btn-sm" style={{ padding: '10px 14px', flexShrink: 0 }} disabled={loyaltySearching}>
                {loyaltySearching ? '…' : 'Find'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment method */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: (payError === 'method' || payError === 'amount') ? 'var(--red)' : 'var(--muted)' }}>
          {payError === 'method' ? '⚠ SELECT PAYMENT METHOD' : payError === 'amount' ? `⚠ AMOUNTS MUST EQUAL Rs ${Math.round(grandTotal).toLocaleString()}` : 'PAYMENT METHOD'}
        </div>
        {payMode === 'single' ? (
          <>
            <select value={singleMethod || ''} onChange={e => { setSingleMethod(e.target.value); setPayError(''); }} style={{ fontWeight: 700, marginBottom: singleMethod && singleMethod !== 'Credit' ? 8 : 0 }}>
              <option value="" disabled>Select payment method…</option>
              {PAYMENTS.map(p => <option key={p}>{p}</option>)}
            </select>
            {singleMethod && singleMethod !== 'Credit' && (
              <button onClick={() => setPayMode('split')}
                style={{ width: '100%', padding: '9px 0', borderRadius: 10, background: 'transparent', border: '1.5px dashed var(--border)', color: 'var(--cyan)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ÷ Split Payment
              </button>
            )}
          </>
        ) : (
          <>
            {splits.map((s, i) => {
              const prevAmt = splits.slice(0, i).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
              const autoAmt = Math.max(0, grandTotal - prevAmt);
              return (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select value={s.method} onChange={e => setSplits(prev => prev.map((x, j) => j === i ? { ...x, method: e.target.value } : x))} style={{ flex: 1 }}>
                    <option value="">Select…</option>
                    {SPLIT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input
                    type="number" min="0"
                    value={s.amount}
                    placeholder={String(Math.round(autoAmt))}
                    onChange={e => { setSplits(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x)); setPayError(''); }}
                    style={{ width: 90, textAlign: 'right' }}
                  />
                  {splits.length > 2 && (
                    <button onClick={() => setSplits(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 22, padding: '0 4px', lineHeight: 1 }}>×</button>
                  )}
                </div>
              );
            })}
            {(() => {
              const assigned = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
              const rem = grandTotal - assigned;
              const ok = Math.abs(rem) < 0.5;
              return (
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: ok ? 'var(--green)' : 'var(--amber)' }}>
                  {ok ? '✓ Amounts match total' : `Rs ${Math.abs(Math.round(rem)).toLocaleString()} ${rem > 0 ? 'remaining' : 'over total'}`}
                </div>
              );
            })()}
            {splits.length < 3 && (
              <button onClick={() => setSplits(prev => [...prev, { method: '', amount: '' }])}
                style={{ width: '100%', padding: '8px 0', borderRadius: 10, background: 'transparent', border: '1.5px dashed var(--border)', color: 'var(--muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                + Add Method
              </button>
            )}
            <button onClick={() => { setPayMode('single'); setSingleMethod(''); setSplits([{ method: '', amount: '' }, { method: '', amount: '' }]); setPayError(''); }}
              style={{ width: '100%', padding: '8px 0', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              ← Use Single Method
            </button>
          </>
        )}
      </div>

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
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState('');
  const [sortBy, setSortBy]     = useState('recents');
  const [search, setSearch]     = useState('');
  const BLANK_STOCK = { brand: '', phoneModel: '', ram: '', storage: '', condition: 'Good', color: '', imei: '', notes: '' };
  const [showPhoneConfirm, setShowPhoneConfirm] = useState(false);
  const [stockForm, setStockForm] = useState(BLANK_STOCK);
  const [shareToast, setShareToast]       = useState('');
  const [shareMode, setShareMode]         = useState(false);
  const [shareSelection, setShareSelection] = useState(new Set());
  const [phonesLoading, setPhonesLoading] = useState(true);
  useEffect(() => { loadPhones(); }, []);

  function loadPhones() {
    setPhonesLoading(true);
    fetch('/api/phones').then(r => r.json()).then(d => { setPhones(d); setPhonesLoading(false); });
  }

  function toggleShareSelect(id) {
    setShareSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (shareSelection.size === filteredPhones.length) setShareSelection(new Set());
    else setShareSelection(new Set(filteredPhones.map(p => p.id)));
  }

  function exitShareMode() { setShareMode(false); setShareSelection(new Set()); }

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

  function parsePhotos(p) {
    try { return p.photos ? JSON.parse(p.photos) : []; } catch { return []; }
  }

  async function sharePhone(p) {
    const txt = `📱 ${p.model}\nCondition: ${p.condition}\nPrice: Rs ${Number(p.selling_price).toLocaleString()}${p.notes ? '\nNotes: ' + p.notes : ''}`;
    const photos = parsePhotos(p);
    if (navigator.share) {
      try {
        const shareData = { text: txt };
        if (photos.length > 0 && navigator.canShare) {
          const slug = p.model.replace(/\s+/g, '-').slice(0, 40);
          const files = await Promise.all(photos.map((src, i) => dataUrlToFile(src, `${slug}-${i + 1}.jpg`)));
          if (navigator.canShare({ files })) shareData.files = files;
        }
        await navigator.share(shareData);
        return;
      } catch {}
    }
    try { await navigator.clipboard.writeText(txt); } catch {}
    setShareToast(p.id);
    setTimeout(() => setShareToast(''), 2200);
  }

  async function shareSelected() {
    const selected = filteredPhones.filter(p => shareSelection.has(p.id));
    if (!selected.length) return;
    const lines = selected.map((p, i) =>
      `${i + 1}. ${p.model}\n   Condition: ${p.condition} · Rs ${Number(p.selling_price).toLocaleString()}${p.notes ? '\n   ' + p.notes : ''}`
    ).join('\n\n');
    const txt = `📱 Available Used Phones\n\n${lines}`;
    if (navigator.share) {
      try {
        const shareData = { text: txt };
        if (navigator.canShare) {
          const files = [];
          for (const p of selected) {
            const photos = parsePhotos(p);
            const slug = p.model.replace(/\s+/g, '-').slice(0, 30);
            for (let i = 0; i < photos.length; i++) {
              files.push(await dataUrlToFile(photos[i], `${slug}-${i + 1}.jpg`));
            }
          }
          if (files.length > 0 && navigator.canShare({ files })) shareData.files = files;
        }
        await navigator.share(shareData);
        exitShareMode();
        return;
      } catch {}
    }
    try { await navigator.clipboard.writeText(txt); } catch {}
    setShareToast('multi');
    setTimeout(() => { setShareToast(''); exitShareMode(); }, 2200);
  }

  function reviewPhone() {
    if (!stockForm.brand.trim())     { showToast('Enter brand'); return; }
    if (!stockForm.phoneModel.trim()){ showToast('Enter model'); return; }
    if (!stockForm.ram)              { showToast('Select RAM'); return; }
    if (!stockForm.storage)          { showToast('Select storage'); return; }
    if (!stockForm.color.trim())     { showToast('Enter color'); return; }
    if (!stockForm.imei.trim())      { showToast('Enter IMEI'); return; }
    setShowPhoneConfirm(true);
  }

  async function stockIn() {
    const model = `${stockForm.brand.trim()} ${stockForm.phoneModel.trim()} ${stockForm.ram}/${stockForm.storage}`;
    setSaving(true);
    const res = await fetch('/api/phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, condition: stockForm.condition, color: stockForm.color.trim(), imei: stockForm.imei.trim(), notes: stockForm.notes }),
    });
    setSaving(false);
    if (res.ok) {
      showToast('Phone stocked', 'success');
      setDone('stocked');
      setStockForm(BLANK_STOCK);
      setShowPhoneConfirm(false);
      setView('list');
      loadPhones();
      setTimeout(() => setDone(''), 3000);
    } else showToast('Error. Try again.');
  }

  if (view === 'stockin' && showPhoneConfirm) {
    const previewModel = `${stockForm.brand.trim()} ${stockForm.phoneModel.trim()} ${stockForm.ram}/${stockForm.storage}`;
    return (
      <div>
        <button onClick={() => setShowPhoneConfirm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, marginBottom: 16, padding: 0 }}>← Edit</button>
        <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Confirm Before Saving</h2>
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>
          ⚠ Spelling and specs cannot be edited after saving. Go back if anything is wrong.
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>MODEL</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{previewModel}</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>CONDITION</div><div style={{ fontSize: 15, fontWeight: 700 }}>{stockForm.condition}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>COLOR</div><div style={{ fontSize: 15, fontWeight: 700 }}>{stockForm.color}</div></div>
          </div>
          <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>IMEI</div><div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{stockForm.imei}</div></div>
          {stockForm.notes ? <div><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>NOTES</div><div style={{ fontSize: 13 }}>{stockForm.notes}</div></div> : null}
        </div>
        <button className="btn btn-green" onClick={stockIn} disabled={saving} style={{ fontSize: 16, minHeight: 54 }}>
          {saving ? 'Saving…' : '✅ Looks correct — Save Phone'}
        </button>
        <button onClick={() => setShowPhoneConfirm(false)} className="btn btn-ghost" style={{ marginTop: 10, width: '100%' }}>← Go back and edit</button>
      </div>
    );
  }

  if (view === 'stockin') {
    const chipStyle = (selected) => ({
      minHeight: 44, padding: '0 14px', fontSize: 14, fontWeight: 700, borderRadius: 10,
      border: '1.5px solid ' + (selected ? 'var(--cyan)' : 'var(--border)'),
      background: selected ? 'rgba(0,212,255,0.15)' : 'transparent',
      color: selected ? 'var(--cyan)' : 'var(--muted)', cursor: 'pointer',
    });
    return (
      <div>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, marginBottom: 16, padding: 0 }}>← Back</button>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Stock In Used Phone</h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>BRAND *</label>
              <input type="text" placeholder="Apple, Samsung…"
                value={stockForm.brand} onChange={e => setStockForm(f => ({ ...f, brand: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('phone-model-input')?.focus()} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>MODEL *</label>
              <input id="phone-model-input" type="text" placeholder="iPhone 15, S24…"
                value={stockForm.phoneModel} onChange={e => setStockForm(f => ({ ...f, phoneModel: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8, fontWeight: 700 }}>RAM *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['2GB','3GB','4GB','6GB','8GB','10GB','12GB','16GB'].map(v => (
                <button key={v} type="button" onClick={() => setStockForm(f => ({ ...f, ram: v }))} style={chipStyle(stockForm.ram === v)}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8, fontWeight: 700 }}>STORAGE *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['16GB','32GB','64GB','128GB','256GB','512GB','1TB'].map(v => (
                <button key={v} type="button" onClick={() => setStockForm(f => ({ ...f, storage: v }))} style={chipStyle(stockForm.storage === v)}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8, fontWeight: 700 }}>CONDITION *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['Excellent','Good','Fair','Poor'].map(v => (
                <button key={v} type="button" onClick={() => setStockForm(f => ({ ...f, condition: v }))} style={chipStyle(stockForm.condition === v)}>{v}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>COLOR *</label>
              <input type="text" placeholder="e.g. Black, Blue…"
                value={stockForm.color} onChange={e => setStockForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>NOTES</label>
              <input type="text" placeholder="Damage, extras…"
                value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>IMEI *</label>
            <input type="text" placeholder="15-digit IMEI number" inputMode="numeric"
              value={stockForm.imei} onChange={e => setStockForm(f => ({ ...f, imei: e.target.value }))} />
          </div>
          <button className="btn btn-cyan" onClick={reviewPhone} disabled={saving} style={{ minHeight: 50, fontSize: 15, fontWeight: 700 }}>
            {saving ? 'Saving…' : '📱 Stock In'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Used Phones</h2>
        {shareMode ? (
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '8px 14px' }} onClick={exitShareMode}>Cancel</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            {available.length > 1 && <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setShareMode(true)}>📤 Select</button>}
            <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setView('stockin')}>+ Stock In</button>
          </div>
        )}
      </div>

      {done === 'stocked' && <AlertBox color="green" text="Phone stocked in successfully!" />}

      {awaitingPrice.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>AWAITING PRICING ({awaitingPrice.length})</SectionLabel>
          {awaitingPrice.map(p => {
            const photos = parsePhotos(p);
            return (
              <div key={p.id} className="card" style={{ marginBottom: 8, opacity: 0.8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {photos.length > 0 && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={photos[0]} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border)', display: 'block' }} />
                      {photos.length > 1 && (
                        <span style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 4px', borderRadius: 4, lineHeight: 1.4 }}>
                          +{photos.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.model}</div>
                    <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 3 }}>⏳ Waiting for owner to set price</div>
                  </div>
                </div>
              </div>
            );
          })}
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

      {!phonesLoading && filteredPhones.length === 0 && available.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)', fontSize: 14 }}>
          No priced phones in stock.<br />
          <span style={{ fontSize: 12, marginTop: 6, display: 'block', color: 'var(--cyan)' }}>Use Sale tab to record phone sales</span>
        </div>
      )}

      {shareMode && filteredPhones.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '6px 12px', background: 'rgba(0,212,255,0.06)', borderRadius: 10, border: '1px solid rgba(0,212,255,0.2)' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{shareSelection.size} selected</span>
          <button style={{ background: 'none', border: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }} onClick={selectAll}>
            {shareSelection.size === filteredPhones.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

      {shareMode && shareSelection.size > 0 && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 999 }}>
          <button className="btn btn-cyan" style={{ padding: '13px 32px', borderRadius: 28, fontSize: 15, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,212,255,0.35)' }} onClick={shareSelected}>
            📤 Share {shareSelection.size} phone{shareSelection.size > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {shareToast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e1e3a', border: '1.5px solid var(--cyan)', borderRadius: 10, padding: '10px 20px', fontSize: 13, color: 'var(--cyan)', fontWeight: 700, zIndex: 999, whiteSpace: 'nowrap' }}>
          ✓ Copied to clipboard!
        </div>
      )}

      {filteredPhones.map(p => {
        const photos = parsePhotos(p);
        const isSelected = shareSelection.has(p.id);
        return (
          <div key={p.id} className="card"
            style={{ marginBottom: 10, cursor: shareMode ? 'pointer' : undefined,
              borderColor: shareMode && isSelected ? 'var(--cyan)' : undefined,
              background: shareMode && isSelected ? 'rgba(0,212,255,0.05)' : undefined }}
            onClick={shareMode ? () => toggleShareSelect(p.id) : undefined}>
            {shareMode && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <span style={{ fontSize: 22, color: isSelected ? 'var(--cyan)' : 'var(--border)', lineHeight: 1 }}>
                  {isSelected ? '✓' : '○'}
                </span>
              </div>
            )}
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, flex: 1, marginRight: 8 }}>{p.model}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--cyan)', flexShrink: 0 }}>
                    Rs {Number(p.selling_price).toLocaleString()}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {p.condition}{p.color ? ` · ${p.color}` : ''}{p.notes ? ` · ${p.notes}` : ''}
                </div>
                {p.imei && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, letterSpacing: 0.5 }}>IMEI: {p.imei}</div>}
              </div>
            </div>
            {!shareMode && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => sharePhone(p)}
                  style={{ padding: '0 14px', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--border)', background: shareToast === p.id ? 'rgba(0,212,255,0.12)' : 'transparent', color: shareToast === p.id ? 'var(--cyan)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  📤 Share
                </button>
                <div style={{ flex: 1, padding: '0 14px', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--border)', background: 'rgba(0,212,255,0.05)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                  Sell via 💰 Sale tab
                </div>
              </div>
            )}
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
  const [loadingList, setLoadingList]   = useState(true);
  const [updatingId, setUpdatingId]     = useState(null);
  const [discountInputs, setDiscountInputs] = useState({});

  const init = { phone: '', customer: '', customerPhone: '', issue: '', customerPrice: '', status: 'Pending', payment: 'Cash' };
  const [form, setForm]   = useState(init);
  const [saving, setSaving] = useState(false);
  const [done, setDone]   = useState(false);

  useEffect(() => { loadRepairs(); }, []);

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
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setUpdatingId(id);
    fetch(`/api/repairs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      .finally(() => setUpdatingId(null));
  }

  async function updatePayment(id, payment_method) {
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, payment_method } : r));
    setUpdatingId(id);
    fetch(`/api/repairs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_method }) })
      .finally(() => setUpdatingId(null));
  }

  async function updateDiscount(id) {
    const disc = Math.max(0, parseFloat(discountInputs[id]) || 0);
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, repair_discount: disc } : r));
    setDiscountInputs(prev => ({ ...prev, [id]: disc }));
    setUpdatingId(id);
    fetch(`/api/repairs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repair_discount: disc }) })
      .finally(() => setUpdatingId(null));
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function saveRepair() {
    if (!form.phone.trim() || !form.customer.trim() || !form.customerPhone.trim() || !form.issue.trim()) {
      showToast('Device model, customer name, phone number, and issue are all required');
      return;
    }
    const repairBody = {
      customer_name:  form.customer,
      customer_phone: form.customerPhone,
      phone_model:    form.phone,
      issue:          form.issue,
      customer_price: parseFloat(form.customerPrice) || 0,
      status:         form.status,
      payment_method: form.payment,
    };

    if (!navigator.onLine) {
      enqueue('repair', repairBody);
      notifyOfflineSave();
      const fakeRepair = { id: null, ...repairBody, repair_discount: 0, created_at: new Date().toISOString() };
      setRepairs(prev => [fakeRepair, ...prev]);
      showToast('Repair saved offline — will sync when connected', 'success');
      setDone(true);
      setTimeout(() => { setForm(init); setDone(false); setView('list'); }, 1200);
      return;
    }

    setSaving(true);
    const res = await fetch('/api/repairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repairBody),
    });
    setSaving(false);
    if (res.ok) {
      const { id } = await res.json().catch(() => ({}));
      const newRepair = { id, customer_name: form.customer, customer_phone: form.customerPhone, phone_model: form.phone, issue: form.issue, customer_price: parseFloat(form.customerPrice) || 0, status: form.status, payment_method: form.payment, repair_discount: 0, created_at: new Date().toISOString() };
      setRepairs(prev => [newRepair, ...prev]);
      setDiscountInputs(prev => ({ ...prev, [id]: 0 }));
      showToast('Repair logged', 'success');
      setDone(true);
      setTimeout(() => { setForm(init); setDone(false); setView('list'); }, 1200);
    } else showToast('Error saving. Try again.');
  }

  // Hide delivered + returned repairs by default
  const activeRepairs = repairs.filter(r =>
    (r.status !== 'Delivered' && r.status !== 'Returned') ||
    (r.payment_method === 'Credit' && !r.credit_cleared)
  );
  const hiddenCount = repairs.length - activeRepairs.length;
  const baseRepairs  = showDelivered ? repairs : activeRepairs;
  const filtered     = statusFilter === 'all' ? baseRepairs : baseRepairs.filter(r => r.status === statusFilter);

  const statusColor = { Pending: 'var(--amber)', 'In Progress': 'var(--cyan)', Done: 'var(--green)', Delivered: 'var(--muted)', Returned: 'var(--red)' };
  const statusBg    = { Pending: 'rgba(255,176,32,0.12)', 'In Progress': 'rgba(0,212,255,0.12)', Done: 'rgba(0,230,118,0.12)', Delivered: 'rgba(112,112,160,0.12)', Returned: 'rgba(239,68,68,0.12)' };

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
            {[['all','All'],['Pending','Pending'],['In Progress','In Progress'],['Done','Done'],['Delivered','Delivered'],['Returned','Returned']].map(([v,l]) => (
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

                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: r.in_progress_at || r.done_at || r.delivered_at ? 4 : 10 }}>
                    Received: {fmtDateTime(r.created_at)}
                  </div>
                  {(r.in_progress_at || r.done_at || r.delivered_at || r.returned_at) && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {r.in_progress_at && <span>In Progress: {fmtDateTime(r.in_progress_at)}</span>}
                      {r.done_at && <span>Done: {fmtDateTime(r.done_at)}</span>}
                      {r.delivered_at && <span>Delivered: {fmtDateTime(r.delivered_at)}</span>}
                      {r.returned_at && <span style={{ color: 'var(--red)' }}>Returned to customer: {fmtDateTime(r.returned_at)}</span>}
                    </div>
                  )}

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
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    {(r.status === 'Done' || r.status === 'Delivered') && toWhatsApp(r.customer_phone) && (
                      <a href={`https://wa.me/${toWhatsApp(r.customer_phone)}?text=${encodeURIComponent(`Hi ${r.customer_name}! 👋 Your ${r.phone_model} repair is ready for pickup at Univercell. Total: Rs ${Math.max(0, Number(r.customer_price) - Number(r.repair_discount||0)).toLocaleString()}. Thank you! 😊`)}`}
                        target="_blank" rel="noreferrer"
                        style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 700, borderRadius: 10, background: '#25D366', color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
                        📱 Notify Customer
                      </a>
                    )}
                    <button onClick={() => printRepairReceipt(r)}
                      style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 700, borderRadius: 10, background: 'none', border: '1.5px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
                      🖨️ Print Receipt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!loadingList && hiddenCount > 0 && (
            <button onClick={() => setShowDelivered(p => !p)}
              style={{ marginTop: 12, width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '10px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
              {showDelivered ? '▲ Hide completed' : `▼ Show ${hiddenCount} delivered / returned`}
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
    if (!productId) { showToast('Select a product'); return; }
    setSaving(true);
    const res = await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: Number(productId), qty: Number(qty) }) });
    setSaving(false);
    if (res.ok) { showToast('Stock updated', 'success'); setProductId(''); setQty(1); }
    else showToast('Error saving. Try again.');
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
    if (!shopName.trim()) { showToast('Enter shop name'); return; }
    const filled = shopItems.filter(i => i.productName && i.qty > 0);
    if (!filled.length) { showToast('Add at least one product'); return; }
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
    } else showToast('Error saving. Try again.');
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
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat]   = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ name: '', selling_price: '', category_id: '' });
  const [saving, setSaving]         = useState(false);
  const [done, setDone]             = useState('');
  const [orderMode, setOrderMode]   = useState(false);
  // { [id]: { selected: bool, qty: number } }
  const [orderSel, setOrderSel]     = useState({});

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }, []);

  function enterOrderMode() {
    const init = {};
    products.forEach(p => {
      init[p.id] = { selected: p.stock <= 2, qty: Math.max(5, 10 - p.stock) };
    });
    setOrderSel(init);
    setOrderMode(true);
    setShowAdd(false);
  }

  function toggleOrder(id) {
    setOrderSel(prev => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));
  }

  function setOrderQty(id, val) {
    setOrderSel(prev => ({ ...prev, [id]: { ...prev[id], qty: Math.max(1, parseInt(val) || 1) } }));
  }

  function sendWhatsAppOrder() {
    const selected = products.filter(p => orderSel[p.id]?.selected);
    if (!selected.length) { showToast('Select at least one item to order'); return; }
    const lines = selected.map(p => `• ${p.name} — Qty: ${orderSel[p.id].qty} (in stock: ${p.stock})`).join('\n');
    const msg = `📦 Stock Order — Univercell\n\nPlease send the following items:\n\n${lines}\n\nThank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const selectedCount = products.filter(p => orderSel[p.id]?.selected).length;
  const lowCount      = products.filter(p => p.stock <= 2).length;

  async function addProduct() {
    if (!form.name.trim() || !form.selling_price) { showToast('Enter accessory name and selling price'); return; }
    if (categories.length > 0 && !form.category_id) { showToast('Please select a category'); return; }
    setSaving(true);
    const body = { name: form.name.trim(), selling_price: parseFloat(form.selling_price) };
    if (form.category_id) body.category_id = parseInt(form.category_id);
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { setDone(form.name); setForm({ name: '', selling_price: '', category_id: '' }); setShowAdd(false); reload(); setTimeout(() => setDone(''), 3000); }
    else showToast('Error saving. Try again.');
  }

  // ── ORDER MODE VIEW ──────────────────────────────────────────────────────────
  if (orderMode) {
    const lowItems   = products.filter(p => p.stock <= 2);
    const otherItems = products.filter(p => p.stock > 2);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setOrderMode(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, padding: 0, flexShrink: 0 }}>← Back</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>Order Stock</h2>
          {selectedCount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700 }}>{selectedCount} selected</span>
          )}
        </div>

        {lowItems.length === 0 && (
          <div style={{ padding: '12px 14px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--green)', marginBottom: 14 }}>
            ✓ No low-stock items right now
          </div>
        )}

        {lowItems.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              LOW STOCK — NEEDS ORDERING ({lowItems.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {lowItems.map(p => {
                const s = orderSel[p.id] || { selected: false, qty: 10 };
                return (
                  <div key={p.id} className="card"
                    style={{ borderColor: s.selected ? 'var(--cyan)' : 'var(--border)', background: s.selected ? 'rgba(0,212,255,0.05)' : undefined, cursor: 'pointer' }}
                    onClick={() => toggleOrder(p.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22, color: s.selected ? 'var(--cyan)' : 'var(--border)', lineHeight: 1, flexShrink: 0 }}>
                        {s.selected ? '☑' : '☐'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          <span style={{ color: 'var(--red)', fontWeight: 700 }}>Stock: {p.stock}</span>
                          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>Sell: Rs {p.selling_price}</span>
                        </div>
                      </div>
                      {s.selected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>ORDER QTY</span>
                          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--cyan)', borderRadius: 8, overflow: 'hidden' }}>
                            <button onClick={() => setOrderQty(p.id, s.qty - 1)}
                              style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>−</button>
                            <input type="number" min="1" value={s.qty}
                              onChange={e => setOrderQty(p.id, e.target.value)}
                              style={{ width: 42, textAlign: 'center', fontWeight: 800, fontSize: 15, border: 'none', background: 'transparent', color: 'var(--text)', padding: '6px 0' }} />
                            <button onClick={() => setOrderQty(p.id, s.qty + 1)}
                              style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {otherItems.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              OTHER ITEMS (tap to add to order)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {otherItems.map(p => {
                const s = orderSel[p.id] || { selected: false, qty: 10 };
                return (
                  <div key={p.id} className="card"
                    style={{ borderColor: s.selected ? 'var(--cyan)' : 'var(--border)', background: s.selected ? 'rgba(0,212,255,0.05)' : undefined, cursor: 'pointer' }}
                    onClick={() => toggleOrder(p.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22, color: s.selected ? 'var(--cyan)' : 'var(--border)', lineHeight: 1, flexShrink: 0 }}>
                        {s.selected ? '☑' : '☐'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          Stock: {p.stock} · Rs {p.selling_price}
                        </div>
                      </div>
                      {s.selected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--cyan)', borderRadius: 8, overflow: 'hidden' }}>
                            <button onClick={() => setOrderQty(p.id, s.qty - 1)}
                              style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>−</button>
                            <input type="number" min="1" value={s.qty}
                              onChange={e => setOrderQty(p.id, e.target.value)}
                              style={{ width: 42, textAlign: 'center', fontWeight: 800, fontSize: 15, border: 'none', background: 'transparent', color: 'var(--text)', padding: '6px 0' }} />
                            <button onClick={() => setOrderQty(p.id, s.qty + 1)}
                              style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ position: 'sticky', bottom: 16 }}>
          <button
            className="btn btn-green"
            onClick={sendWhatsAppOrder}
            disabled={selectedCount === 0}
            style={{ fontSize: 16, minHeight: 54, opacity: selectedCount === 0 ? 0.4 : 1, boxShadow: selectedCount > 0 ? '0 4px 20px rgba(0,230,118,0.35)' : 'none' }}>
            📲 Send Order on WhatsApp{selectedCount > 0 ? ` (${selectedCount} item${selectedCount !== 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </div>
    );
  }

  // ── NORMAL VIEW ──────────────────────────────────────────────────────────────
  const filteredProducts = filterCat === null ? products : products.filter(p => p.category_id === filterCat);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Accessories</h2>
          {lowCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, background: 'rgba(255,51,85,0.12)', padding: '3px 8px', borderRadius: 20 }}>
              {lowCount} low
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {lowCount > 0 && (
            <button className="btn btn-sm" onClick={enterOrderMode}
              style={{ width: 'auto', padding: '8px 14px', background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.35)', color: 'var(--green)', fontWeight: 700 }}>
              📦 Order
            </button>
          )}
          <button className="btn btn-cyan btn-sm" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => { setShowAdd(p => !p); setOrderMode(false); }}>
            {showAdd ? '✕ Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={() => setFilterCat(null)}
            style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterCat === null ? 'var(--cyan)' : 'var(--border)'}`, background: filterCat === null ? 'rgba(0,212,255,0.12)' : 'transparent', color: filterCat === null ? 'var(--cyan)' : 'var(--muted)', cursor: 'pointer' }}>
            All ({products.length})
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterCat === c.id ? 'var(--purple)' : 'var(--border)'}`, background: filterCat === c.id ? 'rgba(176,96,255,0.12)' : 'transparent', color: filterCat === c.id ? 'var(--purple)' : 'var(--muted)', cursor: 'pointer' }}>
              {c.name} ({Number(c.product_count)})
            </button>
          ))}
        </div>
      )}

      {done && <AlertBox color="green" text={`"${done}" added successfully`} />}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--cyan)' }}>New Accessory</div>
          {categories.length > 0 ? (
            <div>
              <label style={{ fontSize: 11, color: 'var(--red)', display: 'block', marginBottom: 4, fontWeight: 700 }}>CATEGORY *</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">— Select category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
              ⚠ No categories set up yet — ask the owner to create categories first
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>ACCESSORY NAME</label>
            <input type="text" placeholder="e.g. iPhone 15 Case" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            {(() => {
              const typed = form.name.trim().toLowerCase();
              if (typed.length < 2) return null;
              const matches = products.filter(p => {
                const ex = p.name.toLowerCase();
                return ex.includes(typed) || typed.includes(ex);
              });
              if (!matches.length) return null;
              return (
                <div style={{ marginTop: 8, padding: '9px 12px', background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
                  ⚠ Already in stock: {matches.map(p => <strong key={p.id}> "{p.name}"</strong>)}. Add a new product only if it's genuinely different.
                </div>
              );
            })()}
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>SELLING PRICE (Rs)</label>
            <input type="number" placeholder="0" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--amber)' }}>
            ℹ️ Purchase cost will be set by the owner
          </div>
          <button className="btn btn-green" onClick={addProduct} disabled={saving}>{saving ? 'Saving…' : 'Save Accessory'}</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredProducts.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No accessories{filterCat ? ' in this category' : ''} yet.</div>}
        {filteredProducts.map(p => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              {p.photo && <img src={p.photo} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1.5px solid var(--border)' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                  {p.category_name && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'rgba(176,96,255,0.12)', padding: '2px 7px', borderRadius: 10 }}>{p.category_name}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  Price: <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Rs {p.selling_price}</span>
                  <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
                  Stock: <span style={{ color: p.stock <= 2 ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>{p.stock}</span>
                </div>
              </div>
              {p.stock <= 2 && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, background: 'rgba(255,51,85,0.1)', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>LOW</span>}
            </div>
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
    if (!itemId) { showToast('Select an item'); return; }
    setSaving(true);
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemType, itemId: Number(itemId), itemName: selected?.label || '', quantity: Number(quantity), reason, return_amount: showAmount ? (parseFloat(returnAmount) || 0) : 0 }) });
    setSaving(false);
    if (!r.ok) { showToast('Failed'); return; }
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
  const [discounting, setDiscounting] = useState(null);
  const [lineDiscounts, setLineDiscounts] = useState({});
  const [clearedMethod, setClearedMethod] = useState('Cash');

  useEffect(() => { loadCredits(); }, []);

  async function loadCredits() {
    setLoading(true);
    const r = await fetch('/api/credits');
    setCredits(await r.json());
    setLoading(false);
  }

  async function clearCredit(type, id, totalDiscount, method) {
    setClearing(`${type}-${id}`);
    await fetch('/api/credits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id, discount: Number(totalDiscount) || 0, clearedPaymentMethod: method }) });
    setClearing(null);
    setDiscounting(null);
    setLineDiscounts({});
    setClearedMethod('Cash');
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
          const isDiscounting = discounting === key;
          const amount = Number(item._type === 'sale' ? item.total_amount : item.customer_price);
          const name   = item._type === 'sale' ? (item.credit_customer || 'Unknown') : item.customer_name;
          const typeLabel = item._type === 'repair' ? 'REPAIR' : 'SALE';
          const totalDisc = isDiscounting ? Object.values(lineDiscounts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
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
                ) : !isDiscounting ? (
                  <button className="btn btn-green btn-sm" style={{ width: 'auto', padding: '8px 18px' }}
                    onClick={() => { setDiscounting(key); setLineDiscounts({}); setClearedMethod('Cash'); }} disabled={isClearing}>
                    ✓ Mark Paid
                  </button>
                ) : null}
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
                const v = Number(data.methods[m]?.outflows || 0);
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

      {/* Discounts given today */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>DISCOUNTS GIVEN TODAY</div>
        {data.discounts?.total > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['🏷 Products',       data.discounts?.products],
              ['📱 Phones',         data.discounts?.phones],
              ['🔧 Repairs',        data.discounts?.repairs],
              ['💳 Credit cleared', (data.discounts?.creditSales||0) + (data.discounts?.creditRepairs||0)],
            ].filter(([, v]) => v > 0).map(([lbl, v]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>{lbl}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--amber)' }}>Rs {Number(v).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginTop: 2, background: 'rgba(239,68,68,0.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Total Discounts</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>Rs {Number(data.discounts.total).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 12 }}>
            No discounts given today
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STAFF EXPENSES TAB ───────────────────────────────────────────────────────
function StaffExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm]         = useState({ description: '', amount: '', payment_method: 'Cash', category: 'expense' });
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
    if (!form.description.trim()) { showToast('Enter a description'); return; }
    if (!form.amount || Number(form.amount) <= 0) { showToast('Enter a valid amount'); return; }
    setSaving(true);
    const r = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: form.description.trim(), amount: parseFloat(form.amount), payment_method: form.payment_method, category: form.category }) });
    setSaving(false);
    if (r.ok) { setForm({ description: '', amount: '', payment_method: 'Cash', category: 'expense' }); load(); showToast('Expense recorded', 'success'); }
    else showToast('Error saving. Try again.');
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
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>CATEGORY</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { val: 'expense',      label: 'Operating Expense',   desc: 'Regular business expense',    color: 'var(--red)' },
              { val: 'cogs',         label: 'Cost of Goods Sold',  desc: 'Purchase cost, not an expense', color: 'var(--amber)' },
              { val: 'service_cost', label: 'Cost of Outsourcing', desc: 'Repair parts / outsourced work', color: 'var(--purple)' },
            ].map(({ val, label, desc, color }) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${form.category === val ? color : 'var(--border)'}`, background: form.category === val ? `${color}11` : 'transparent', cursor: 'pointer' }}>
                <input type="radio" name="staff-cat" value={val} checked={form.category === val} onChange={() => setForm(f => ({ ...f, category: val }))} style={{ accentColor: color }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: form.category === val ? color : 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
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
            {todayExp.map(e => <ExpenseRow key={e.id} e={e} onDelete={del} deleting={deleting} showDate={false} canDelete={false} />)}
          </div>
        </>
      )}
      {earlierExp.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>EARLIER THIS MONTH</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {earlierExp.map(e => <ExpenseRow key={e.id} e={e} onDelete={del} deleting={deleting} showDate fmtDate={fmtExpDate} canDelete={false} />)}
          </div>
        </>
      )}
      {!loading && expenses.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>No expenses recorded this month.</div>}
    </div>
  );
}

function ExpenseRow({ e, onDelete, deleting, showDate, fmtDate, canDelete = true }) {
  const [confirm, setConfirm] = useState(false);
  const pm = e.payment_method || 'Cash';
  const pmColor = CASH_COLORS[pm] || 'var(--muted)';
  const cat = e.category || 'expense';
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{e.description}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: `${pmColor}22`, color: pmColor }}>
            {pm === 'Bank Transfer' ? 'Bank' : pm}
          </span>
          {cat === 'cogs' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(255,176,32,0.12)', color: 'var(--amber)' }}>COGS</span>}
          {cat === 'service_cost' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(176,96,255,0.12)', color: 'var(--purple)' }}>OUTSOURCING</span>}
          {showDate && fmtDate && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(e.expense_date)}</span>}
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', flexShrink: 0 }}>Rs {Number(e.amount).toLocaleString()}</div>
      {canDelete && (!confirm ? (
        <button onClick={() => setConfirm(true)} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '4px 8px', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>×</button>
      ) : (
        <button onClick={() => { setConfirm(false); onDelete(e.id); }} disabled={deleting === e.id} style={{ background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {deleting === e.id ? '…' : 'Del?'}
        </button>
      ))}
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

function toWhatsApp(phone) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('977')) return clean;
  if (clean.length === 10 && clean.startsWith('9')) return '977' + clean;
  if (clean.startsWith('0') && clean.length === 11) return '977' + clean.slice(1);
  return clean || null;
}

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

// ─── CUSTOMER HISTORY TAB ─────────────────────────────────────────────────────
function CustomerHistoryTab() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  function search(val) {
    setQ(val);
    clearTimeout(timerRef.current);
    if (val.trim().length < 2) { setResults(null); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/customers/search?q=${encodeURIComponent(val.trim())}`);
        if (r.ok) setResults(await r.json());
      } finally { setLoading(false); }
    }, 400);
  }

  const repairStatusColors = { Pending: 'var(--amber)', 'In Progress': 'var(--cyan)', Done: 'var(--green)', Delivered: 'var(--muted)' };

  const hasResults = results && (results.repairs?.length > 0 || results.sales?.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="Search by customer name or phone…"
        style={{ fontSize: 15 }}
        autoFocus
      />

      {loading && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Searching…</div>}

      {results && !hasResults && !loading && (
        <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>No records found for "{q}"</div>
      )}

      {results?.repairs?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>REPAIRS ({results.repairs.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.repairs.map(r => (
              <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.customer_name}</span>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: repairStatusColors[r.status] + '22', color: repairStatusColors[r.status], fontWeight: 600 }}>{r.status}</span>
                </div>
                {r.customer_phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📞 {r.customer_phone}</div>}
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{r.phone_model} — {r.issue}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>{fmtDate(r.created_at)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>Rs {Number(r.customer_price).toLocaleString()}</span>
                </div>
                {Number(r.repair_discount) > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>Discount: -Rs {Number(r.repair_discount).toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results?.sales?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SALES ({results.sales.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.sales.map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.customer_name || '—'}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: s.payment_method === 'Credit' ? (s.credit_cleared ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)') : 'rgba(0,212,255,0.12)', color: s.payment_method === 'Credit' ? (s.credit_cleared ? 'var(--green)' : 'var(--red)') : 'var(--cyan)', fontWeight: 600 }}>
                    {s.payment_method === 'Credit' ? (s.credit_cleared ? 'Credit Cleared' : 'Credit Pending') : s.payment_method}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.items}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>{fmtDate(s.created_at)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>Rs {Number(s.total_amount).toLocaleString()}</span>
                </div>
                {Number(s.credit_discount) > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>Discount on clear: -Rs {Number(s.credit_discount).toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NOTES TAB ───────────────────────────────────────────────────────────────
function NotesTab({ products = [], phones = [], onPhoneChange = () => {} }) {
  const [items, setItems]         = useState([]);
  const [filter, setFilter]       = useState('out');
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [resolving, setResolving] = useState({});
  const [soldOpen, setSoldOpen]   = useState({});
  const [soldAmt, setSoldAmt]     = useState({});
  const [soldPayment, setSoldPayment] = useState({});
  const [availablePhones, setAvailablePhones] = useState([]);
  const [form, setForm]           = useState({
    person_name: '', person_phone: '',
    item_type: 'phone', phone_id: '', product_id: '', custom_item: '', notes: ''
  });

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { loadAvailablePhones(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/consignments?status=${filter}`);
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }

  async function loadAvailablePhones() {
    const r = await fetch('/api/phones');
    if (r.ok) {
      const data = await r.json();
      setAvailablePhones((data || []).filter(p => p.status === 'available'));
    }
  }

  function derivedItemName() {
    if (form.item_type === 'phone') {
      const p = availablePhones.find(p => String(p.id) === String(form.phone_id));
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
      const p = availablePhones.find(p => String(p.id) === String(form.phone_id));
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
    if (!form.person_name.trim() || !item_name.trim()) { showToast('Person name and item required', 'error'); return; }
    setSaving(true);
    const r = await fetch('/api/consignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_name: form.person_name.trim(), person_phone: form.person_phone.trim(), item_name, unit_price: derivedPrice(), notes: form.notes.trim(), phone_id: form.item_type === 'phone' ? Number(form.phone_id) || null : null, product_id: form.item_type === 'accessory' ? Number(form.product_id) || null : null, quantity: 1 }),
    });
    setSaving(false);
    if (!r.ok) { showToast('Failed to save', 'error'); return; }
    showToast('Recorded', 'success');
    setForm({ person_name: '', person_phone: '', item_type: 'phone', phone_id: '', product_id: '', custom_item: '', notes: '' });
    loadAvailablePhones();
    onPhoneChange();
    if (filter === 'out' || filter === 'all') load();
  }

  async function markSold(id) {
    setResolving(p => ({ ...p, [id]: true }));
    await fetch(`/api/consignments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sold', amount_received: Number(soldAmt[id]) || 0, payment_method: soldPayment[id] || 'Cash' }),
    });
    setResolving(p => ({ ...p, [id]: false }));
    setSoldOpen(p => ({ ...p, [id]: false }));
    onPhoneChange();
    load();
  }

  async function markReturned(id) {
    setResolving(p => ({ ...p, [id]: true }));
    await fetch(`/api/consignments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'returned', amount_received: 0 }),
    });
    setResolving(p => ({ ...p, [id]: false }));
    loadAvailablePhones();
    onPhoneChange();
    load();
  }

  function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }

  const pendingCount = items.filter(i => i.status === 'out').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 18 }}>Notes</h2>

      {/* Add form */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Record Item Given Out</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="Person name *" value={form.person_name} onChange={e => setForm(p => ({ ...p, person_name: e.target.value }))} />
            <input placeholder="Phone number" value={form.person_phone} onChange={e => setForm(p => ({ ...p, person_phone: e.target.value }))} />
          </div>

          {/* Item type toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[['phone','📱 Phone'],['accessory','🏷 Item'],['custom','✏ Custom']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setForm(p => ({ ...p, item_type: v, phone_id: '', product_id: '', custom_item: '' }))}
                className="btn btn-sm"
                style={{ padding: '8px 4px', fontSize: 12, background: form.item_type===v ? 'var(--cyan)' : 'transparent', color: form.item_type===v ? '#000' : 'var(--text)', border: `1.5px solid ${form.item_type===v ? 'var(--cyan)' : 'var(--border)'}` }}>
                {l}
              </button>
            ))}
          </div>

          {form.item_type === 'phone' && (
            <select value={form.phone_id} onChange={e => setForm(p => ({ ...p, phone_id: e.target.value }))} style={{ background: 'var(--card)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: '100%' }}>
              <option value="">Select phone…</option>
              {availablePhones.map(p => <option key={p.id} value={p.id}>{p.model} — {p.condition}{Number(p.selling_price) > 0 ? ` — Rs ${Number(p.selling_price).toLocaleString()}` : ' — (unpriced)'}</option>)}
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
          <button type="submit" className="btn btn-cyan" style={{ fontWeight: 700 }} disabled={saving}>{saving ? '…' : 'Give Out'}</button>
        </form>
      </div>

      {/* Filter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        {[['out','Pending'],['sold','Sold'],['returned','Returned'],['all','All']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} className="btn btn-sm"
            style={{ padding: '8px 4px', fontSize: 12, background: filter===v ? 'var(--cyan)' : 'transparent', color: filter===v ? '#000' : 'var(--text)', border: `1.5px solid ${filter===v ? 'var(--cyan)' : 'var(--border)'}` }}>
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
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: item.status==='out' ? 'rgba(255,176,32,0.2)' : item.status==='sold' ? 'rgba(0,230,118,0.15)' : 'rgba(112,112,160,0.15)',
              color: item.status==='out' ? 'var(--amber)' : item.status==='sold' ? 'var(--green)' : 'var(--muted)' }}>
              {item.status==='out' ? 'PENDING' : item.status==='sold' ? 'SOLD' : 'RETURNED'}
            </span>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.item_name}</div>
          {item.unit_price > 0 && <div style={{ fontSize: 13, color: 'var(--cyan)' }}>Rs {Number(item.unit_price).toLocaleString()}</div>}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={soldPayment[item.id] || 'Cash'}
                      onChange={e => setSoldPayment(p => ({ ...p, [item.id]: e.target.value }))}
                      style={{ flex: 1, background: 'var(--card)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
                      {['Cash','eSewa','Bank Transfer','Fonepay','Credit'].map(m => <option key={m}>{m}</option>)}
                    </select>
                    <button onClick={() => setSoldOpen(p => ({ ...p, [item.id]: false }))} className="btn btn-ghost btn-sm" style={{ padding: '10px 12px' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" placeholder={`Amount (Rs ${Number(item.unit_price).toLocaleString()})`}
                      value={soldAmt[item.id] || ''} onChange={e => setSoldAmt(p => ({ ...p, [item.id]: e.target.value }))}
                      style={{ flex: 1 }} autoFocus />
                    <button onClick={() => markSold(item.id)} className="btn btn-green btn-sm" style={{ whiteSpace: 'nowrap', padding: '10px 16px' }} disabled={resolving[item.id]}>
                      {resolving[item.id] ? '…' : '✓ Confirm'}
                    </button>
                  </div>
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
