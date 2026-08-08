// Unofficial Anker SOLIX / Anker Power cloud API client.
// Reimplemented from the community Python library (thomluther/anker-solix-api)
// using the Web Crypto API (ECDH P-256, AES-256-CBC) + a small MD5.
// This is NOT an official API and can break if Anker changes their service.

const API_SERVERS = {
  eu: "https://ankerpower-api-eu.anker.com",
  com: "https://ankerpower-api.anker.com",
};

const COM_COUNTRIES = ["DZ","LB","SY","EG","LY","TN","MA","JO","PS","AR","AU","BR","HK","IN","MX","NG","NZ","RU","SG","ZA","KR","TW","US","CA"];
const EU_COUNTRIES = ["DE","BE","EL","LT","PT","BG","ES","LU","CZ","FR","HU","SI","DK","HR","MT","SK","IT","NL","FI","EE","CY","AT","SE","IE","LV","PL","UK","IS","NO","LI","CH","BA","ME","MD","MK","GE","AL","RS","TR","UA","XK","AM","BY","AZ","IL","RO","JP"];

// Anker server uncompressed P-256 public key (65 bytes, 04 || x || y)
const ANKER_PUBLIC_KEY_HEX = "04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076";

export const ENDPOINTS = {
  login: "passport/login",
  homepage: "power_service/v1/site/get_site_homepage",
  siteList: "power_service/v1/site/get_site_list",
  siteDetail: "power_service/v1/site/get_site_detail",
  sceneInfo: "power_service/v1/site/get_scen_info",
  getDeviceParm: "power_service/v1/site/get_site_device_param",
  setDeviceParm: "power_service/v1/site/set_site_device_param",
  energyAnalysis: "power_service/v1/site/energy_analysis",
  homeLoadChart: "power_service/v1/site/get_home_load_chart",
  systemRunningInfo: "charging_hes_svc/get_system_running_info",
  energyStatistics: "charging_hes_svc/get_energy_statistics",
};

export function serverForCountry(country) {
  const c = (country || "").toUpperCase();
  if (COM_COUNTRIES.includes(c)) return API_SERVERS.com;
  if (EU_COUNTRIES.includes(c)) return API_SERVERS.eu;
  return API_SERVERS.eu;
}

function gmtTimezoneString() {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const m = String(Math.abs(offset) % 60).padStart(2, "0");
  return `GMT${sign}${h}:${m}`;
}

function offsetMs() {
  return Math.round(-new Date().getTimezoneOffset() * 60 * 1000);
}

function tsMs() {
  return String(Date.now());
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64encode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// Compact MD5 (RFC 1321) returning lowercase hex.
function md5(str) {
  function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
  const toBytes = (s) => {
    const b = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c < 128) b.push(c);
      else if (c < 2048) { b.push(192 | (c >> 6), 128 | (c & 63)); }
      else { b.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
    }
    return b;
  };
  const bytes = toBytes(str);
  const orig = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bits = [orig * 8, 0];
  for (let i = 0; i < bits.length; i++) {
    bytes.push(bits[i] & 0xff, (bits[i] >>> 8) & 0xff, (bits[i] >>> 16) & 0xff, (bits[i] >>> 24) & 0xff);
  }
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const S = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  const K = [];
  for (let i = 0; i < 64; i++) K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
  for (let off = 0; off < bytes.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) M.push((bytes[off + i*4]) | (bytes[off + i*4 +1] << 8) | (bytes[off + i*4+2] << 16) | (bytes[off + i*4+3] << 24));
    let aa = a, bb = b, cc = c, dd = d;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (bb & cc) | (~bb & dd); g = i; }
      else if (i < 32) { f = (dd & bb) | (~dd & cc); g = (5*i + 1) % 16; }
      else if (i < 48) { f = bb ^ cc ^ dd; g = (3*i + 5) % 16; }
      else { f = cc ^ (bb | ~dd); g = (7*i) % 16; }
      const t = dd;
      dd = cc; cc = bb;
      bb = bb + rl((aa + f + K[i] + M[g]) >>> 0, S[(i >> 4) * 4 + (i % 4)]);
      aa = t;
    }
    a = (a + aa) >>> 0; b = (b + bb) >>> 0; c = (c + cc) >>> 0; d = (d + dd) >>> 0;
  }
  const toHex = (n) => {
    let h = "";
    for (let i = 0; i < 4; i++) h += ((n >>> (i*8)) & 0xff).toString(16).padStart(2, "0");
    return h;
  };
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

function buildHeaders(country, auth) {
  const h = {
    "content-type": "application/json",
    "model-type": "DESKTOP",
    "app-name": "anker_power",
    "os-type": "android",
    "country": country,
    "timezone": gmtTimezoneString(),
  };
  if (auth) {
    if (auth.gtoken) h["gtoken"] = auth.gtoken;
    if (auth.token) h["x-auth-token"] = auth.token;
  }
  return h;
}

