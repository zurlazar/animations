# Connecting a 3D generator (photo → 3D)

The Studio turns an uploaded device photo into a 3D model. It auto-detects the
provider from whatever you paste into the **“Connect a generator”** field:

| You paste… | Provider | Cost |
|---|---|---|
| `hf_…` (Hugging Face token) | **Hugging Face Space** (TripoSR) | **Free** |
| `msy_…` (Meshy key) | Meshy image-to-3D API | Paid (credits) |
| an `https://…` URL | a Meshy proxy (see bottom) | — |
| nothing | procedural sample device | Free |

Whatever you paste is stored **only in your browser** (`localStorage`) and sent
straight to the provider — never committed to this repo or routed through us.

---

## Free — Hugging Face (recommended)

1. Create a free account at [huggingface.co](https://huggingface.co).
2. Make a token at **[Settings → Access Tokens](https://huggingface.co/settings/tokens)**
   (a **read** token is enough). It starts with `hf_`.
3. Paste it into the Studio’s generator field → **Save**.
4. Upload a device photo → **Generate 3D model**.

Behind the scenes the Studio drives the public **TripoSR** Space
(`stabilityai/TripoSR`) with `@gradio/client`: `/preprocess` (remove background)
→ `/generate` → loads the returned **GLB**.

### Honest expectations
- **It’s free, so it’s shared.** The Space runs on free GPUs — expect **queues,
  slow runs (seconds to minutes), or occasional downtime**.
- **Quality varies.** TripoSR is fast but rough on complex objects; it shines on
  clean, single, well-lit product shots on a plain background.
- **Spaces change.** If the Space updates its API or goes away, generation can
  break and need a fix. To point at a different Space without a code change, set
  one in your browser console:
  ```js
  localStorage.setItem("hf_space", "stabilityai/TripoSR"); // or another image-to-3D Space
  ```
- **CORS:** if your browser blocks the call, try a desktop browser.

Higher-quality free Spaces exist (e.g. TRELLIS, Hunyuan3D) but expose
multi-step, stateful APIs that change often; TripoSR is the most stable to drive
automatically.

---

## Paid — Meshy (more reliable, better quality)

1. Get a key at **meshy.ai → Settings → API** (starts with `msy_`).
2. Paste it into the generator field → **Save**.
3. Generate. Uses Meshy credits.

If your browser blocks the direct call (CORS), use the proxy below and paste the
**worker URL** instead of the key.

### Optional Meshy proxy (Cloudflare Worker, free to host)

```js
// worker.js — proxies Studio → Meshy, injecting the key + CORS headers.
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
    const res = await fetch(MESHY + url.pathname + url.search, {
      method: request.method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.MESHY_KEY}` },
      body: request.method === "POST" ? await request.text() : undefined,
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  },
};
```

Deploy on **Cloudflare → Workers & Pages → Create → Worker**, add a secret
`MESHY_KEY` (your `msy_…`), then paste the worker URL into the Studio.

---

## What the Studio sends

- **Hugging Face:** image → `/preprocess` → `/generate` on the Space; loads the output `.glb`.
- **Meshy:** `POST {base}/image-to-3d` `{ image_url: <data URI>, should_texture, target_formats:["glb"] }`,
  polls `GET {base}/image-to-3d/{id}` until `SUCCEEDED`, loads `model_urls.glb`.
