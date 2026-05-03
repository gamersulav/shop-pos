import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [mode, setMode]     = useState(null); // 'staff' | 'owner'
  const [pass, setPass]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: mode, password: pass }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Wrong password'); return; }
    router.push(mode === 'owner' ? '/owner' : '/staff');
  }

  return (
    <>
      <Head><title>Shop POS — Login</title></Head>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📱</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--cyan)', margin: 0, letterSpacing: '-0.5px' }}>
            Mobile Shop POS
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            Select your role to continue
          </p>
        </div>

        {/* Role buttons */}
        {!mode && (
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button className="btn btn-cyan" style={{ fontSize: 18, minHeight: 64 }} onClick={() => setMode('staff')}>
              👤 Staff Login
            </button>
            <button className="btn" style={{ fontSize: 18, minHeight: 64, background: 'var(--purple)', color: '#fff' }} onClick={() => setMode('owner')}>
              👑 Owner Login
            </button>
          </div>
        )}

        {/* Password form */}
        {mode && (
          <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button type="button" onClick={() => { setMode(null); setPass(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, padding: 0 }}>←</button>
              <span style={{ fontWeight: 700, fontSize: 17 }}>
                {mode === 'owner' ? '👑 Owner' : '👤 Staff'} Password
              </span>
            </div>

            <input
              type="password"
              placeholder="Enter password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoFocus
              style={{ fontSize: 18, letterSpacing: 2, textAlign: 'center' }}
            />

            {error && (
              <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', background: 'rgba(255,51,85,0.1)', padding: '10px', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button className={`btn ${mode === 'owner' ? '' : 'btn-cyan'}`}
              style={mode === 'owner' ? { background: 'var(--purple)', color: '#fff' } : {}}
              type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Login →'}
            </button>

            <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Default: {mode === 'owner' ? 'owner123' : 'staff123'}
            </p>
          </form>
        )}
      </div>
    </>
  );
}