// Authenticate via passport/login. Returns { gtoken, token, nickname, userId, raw }
export async function ankerAuthenticate(base, email, password, country) {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ankerPub = await crypto.subtle.importKey("raw", hexToBytes(ANKER_PUBLIC_KEY_HEX), { name: "ECDH", namedCurve: "P-256" }, false, []);

  // Raw ECDH shared secret (32 bytes) used directly as the AES key.
  const sharedBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ankerPub }, keyPair.privateKey, 256));
  const aesKey = await crypto.subtle.importKey("raw", sharedBits, { name: "AES-CBC", length: 256 }, false, ["encrypt"]);
  const iv = sharedBits.slice(0, 16); // seed of 16 = first 16 bytes of shared key
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, aesKey, new TextEncoder().encode(password)));
  const encPassword = b64encode(cipher);

  // Client public key = uncompressed point (04 || x || y) in hex — exactly what exportKey("raw") yields.
  const clientPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const clientPubHex = bytesToHex(clientPubRaw);

  const body = {
    ab: country.toUpperCase(),
    client_secret_info: { public_key: clientPubHex },
    enc: 0,
    email: email,
    password: encPassword,
    time_zone: offsetMs(),
    transaction: tsMs(),
  };

  const resp = await fetch(`${base}/${ENDPOINTS.login}`, {
    method: "POST",
    headers: buildHeaders(country, null),
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!resp.ok) throw new Error(`login HTTP ${resp.status}: ${text.slice(0, 300)}`);

  // Anker returns HTTP 200 with an error `code` in the body for failures
  // (e.g. 100032 "Captcha id empty" when the account is anti-bot flagged).
  const errCode = data.code != null ? Number(data.code) : 0;
  if (errCode >= 10000) {
    if (errCode === 100032) {
      throw new Error("Anker login blocked by a captcha (anti-bot). This is triggered by too many logins in a short period. Wait a while and retry — syncs now reuse a cached token to avoid repeated logins.");
    }
    throw new Error(`login failed (${errCode}): ${data.msg || "unknown error"}`);
  }

  const d = data.data || {};
  const userId = d.user_id || d.userid || "";
  return {
    token: d.auth_token || d.token || "",
    gtoken: userId ? md5(String(userId)) : "",
    nickname: d.nick_name || d.nickname || "",
    userId,
    raw: data,
  };
}

// Authenticated POST to a power_service endpoint. Returns parsed JSON.
export async function ankerRequest(base, path, payload, auth, country) {
  const resp = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: buildHeaders(country, auth),
    body: JSON.stringify(payload || {}),
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!resp.ok) throw new Error(`${path} HTTP ${resp.status}: ${text.slice(0, 300)}`);
  return data;
}

function isTokenError(e) {
  return /token error|HTTP 401/i.test(e.message || "");
}

// Persist a freshly authenticated token to the caller's UserIntegration record.
async function persistAuth(base44, integrationId, auth) {
  try {
    await base44.entities.UserIntegration.update(integrationId, {
      anker_token: auth.token,
      anker_gtoken: auth.gtoken,
      anker_user_id: auth.userId,
    });
  } catch { /* best effort — cache is a convenience */ }
}

// High-level Anker session for a backend function.
// Resolves the CALLING user's Anker credentials (RLS-scoped), reuses a cached
// auth token when present, and only re-authenticates (persisting the new token)
// when Anker rejects the cached one. Minimising logins avoids Anker's anti-bot
// captcha and stops kicking the official mobile app session.
export async function createAnkerSession(base44) {
  const { getUserIntegration } = await import("./userIntegration.ts");
  const integration = await getUserIntegration(base44);
  if (!integration || !integration.anker_email || !integration.anker_password || !integration.anker_country) {
    const e = new Error("Anker credentials not configured. Add your Anker SOLIX details in Settings.");
    e.code = "CREDENTIALS_MISSING";
    throw e;
  }
  const country = integration.anker_country;
  const base = serverForCountry(country);
  const email = integration.anker_email;
  const password = integration.anker_password;

  let auth = null;
  if (integration.anker_token) {
    auth = { token: integration.anker_token, gtoken: integration.anker_gtoken, userId: integration.anker_user_id };
  }
  if (!auth || !auth.token) {
    auth = await ankerAuthenticate(base, email, password, country);
    await persistAuth(base44, integration.id, auth);
  }

  async function request(path, payload) {
    try {
      return await ankerRequest(base, path, payload, auth, country);
    } catch (e) {
      if (isTokenError(e)) {
        // Token expired or kicked out — re-authenticate once, persist, retry.
        auth = await ankerAuthenticate(base, email, password, country);
        await persistAuth(base44, integration.id, auth);
        return await ankerRequest(base, path, payload, auth, country);
      }
      throw e;
    }
  }

  return { request, auth, base, country, integration };
}