# Connecting Meshy (real image → 3D)

The Studio can turn *your* uploaded photo into a 3D model using
[Meshy](https://www.meshy.ai)'s Image-to-3D API. There are two ways to connect,
depending on whether your browser allows the direct call.

---

## Option A — Bring your own key (simplest)

1. Create a Meshy account and copy your API key from
   **meshy.ai → Settings → API** (starts with `msy_`).
2. In the Studio, paste the key into the **“Meshy AI · real image → 3D”** field
   and press **Save key**.
3. Upload a device photo and press **Generate 3D model**.

Your key is stored **only in your browser** (`localStorage`) and sent straight
to Meshy — it is never committed to this repo or sent anywhere else.

> **If Generate fails with a CORS / “browser blocked the request” error**, your
> browser won’t let a static site call `api.meshy.ai` directly. Use Option B.

---

## Option B — Free Cloudflare Worker proxy (robust, hides the key)

A tiny proxy holds the key server-side and adds the CORS headers browsers need.
It runs free on Cloudflare Workers.

### 1. Create the worker

Save this as `worker.js`:

```js
// Proxies the Studio → Meshy, injecting the API key and CORS headers.
const MESHY = "https://api.meshy.ai/openapi/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    // Everything after the worker origin is forwarded to Meshy.
    const target = MESHY + url.pathname + url.search;

    const res = await fetch(target, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MESHY_KEY}`,
      },
      body: request.method === "POST" ? await request.text() : undefined,
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  },
};
```

### 2. Deploy it

Using the Cloudflare dashboard (no install needed):

1. Go to **Cloudflare → Workers & Pages → Create → Worker**.
2. Paste `worker.js`, deploy. You’ll get a URL like
   `https://meshy-proxy.<you>.workers.dev`.
3. In the worker’s **Settings → Variables → Add secret**, add
   `MESHY_KEY` = your `msy_...` key. Redeploy.

(Or with the CLI: `npx wrangler deploy worker.js` then
`npx wrangler secret put MESHY_KEY`.)

### 3. Point the Studio at it

In the Studio’s Meshy field, paste the **worker URL** (instead of a key) and
press **Save key**. The Studio detects the `https://` prefix and routes through
the proxy — the key stays on Cloudflare, never in the browser.

---

## What the Studio sends

- `POST {base}/image-to-3d` with `{ image_url: <base64 data URI>, should_texture: true, target_formats: ["glb"] }`
- polls `GET {base}/image-to-3d/{id}` until `status === "SUCCEEDED"`
- loads `model_urls.glb` into the viewer

`{base}` is `https://api.meshy.ai/openapi/v1` for Option A, or your worker URL
for Option B.
