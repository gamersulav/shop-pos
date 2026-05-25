import Head from 'next/head';

/* ─── SVG definitions ──────────────────────────────────────────────────── */

// Clean premium gem — bolder strokes, strong at any size
const GEM = (id = 'a', size = 130) => {
  const cx = size / 2, cy = size / 2, r = size * 0.46, ri = size * 0.22;
  const pts = (rr) =>
    `${cx},${cy - rr} ${cx + rr},${cy} ${cx},${cy + rr} ${cx - rr},${cy}`;
  const sw = size * 0.018, swi = size * 0.012;
  return `
    <defs>
      <linearGradient id="gg${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00d4ff"/>
        <stop offset="100%" stop-color="#b060ff"/>
      </linearGradient>
      <linearGradient id="gf${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#b060ff" stop-opacity="0.08"/>
      </linearGradient>
    </defs>
    <polygon points="${pts(r)}" fill="url(#gf${id})" stroke="url(#gg${id})" stroke-width="${sw}" stroke-linejoin="round"/>
    <polygon points="${pts(ri)}" fill="url(#gf${id})" stroke="url(#gg${id})" stroke-width="${swi}" opacity="0.75" stroke-linejoin="round"/>
    <line x1="${cx}" y1="${cy - r}"  x2="${cx}" y2="${cy - ri}" stroke="url(#gg${id})" stroke-width="${swi}" opacity="0.7"/>
    <line x1="${cx + r}" y1="${cy}"  x2="${cx + ri}" y2="${cy}" stroke="url(#gg${id})" stroke-width="${swi}" opacity="0.7"/>
    <line x1="${cx}" y1="${cy + r}"  x2="${cx}" y2="${cy + ri}" stroke="url(#gg${id})" stroke-width="${swi}" opacity="0.7"/>
    <line x1="${cx - r}" y1="${cy}"  x2="${cx - ri}" y2="${cy}" stroke="url(#gg${id})" stroke-width="${swi}" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy - r}" r="${size * 0.028}" fill="#00d4ff" opacity="0.95"/>
  `;
};

// ── Horizontal wordmark (for website / banner) ─────────────────────────
const WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 140" fill="none">
  ${GEM('wm', 130)}
  <line x1="148" y1="28" x2="148" y2="112" stroke="url(#ggwm)" stroke-width="1" opacity="0.22"/>
  <text font-family="Montserrat,'Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="56" letter-spacing="2">
    <tspan x="164" y="88" fill="#FFFFFF">AESTHE</tspan><tspan fill="#00d4ff">TECH</tspan>
  </text>
  <text x="166" y="114" font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="500" font-size="12" letter-spacing="3.8" fill="rgba(255,255,255,0.34)">
    MOBILE · ACCESSORIES · REPAIR
  </text>
</svg>`;

// ── Profile picture 1:1 (Instagram / TikTok / Facebook) ───────────────
const PROFILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none">
  <defs>
    <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06080f"/>
      <stop offset="100%" stop-color="#0d0d2a"/>
    </linearGradient>
    <radialGradient id="pglow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Background -->
  <rect width="1000" height="1000" fill="url(#pbg)"/>
  <rect width="1000" height="1000" fill="url(#pglow)"/>
  <!-- Subtle grid dots -->
  <pattern id="pgrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.04)"/>
  </pattern>
  <rect width="1000" height="1000" fill="url(#pgrid)"/>

  <!-- Gem centered slightly above middle -->
  <g transform="translate(200,170)">
    ${GEM('pf', 600)}
  </g>

  <!-- Shop name -->
  <text x="500" y="860" text-anchor="middle"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="900" font-size="90" letter-spacing="12" fill="#FFFFFF">AESTHE</text>
  <text x="500" y="958" text-anchor="middle"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="900" font-size="90" letter-spacing="12" fill="#00d4ff">TECH</text>
</svg>`;

