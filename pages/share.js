import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Share() {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/phones/public')
      .then(r => r.json())
      .then(data => { setPhones(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>Available Phones</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#f0f0f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 48px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #1e1e3a' }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>📱</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#00d4ff', letterSpacing: -0.5 }}>
              Available Phones
            </h1>
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14 }}>
              Used &amp; refurbished · Prices may change
            </p>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>Loading…</div>
          )}

          {!loading && phones.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 16 }}>No phones available right now.</div>
              <div style={{ fontSize: 13, marginTop: 8, color: '#444' }}>Check back soon!</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {phones.map(p => (
              <div key={p.id} style={{
                background: '#12122a',
                borderRadius: 14,
                padding: '16px 18px',
                border: '1.5px solid #1e1e3a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#f0f0f0', marginBottom: 5, lineHeight: 1.3 }}>
                    {p.model}
                  </div>
                  <div style={{ fontSize: 13, color: conditionColor(p.condition), fontWeight: 600, marginBottom: p.notes ? 3 : 0 }}>
                    {p.condition}
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.notes}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#00e676', lineHeight: 1 }}>
                    Rs {Number(p.selling_price).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && phones.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#333' }}>
              {phones.length} phone{phones.length !== 1 ? 's' : ''} in stock
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function conditionColor(c) {
  if (c === 'Excellent') return '#00e676';
  if (c === 'Good')      return '#00d4ff';
  if (c === 'Fair')      return '#ffb020';
  return '#ff3355';
}
