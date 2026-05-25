import Head from 'next/head';

const SHOP = {
  name: 'AESTHETECH',
  phone1: '9801848762',
  phone2: '9801848761',
  location: 'Pulchowk, Lalitpur',
  insta: '@aesthetech.np',
};

const TIERS = [
  {
    id: 'silver',
    label: 'SILVER',
    badge: '◆ SILVER',
    bg: 'linear-gradient(150deg, #06080F 0%, #0B1020 45%, #080C1A 80%, #050710 100%)',
    strip: 'linear-gradient(90deg, #374151 0%, #9CA3AF 30%, #F3F4F6 55%, #CBD5E1 75%, #4B5563 100%)',
    badgeBg: 'linear-gradient(135deg, #475569 0%, #CBD5E1 45%, #F1F5F9 65%, #94A3B8 100%)',
    badgeFg: '#0b1020',
    glow1: 'rgba(203,213,225,0.16)',
    glow2: 'rgba(148,163,184,0.09)',
    slash: 'rgba(203,213,225,0.05)',
    accentText: '#CBD5E1',
    perks: ['1 pt per Rs 100 spent', '5% off all accessories', 'Free screen cleaning', 'Birthday 10% off'],
  },
  {
    id: 'gold',
    label: 'GOLD',
    badge: '◆ GOLD',
    bg: 'linear-gradient(150deg, #0A0500 0%, #170D00 45%, #0F0900 80%, #080400 100%)',
    strip: 'linear-gradient(90deg, #78350F 0%, #D97706 30%, #FEF08A 55%, #FBBF24 75%, #92400E 100%)',
    badgeBg: 'linear-gradient(135deg, #92400E 0%, #D97706 35%, #FEF08A 60%, #F59E0B 80%, #78350F 100%)',
    badgeFg: '#1a0800',
    glow1: 'rgba(251,191,36,0.18)',
    glow2: 'rgba(217,119,6,0.10)',
    slash: 'rgba(251,191,36,0.06)',
    accentText: '#FCD34D',
    perks: ['1.5 pts per Rs 100 spent', '8% off all accessories', 'Free screen guard with every phone', 'Priority repair queue', 'Birthday 15% off'],
  },
  {
    id: 'platinum',
    label: 'PLATINUM',
    badge: '◆ PLATINUM',
    bg: 'linear-gradient(150deg, #030308 0%, #080820 45%, #060614 80%, #030308 100%)',
    strip: 'linear-gradient(90deg, #1E3A5F 0%, #3B82F6 25%, #93C5FD 50%, #DBEAFE 65%, #60A5FA 80%, #1D4ED8 100%)',
    badgeBg: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 30%, #93C5FD 60%, #BFDBFE 75%, #1E40AF 100%)',
    badgeFg: '#030F2A',
    glow1: 'rgba(147,197,253,0.16)',
    glow2: 'rgba(96,165,250,0.09)',
    slash: 'rgba(147,197,253,0.06)',
    accentText: '#93C5FD',
    perks: ['2 pts per Rs 100 spent', '10% off all accessories', 'Free screen guard + case with phone', 'Same-day repair (before noon)', 'Personal WhatsApp support', 'Birthday 20% off'],
  },
];

function CardDecorations({ tier }) {
  return (
    <>
      <div className="lcard-grid" />
      <div className="lcard-slash" style={{ background: `linear-gradient(to right, transparent, ${tier.slash}, transparent)` }} />
      <div className="lcard-glow lcard-glow1" style={{ background: `radial-gradient(circle at center, ${tier.glow1} 0%, transparent 70%)` }} />
      <div className="lcard-glow lcard-glow2" style={{ background: `radial-gradient(circle at center, ${tier.glow2} 0%, transparent 70%)` }} />
      <div className="lcard-strip" style={{ background: tier.strip }} />
      <div className="lcard-strip lcard-strip--bottom" style={{ background: tier.strip, opacity: 0.4 }} />
    </>
  );
}