// ── Square post 1:1 — branded, insta/tiktok ready ─────────────────────
const POST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" fill="none">
  <defs>
    <linearGradient id="sbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#04040e"/>
      <stop offset="60%" stop-color="#080820"/>
      <stop offset="100%" stop-color="#06060f"/>
    </linearGradient>
    <radialGradient id="sglow1" cx="50%" cy="42%" r="50%">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="sglow2" cx="50%" cy="42%" r="35%">
      <stop offset="0%" stop-color="#b060ff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#sbg)"/>
  <rect width="1080" height="1080" fill="url(#sglow1)"/>
  <rect width="1080" height="1080" fill="url(#sglow2)"/>

  <!-- Grid texture -->
  <pattern id="sgrid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
    <circle cx="18" cy="18" r="0.9" fill="rgba(255,255,255,0.045)"/>
  </pattern>
  <rect width="1080" height="1080" fill="url(#sgrid)"/>

  <!-- Top accent line -->
  <defs>
    <linearGradient id="sline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="30%" stop-color="#00d4ff" stop-opacity="0.7"/>
      <stop offset="70%" stop-color="#b060ff" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1080" height="2.5" fill="url(#sline)"/>
  <rect x="0" y="1077.5" width="1080" height="2.5" fill="url(#sline)"/>

  <!-- Corner marks -->
  <g stroke="rgba(0,212,255,0.3)" stroke-width="2" fill="none">
    <path d="M 60 90 L 60 60 L 90 60"/>
    <path d="M 990 90 L 990 60 L 960 60"/>
    <path d="M 60 990 L 60 1020 L 90 1020"/>
    <path d="M 990 990 L 990 1020 L 960 1020"/>
  </g>

  <!-- Gem icon -->
  <g transform="translate(215,95)">
    ${GEM('sp', 650)}
  </g>

  <!-- Wordmark -->
  <text x="540" y="862" text-anchor="middle"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="900" font-size="104" letter-spacing="8" fill="#FFFFFF">AESTHE<tspan fill="#00d4ff">TECH</tspan></text>

  <!-- Tagline -->
  <text x="540" y="920" text-anchor="middle"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="500" font-size="22" letter-spacing="5.5" fill="rgba(255,255,255,0.38)">
    MOBILE · ACCESSORIES · REPAIR
  </text>

  <!-- Location -->
  <text x="540" y="1000" text-anchor="middle"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="600" font-size="18" letter-spacing="3" fill="rgba(0,212,255,0.5)">
    PULCHOWK, LALITPUR
  </text>
</svg>`;

// ── Facebook cover / banner 1200×628 ──────────────────────────────────
const BANNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628" fill="none">
  <defs>
    <linearGradient id="bbg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#04040e"/>
      <stop offset="50%" stop-color="#08091e"/>
      <stop offset="100%" stop-color="#04040e"/>
    </linearGradient>
    <radialGradient id="bglow" cx="35%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="bglow2" cx="75%" cy="50%" r="40%">
      <stop offset="0%" stop-color="#b060ff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <linearGradient id="bline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="25%" stop-color="#00d4ff" stop-opacity="0.6"/>
      <stop offset="75%" stop-color="#b060ff" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="628" fill="url(#bbg)"/>
  <rect width="1200" height="628" fill="url(#bglow)"/>
  <rect width="1200" height="628" fill="url(#bglow2)"/>

  <!-- Grid -->
  <pattern id="bgrid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
    <circle cx="18" cy="18" r="0.8" fill="rgba(255,255,255,0.04)"/>
  </pattern>
  <rect width="1200" height="628" fill="url(#bgrid)"/>

  <!-- Accent lines -->
  <rect x="0" y="0" width="1200" height="2.5" fill="url(#bline)"/>
  <rect x="0" y="625.5" width="1200" height="2.5" fill="url(#bline)"/>

  <!-- Vertical separator line -->
  <line x1="600" y1="80" x2="600" y2="548" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>

  <!-- Left: Gem icon -->
  <g transform="translate(60,64)">
    ${GEM('bn', 500)}
  </g>

  <!-- Right: Wordmark block -->
  <text x="660" y="262"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="900" font-size="96" letter-spacing="4" fill="#FFFFFF">AESTHE</text>
  <text x="660" y="370"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="900" font-size="96" letter-spacing="4" fill="#00d4ff">TECH</text>

  <!-- Divider under wordmark -->
  <rect x="660" y="390" width="480" height="2" fill="url(#bline)" opacity="0.4"/>

  <text x="662" y="430"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="500" font-size="20" letter-spacing="5" fill="rgba(255,255,255,0.38)">
    MOBILE · ACCESSORIES · REPAIR
  </text>
  <text x="662" y="470"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="600" font-size="18" letter-spacing="3" fill="rgba(0,212,255,0.5)">
    PULCHOWK, LALITPUR
  </text>
  <text x="662" y="510"
    font-family="Montserrat,'Helvetica Neue',Arial,sans-serif"
    font-weight="600" font-size="17" letter-spacing="2.5" fill="rgba(255,255,255,0.28)">
    9801848762 · @aesthetech.np
  </text>
</svg>`;

// ── Icon only (dark bg) — for profile pics ─────────────────────────────
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" fill="none">
  <defs>
    <linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06080f"/>
      <stop offset="100%" stop-color="#0d0d28"/>
    </linearGradient>
    <radialGradient id="iglow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="500" height="500" rx="90" fill="url(#ibg)"/>
  <rect width="500" height="500" rx="90" fill="url(#iglow)"/>
  <g transform="translate(50,50)">
    ${GEM('ic', 400)}
  </g>
</svg>`;

/* ─── Download helper ───────────────────────────────────────────────────── */
function dl(svgStr, name) {
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function LogoPage() {
  return (
    <>
      <Head>
        <title>Logo — Aesthetech</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *  { box-sizing:border-box; margin:0; padding:0; }
        body { background:#07070f; font-family:'Montserrat',sans-serif; color:#fff; }
        .wrap { max-width:960px; margin:0 auto; padding:44px 20px 100px; }

        /* header */
        .page-title { font-size:11px; font-weight:800; letter-spacing:.2em; color:#00d4ff; margin-bottom:4px; }
        .page-name  { font-size:32px; font-weight:900; letter-spacing:.14em; color:#fff; margin-bottom:6px; }
        .page-sub   { font-size:12px; color:rgba(255,255,255,.32); letter-spacing:.05em; margin-bottom:52px; }

        /* section */
        .section { margin-bottom:44px; }
        .section-label {
          font-size:10px; font-weight:800; letter-spacing:.18em;
          color:rgba(255,255,255,.28); text-transform:uppercase; margin-bottom:12px;
        }
        .chip {
          display:inline-block; font-size:9px; font-weight:700; letter-spacing:.1em;
          padding:2px 8px; border-radius:4px; background:rgba(0,212,255,.12);
          color:#00d4ff; margin-left:8px; vertical-align:middle;
        }

        /* preview boxes */
        .preview {
          border-radius:14px; overflow:hidden;
          display:flex; align-items:center; justify-content:center; padding:28px 24px;
        }
        .preview svg, .preview > div { max-width:100%; height:auto; }
        .bg-dark  { background:#0e0e1c; border:1px solid rgba(255,255,255,.07); }
        .bg-black { background:#000;    border:1px solid rgba(255,255,255,.05); }
        .bg-light { background:#f0f0f5; border:1px solid rgba(0,0,0,.1); }
        .bg-none  { background:transparent; border:1px solid rgba(255,255,255,.07); }

        .preview-sq {
          border-radius:14px; overflow:hidden; aspect-ratio:1;
          display:flex; align-items:center; justify-content:center;
          width:100%; max-width:460px;
        }
        .preview-sq svg { width:100%; height:100%; }

        .preview-banner {
          border-radius:14px; overflow:hidden; aspect-ratio:1200/628;
          width:100%;
        }
        .preview-banner svg { width:100%; height:100%; }

        /* icon row */
        .icon-row { display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap; }
        .icon-box {
          border-radius:18px; overflow:hidden;
          display:flex; align-items:center; justify-content:center;
          background:#0e0e1c; border:1px solid rgba(255,255,255,.07);
        }
        .icon-box svg { display:block; }

        /* buttons */
        .btn-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
        .btn {
          padding:10px 22px; border-radius:8px; border:none; cursor:pointer;
          font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700;
          letter-spacing:.06em; transition:opacity .15s;
        }
        .btn:hover { opacity:.82; }
        .btn-cyan  { background:#00d4ff; color:#000; }
        .btn-ghost { background:rgba(255,255,255,.07); color:rgba(255,255,255,.7); border:1px solid rgba(255,255,255,.12); }

        /* note */
        .note {
          margin-top:44px; padding:18px 22px;
          background:rgba(0,212,255,.04); border:1px solid rgba(0,212,255,.14);
          border-radius:12px; font-size:12px; color:rgba(255,255,255,.5); line-height:1.75;
        }
        .note strong { color:#00d4ff; }

        @media(max-width:600px) {
          .preview { padding:18px 14px; }
          .page-name { font-size:24px; }
        }
      `}</style>

      <div className="wrap">
        <div className="page-title">AESTHETECH</div>
        <div className="page-name">Brand Logo</div>
        <div className="page-sub">SVG vector — scales to any size with no quality loss</div>

        {/* ── Wordmark ── */}
        <div className="section">
          <div className="section-label">Horizontal wordmark <span className="chip">WEBSITE · HEADER · PRINT</span></div>
          <div className="preview bg-dark">
            <div dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }} style={{ width:'100%', maxWidth:580 }} />
          </div>
          <div className="preview bg-light" style={{ marginTop:10 }}>
            <div dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }} style={{ width:'100%', maxWidth:580 }} />
          </div>
          <div className="btn-row">
            <button className="btn btn-cyan" onClick={() => dl(WORDMARK_SVG,'aesthetech-wordmark.svg')}>↓ Download Wordmark SVG</button>
          </div>
        </div>

        {/* ── Profile picture ── */}
        <div className="section">
          <div className="section-label">Profile picture 1:1 <span className="chip">INSTAGRAM · TIKTOK · FACEBOOK</span></div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            <div className="preview-sq bg-none" style={{ maxWidth:340 }}>
              <div dangerouslySetInnerHTML={{ __html: PROFILE_SVG }} style={{ width:'100%' }} />
            </div>
            {/* Thumbnail preview */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, justifyContent:'center' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', fontWeight:700, letterSpacing:'.1em', marginBottom:4 }}>THUMBNAIL PREVIEW</div>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(255,255,255,.1)' }}>
                  <div dangerouslySetInnerHTML={{ __html: PROFILE_SVG }} style={{ width:'100%', height:'100%' }} />
                </div>
                <div style={{ width:48, height:48, borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(255,255,255,.1)' }}>
                  <div dangerouslySetInnerHTML={{ __html: PROFILE_SVG }} style={{ width:'100%', height:'100%' }} />
                </div>
                <div style={{ width:32, height:32, borderRadius:'50%', overflow:'hidden', border:'1.5px solid rgba(255,255,255,.1)' }}>
                  <div dangerouslySetInnerHTML={{ __html: PROFILE_SVG }} style={{ width:'100%', height:'100%' }} />
                </div>
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.25)', marginTop:4 }}>80px · 48px · 32px</div>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-cyan" onClick={() => dl(PROFILE_SVG,'aesthetech-profile.svg')}>↓ Download Profile SVG</button>
            <button className="btn btn-ghost" onClick={() => dl(ICON_SVG,'aesthetech-icon.svg')}>↓ Download Icon only</button>
          </div>
        </div>

        {/* ── Square post ── */}
        <div className="section">
          <div className="section-label">Square post 1080×1080 <span className="chip">INSTAGRAM · TIKTOK POST</span></div>
          <div className="preview-banner" style={{ aspectRatio:'1', maxWidth:480 }}>
            <div dangerouslySetInnerHTML={{ __html: POST_SVG }} style={{ width:'100%', height:'100%' }} />
          </div>
          <div className="btn-row">
            <button className="btn btn-cyan" onClick={() => dl(POST_SVG,'aesthetech-post-1080.svg')}>↓ Download Post SVG (1080×1080)</button>
          </div>
        </div>

        {/* ── Banner ── */}
        <div className="section">
          <div className="section-label">Cover banner 1200×628 <span className="chip">FACEBOOK COVER · YOUTUBE BANNER</span></div>
          <div className="preview-banner">
            <div dangerouslySetInnerHTML={{ __html: BANNER_SVG }} style={{ width:'100%', height:'100%' }} />
          </div>
          <div className="btn-row">
            <button className="btn btn-cyan" onClick={() => dl(BANNER_SVG,'aesthetech-banner-1200x628.svg')}>↓ Download Banner SVG</button>
          </div>
        </div>

        {/* ── Icon ── */}
        <div className="section">
          <div className="section-label">Icon — for app / favicon / stamp / emboss</div>
          <div className="icon-row">
            {[200,120,72,48,32].map(s => (
              <div key={s} className="icon-box" style={{ width:s, height:s, borderRadius: s > 60 ? 24 : s > 40 ? 16 : 10 }}>
                <div dangerouslySetInnerHTML={{ __html: ICON_SVG }} style={{ width:s, height:s }} />
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn btn-cyan" onClick={() => dl(ICON_SVG,'aesthetech-icon.svg')}>↓ Download Icon SVG</button>
          </div>
        </div>

        {/* ── Note for press/designer ── */}
        <div className="note">
          <strong>For your designer / press:</strong> All files are SVG vector — no pixelation at any print size. Open in Figma, Illustrator, or Inkscape to export as PNG/PDF.
          <br/><br/>
          <strong>Font:</strong> Montserrat 900 (Black) — free on Google Fonts.<br/>
          <strong>Primary colors:</strong> Cyan <strong>#00d4ff</strong> · Purple <strong>#b060ff</strong> · White <strong>#FFFFFF</strong> · Dark bg <strong>#07070f</strong><br/>
          <strong>CMYK:</strong> Cyan → C100 M0 Y0 K0 · Purple → C57 M62 Y0 K0<br/>
          <strong>Minimum size:</strong> Icon works down to 16×16px. Wordmark minimum ~200px wide.<br/>
          <strong>Safe area:</strong> Keep 10% clear space around any version.
        </div>
      </div>
    </>
  );
}
