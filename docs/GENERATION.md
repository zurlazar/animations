# Connecting a 3D generator (photo → 3D)

The Studio turns an uploaded device photo into a 3D model. It auto-detects the
provider from whatever you paste into the **“Connect a generator”** field:

| You paste… | Provider | Cost |
|---|---|---|
| a `…gradio.live` URL | **Your own GPU** (Colab notebook) | **Free**, reliable |
| `hf_…` (Hugging Face token) | Hugging Face Space (TripoSR) | Free, can queue |
| `msy_…` (Meshy key) | Meshy image-to-3D API | Paid (credits) |
| another `https://…` URL | a Meshy proxy (see bottom) | — |
| nothing | procedural sample device | Free |

Whatever you paste is stored **only in your browser** (`localStorage`) and sent
straight to the provider — never committed to this repo or routed through us.

---

## Best free + reliable — your own GPU via Colab

If you have Colab (Pro helps), run the model on **your** GPU — fast, no shared
queue, effectively free (uses your Colab compute).

1. Open **[`colab/animations_image_to_3d.ipynb`](../colab/animations_image_to_3d.ipynb)**
   in Google Colab (upload it, or **File → Open notebook → GitHub**).
2. **Runtime → Change runtime type → GPU**, then **Runtime → Run all**.
3. Wait for the last cell to print a line like
   `Running on public URL: https://XXXX.gradio.live`.
4. Copy that URL into the Studio's **Connect a generator** field → **Save**.
5. Upload a photo → **Generate**. It runs on your GPU.

The Studio speaks the Gradio protocol, so it drives the notebook's TripoSR app
directly (`/preprocess` → `/generate` → GLB). Keep the notebook running while
you use the Studio. **The `gradio.live` URL changes every session** — paste the
fresh one each time.

### Best single-photo quality — `animations_trellis_to_3d.ipynb`

For the sharpest result from **one** photo, run
**[`colab/animations_trellis_to_3d.ipynb`](../colab/animations_trellis_to_3d.ipynb)**
— it runs **TRELLIS**, which produces detailed, **textured** models far beyond
TripoSR, with the same single-photo flow. The Studio auto-detects it (a
single-image `generate` endpoint) and sends your Front photo straight in.

*Heaviest notebook:* it builds custom CUDA extensions and pins torch, so the
first run is **~15–20 min** and the most likely to need a dependency tweak — if
a cell errors, grab the red text. Textured output (real colors).

### Multi-view (much truer shape) — `animations_multiview_to_3d.ipynb`

Single-view TripoSR has to *guess* the sides it can't see, so complex devices
come out distorted. For a far more accurate result, run
**[`colab/animations_multiview_to_3d.ipynb`](../colab/animations_multiview_to_3d.ipynb)**
instead — it runs **Hunyuan3D-2mv**, which reconstructs from several angles.
Same flow (Run all → paste the `gradio.live` URL), then fill the **Front / Back
/ Left / Right** slots in the Studio. The Studio auto-detects this app (its
`generate_mv` endpoint) and sends every view you provide in one call.

*Experimental:* first run downloads several GB (~10 min), and v1 produces
**untextured** geometry (accurate shape, solid color). Use the single-view
notebook when you want a quick textured model.

### Photo quality — this matters most

Whatever the generator, the input photos dominate the result:
- **Isolate the device.** Plain background, nothing else in frame — no cables,
  clamps, or a second instrument attached. A busy workbench shot → a blobby model.
- **Hold the phone upright** (a sideways photo becomes a sideways model).
- **Even, soft lighting**; avoid deep shadows on a dark device.
- For multi-view, shoot each angle at the **same distance and height**.

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