function LoyaltyCard({ tier }) {
  return (
    <div className={`lcard lcard--${tier.id}`} style={{ background: tier.bg }}>
      <CardDecorations tier={tier} />
      <div className="lcard-content">
        {/* Centered header */}
        <div className="lcard-header">
          <div className="lcard-shopname">AESTHETECH</div>
          <div className="lcard-loyaltylabel">LOYALTY CARD</div>
          <div className="lcard-badge" style={{ background: tier.badgeBg, color: tier.badgeFg }}>
            {tier.badge}
          </div>
        </div>

        {/* Info panel */}
        <div className="lcard-panel">
          <div className="lcard-row">
            <span className="lcard-fieldlabel">NAME</span>
            <div className="lcard-writeline" />
          </div>
          <div className="lcard-row lcard-row--phone">
            <span className="lcard-fieldlabel">PHONE</span>
            <div className="lcard-writeline" />
          </div>
          <div className="lcard-row lcard-row--card">
            <span className="lcard-fieldlabel">CARD</span>
            <span className="lcard-cardnum" style={{ color: tier.accentText }}>AES —  ______</span>
          </div>
        </div>

        {/* Footer */}
        <div className="lcard-footer">
          <div className="lcard-contact">
            ☎ {SHOP.phone1} · {SHOP.phone2} · {SHOP.location}
          </div>
          <div className="lcard-insta" style={{ color: tier.accentText }}>
            {SHOP.insta}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoyaltyCardBack({ tier }) {
  return (
    <div className={`lcard lcard--${tier.id}`} style={{ background: tier.bg }}>
      <CardDecorations tier={tier} />
      <div className="lcard-back-content">
        <div className="lcard-back-top">
          <div className="lcard-back-brand">AESTHETECH</div>
          <div className="lcard-back-subbrand">LOYALTY PROGRAM</div>
          <div className="lcard-back-divider" style={{ background: tier.strip }} />
        </div>

        <div className="lcard-back-grid">
          <div className="lcard-back-col">
            <div className="lcard-back-label">EARN POINTS</div>
            <div className="lcard-back-item">Silver · 1 pt / Rs 100</div>
            <div className="lcard-back-item">Gold · 1.5 pts / Rs 100</div>
            <div className="lcard-back-item">Platinum · 2 pts / Rs 100</div>
            <div className="lcard-back-redeem" style={{ color: tier.accentText }}>100 pts = Rs 10 off</div>
          </div>
          <div className="lcard-back-col">
            <div className="lcard-back-label">UPGRADE PATH</div>
            <div className="lcard-back-item" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Gold Member</div>
            <div className="lcard-back-item">Buy 3 phones, or</div>
            <div className="lcard-back-item">Rs 8,000 accessories</div>
            <div className="lcard-back-item" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: '0.7mm' }}>Platinum</div>
            <div className="lcard-back-item">Buy 6 phones, or</div>
            <div className="lcard-back-item">Rs 20,000 accessories</div>
          </div>
        </div>

        <div className="lcard-back-footer">
          {SHOP.phone1} · {SHOP.phone2} · {SHOP.insta} · {SHOP.location}
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyCardsPage() {
  return (
    <>
      <Head>
        <title>Loyalty Cards — Aesthetech</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        * {
          box-sizing: border-box; margin: 0; padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body { background: #070710; font-family: 'Montserrat', sans-serif; }

        /* ── Card base ─────────────────────────── */
        .lcard {
          width: 85.6mm;
          height: 54mm;
          border-radius: 3.5mm;
          position: relative;
          overflow: hidden;
          font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
        }
        .lcard-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 3.4mm 3.4mm;
        }
        .lcard-slash {
          position: absolute;
          top: -10%; right: 28%;
          width: 50%; height: 130%;
          transform: rotate(-18deg);
          pointer-events: none;
        }
        .lcard-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lcard-glow1 { top: -18%; right: -6%; width: 50%; padding-bottom: 50%; }
        .lcard-glow2 { bottom: -14%; left: -6%; width: 38%; padding-bottom: 38%; }
        .lcard-strip {
          position: absolute; left: 0; right: 0;
          height: 0.72mm; top: 0;
        }
        .lcard-strip--bottom { top: auto; bottom: 0; height: 0.36mm; }

        /* ── Front content ─────────────────────── */
        .lcard-content {
          position: relative; z-index: 1;
          padding: 2.7mm 3.4mm;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .lcard-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .lcard-shopname {
          font-size: 5.2mm;
          font-weight: 900;
          letter-spacing: 0.26em;
          color: #FFFFFF;
          line-height: 1;
          text-shadow: 0 0 8mm rgba(255,255,255,0.12);
        }
        .lcard-loyaltylabel {
          font-size: 1.45mm;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.32);
          margin-top: 0.5mm;
          margin-bottom: 1.4mm;
        }
        .lcard-badge {
          font-size: 1.9mm;
          font-weight: 800;
          letter-spacing: 0.07em;
          border-radius: 1mm;
          padding: 0.9mm 2.6mm;
          white-space: nowrap;
          box-shadow: 0 0.5mm 3mm rgba(0,0,0,0.5);
        }

        .lcard-panel {
          background: rgba(255,255,255,0.042);
          border: 0.25mm solid rgba(255,255,255,0.1);
          border-radius: 1.5mm;
          padding: 1.7mm 2mm;
        }
        .lcard-row { display: flex; align-items: center; gap: 1.4mm; }
        .lcard-row--phone { margin-top: 1.3mm; }
        .lcard-row--card  { margin-top: 1.3mm; }
        .lcard-fieldlabel {
          font-size: 1.38mm;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.36);
          width: 5.8mm;
          flex-shrink: 0;
        }
        .lcard-writeline {
          flex: 1;
          border-bottom: 0.28mm dashed rgba(255,255,255,0.18);
          min-height: 3.6mm;
        }
        .lcard-cardnum {
          font-size: 3.1mm;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-shadow: 0 0 4mm currentColor;
        }

        .lcard-footer { }
        .lcard-contact {
          font-size: 1.46mm;
          font-weight: 500;
          color: rgba(255,255,255,0.48);
          letter-spacing: 0.03em;
          line-height: 1.4;
        }
        .lcard-insta {
          font-size: 1.52mm;
          font-weight: 700;
          opacity: 0.82;
          letter-spacing: 0.06em;
          margin-top: 0.5mm;
        }

        /* ── Back content ──────────────────────── */
        .lcard-back-content {
          position: relative; z-index: 1;
          padding: 2.4mm 3mm;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .lcard-back-top { text-align: center; }
        .lcard-back-brand {
          font-size: 3.6mm;
          font-weight: 900;
          letter-spacing: 0.22em;
          color: #fff;
        }
        .lcard-back-subbrand {
          font-size: 1.32mm;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: rgba(255,255,255,0.3);
          margin-top: 0.3mm;
        }
        .lcard-back-divider {
          height: 0.3mm;
          border-radius: 1mm;
          opacity: 0.45;
          margin: 1.4mm 0 0;
        }
        .lcard-back-grid {
          display: flex;
          gap: 2mm;
          flex: 1;
          padding: 1mm 0;
        }
        .lcard-back-col { flex: 1; display: flex; flex-direction: column; gap: 0.45mm; }
        .lcard-back-label {
          font-size: 1.22mm;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.32);
          margin-bottom: 0.8mm;
          text-transform: uppercase;
        }
        .lcard-back-item {
          font-size: 1.58mm;
          font-weight: 600;
          color: rgba(255,255,255,0.62);
          letter-spacing: 0.02em;
          line-height: 1.5;
        }
        .lcard-back-redeem {
          font-size: 1.68mm;
          font-weight: 800;
          letter-spacing: 0.04em;
          margin-top: 1.2mm;
        }
        .lcard-back-footer {
          font-size: 1.28mm;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
          text-align: center;
          letter-spacing: 0.03em;
        }

        /* ── Screen preview wrapper ────────────── */
        .card-scale-wrap {
          --scale: 2.6;
          width: calc(85.6mm * var(--scale));
          height: calc(54mm * var(--scale));
          position: relative;
          flex-shrink: 0;
        }
        .card-scale-wrap > .lcard {
          transform: scale(var(--scale));
          transform-origin: top left;
          box-shadow:
            0 30px 80px rgba(0,0,0,0.9),
            0 0 0 0.25mm rgba(255,255,255,0.07),
            0 0 40mm rgba(var(--glow-rgb, 200,200,200), 0.05);
        }
        .lcard--silver   { --glow-rgb: 203,213,225; }
        .lcard--gold     { --glow-rgb: 251,191,36; }
        .lcard--platinum { --glow-rgb: 147,197,253; }

        @media (max-width: 700px) { .card-scale-wrap { --scale: 1.9; } }
        @media (max-width: 480px) { .card-scale-wrap { --scale: 1.45; } }

        /* ── Screen layout ─────────────────────── */
        .page-wrap {
          min-height: 100vh;
          padding: 28px 16px 60px;
        }
        .page-header { text-align: center; margin-bottom: 40px; }
        .page-title {
          font-size: 26px; font-weight: 900;
          letter-spacing: 0.18em; color: #FFFFFF;
          margin-bottom: 6px;
        }
        .page-sub { font-size: 13px; color: rgba(255,255,255,0.38); letter-spacing: 0.06em; }
        .print-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #3B82F6, #1D4ED8);
          color: #fff; border: none; border-radius: 10px;
          padding: 12px 28px; font-size: 14px; font-weight: 700;
          letter-spacing: 0.06em; cursor: pointer; margin-top: 16px;
          box-shadow: 0 4px 20px rgba(59,130,246,0.4);
          transition: opacity 0.2s;
          font-family: 'Montserrat', sans-serif;
        }
        .print-btn:hover { opacity: 0.88; }

        .tier-sections { display: flex; flex-direction: column; gap: 48px; }
        .tier-row {
          display: flex; align-items: flex-start; gap: 28px;
          flex-wrap: wrap;
        }
        .tier-info { flex: 1; min-width: 200px; padding-top: 8px; }
        .tier-badge-display {
          display: inline-block;
          font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
          padding: 4px 12px; border-radius: 6px; margin-bottom: 10px;
        }
        .tier-info h3 { font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 10px; }
        .tier-info ul { list-style: none; padding: 0; }
        .tier-info ul li {
          font-size: 12px; color: rgba(255,255,255,0.55);
          padding: 3px 0; letter-spacing: 0.02em;
        }
        .tier-info ul li::before { content: '◆  '; font-size: 7px; opacity: 0.5; }

        .print-note {
          margin-top: 40px; padding: 16px 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          font-size: 12px; color: rgba(255,255,255,0.45);
          line-height: 1.7;
          text-align: center;
        }

        /* ── Print styles ──────────────────────── */
        @media print {
          @page { margin: 12mm; size: A4; }

          body { background: white !important; }
          .no-print  { display: none !important; }
          .print-only { display: block !important; }

          .print-page { page-break-after: always; }

          .print-grid {
            display: grid;
            grid-template-columns: 85.6mm 85.6mm;
            grid-template-rows: 54mm 54mm 54mm;
            gap: 6mm;
            width: fit-content;
            margin: 0 auto;
          }
          .print-card-wrap {
            width: 85.6mm;
            height: 54mm;
            border: 0.3mm dashed rgba(0,0,0,0.25);
            border-radius: 3.5mm;
            overflow: hidden;
          }
          .print-card-wrap .lcard {
            border-radius: 0;
            width: 100%;
            height: 100%;
          }
          .card-scale-wrap {
            transform: none !important;
            width: 85.6mm !important;
            height: 54mm !important;
          }
          .card-scale-wrap > .lcard {
            transform: none !important;
            box-shadow: none !important;
          }
          .lcard-shopname  { text-shadow: none !important; }
          .lcard-cardnum   { text-shadow: none !important; }
          .lcard-badge     { box-shadow: none !important; }
          .print-page-label {
            font-family: 'Montserrat', sans-serif;
            font-size: 8pt; color: #999;
            text-align: center; margin-bottom: 4mm;
          }
        }
      `}</style>

      {/* ── Screen view ─────────────────────────────────────────── */}
      <div className="page-wrap no-print">
        <div className="page-header">
          <div className="page-title">AESTHETECH</div>
          <div className="page-sub">LOYALTY CARD DESIGNS · 3 TIERS</div>
          <button className="print-btn" onClick={() => window.print()}>
            🖨 Print Cards (Front + Back)
          </button>
        </div>

        <div className="tier-sections">
          {TIERS.map(tier => (
            <div key={tier.id} className="tier-row">
              <div className="card-scale-wrap">
                <LoyaltyCard tier={tier} />
              </div>
              <div className="tier-info">
                <div className="tier-badge-display" style={{ background: tier.badgeBg, color: tier.badgeFg }}>
                  {tier.badge}
                </div>
                <h3 style={{ color: tier.accentText }}>{tier.label} MEMBER</h3>
                <ul>
                  {tier.perks.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="print-note">
          🖨 Click "Print Cards" above · In the print dialog enable <strong style={{color:'rgba(255,255,255,0.7)'}}>Background graphics</strong> (Chrome: More settings → Background graphics) · Print at <strong style={{color:'rgba(255,255,255,0.7)'}}>100% scale</strong> · Use 300gsm card stock · Cut along dashed lines · <strong style={{color:'rgba(255,255,255,0.7)'}}>Page 1</strong> = card fronts · <strong style={{color:'rgba(255,255,255,0.7)'}}>Page 2</strong> = card backs (duplex: flip on long edge)
        </div>
      </div>

      {/* ── Print layout ────────────────────────────────────────── */}
      <div className="print-only" style={{ display: 'none' }}>

        {/* Page 1 — Fronts */}
        <div className="print-page">
          <div className="print-page-label">AESTHETECH LOYALTY CARDS — FRONTS (Page 1 of 2)</div>
          <div className="print-grid">
            {TIERS.map(tier => [0, 1].map(n => (
              <div key={`${tier.id}-front-${n}`} className="print-card-wrap">
                <LoyaltyCard tier={tier} />
              </div>
            )))}
          </div>
        </div>

        {/* Page 2 — Backs (for duplex: flip on long edge) */}
        <div>
          <div className="print-page-label">AESTHETECH LOYALTY CARDS — BACKS (Page 2 of 2) · Duplex: flip on long edge</div>
          <div className="print-grid">
            {TIERS.map(tier => [1, 0].map(n => (
              <div key={`${tier.id}-back-${n}`} className="print-card-wrap">
                <LoyaltyCardBack tier={tier} />
              </div>
            )))}
          </div>
        </div>

      </div>
    </>
  );
}
