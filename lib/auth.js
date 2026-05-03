import { SignJWT, jwtVerify } from 'jose';

const secret = () => new TextEncoder().encode(
  process.env.JWT_SECRET || 'shop-pos-fallback-secret'
);

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    cookies[k] = v.join('=');
  });
  return cookies;
}

// Use in API routes
export async function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.token) return null;
  return verifyToken(cookies.token);
}
