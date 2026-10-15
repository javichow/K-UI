// Cloudflare Pages Function — proxy the kui-backupsel panel (VPS 148.135.60.143:8920)
// so it can be opened at https://k-ui-f47.pages.dev/backupsel over HTTPS.
// - Serves the panel HTML, rewriting its relative /api/* calls to /backupsel/api/*
// - Transparently proxies /backupsel/* -> VPS /* with the panel's basic-auth injected
// - Does NOT touch the existing /api/* handler (functions/api/[[path]].js)
const VPS = "http://148.135.60.143:8920";
const AUTH = "Basic " + btoa("kui:kui2026");

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let sub = url.pathname.replace(/^\/backupsel/, "") || "";
  if (sub === "/") sub = "";

  // 1) Panel page: fetch HTML from VPS, patch it so its JS targets /backupsel/*
  if (sub === "") {
    const res = await fetch(VPS + "/", { headers: { Authorization: AUTH } });
    let html = await res.text();
    // route the panel's relative API calls through our proxy
    html = html.replace("fetch(path,", "fetch('/backupsel'+path,");
    // pre-fill the panel credential so it loads straight through (still over HTTPS)
    html = html.replace(
      'sessionStorage.getItem(CRED_KEY) || "";',
      'sessionStorage.getItem(CRED_KEY) || btoa("kui:kui2026");'
    );
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // 2) API sub-routes: /backupsel/api/state -> VPS /api/state
  const target = VPS + sub + (url.search || "");
  const headers = { Authorization: AUTH };
  const hasBody = context.request.method !== "GET" && context.request.method !== "HEAD";
  const opts = { method: context.request.method, headers };
  if (hasBody) {
    opts.body = await context.request.arrayBuffer();
    const ct = context.request.headers.get("Content-Type");
    if (ct) headers["Content-Type"] = ct;
  }
  const vres = await fetch(target, opts);
  const out = new Headers({
    "Content-Type": vres.headers.get("Content-Type") || "application/json",
    "Cache-Control": "no-store",
  });
  return new Response(vres.body, { status: vres.status, headers: out });
}
