---
name: gpu-glossary
description: A plain-language GPU rendering glossary and Canvas2D to GPU primer. Read when writing about GPU internals for a non-specialist audience.
---

# GPU Rendering Glossary & Primer

A plain-language guide to how JBrowse draws tracks on the GPU, plus the precise
vocabulary for writing about it — for anyone from leadership to a plugin author
to whoever's drafting the paper.

How to read it, by audience:
- **Leadership / mildly technical:** read §0 — it hands you the vocabulary and
  the contrasts in one page.
- **New to GPU graphics:** read §0, then §1–§2 for the mental model.
- **Writing the paper / talk:** §3–§7 are the techniques, §9 is paste-ready prose.
- **Need a specific term:** jump to the §8 dictionary.

---

## 0. Executive summary: the vocabulary that makes the difference click

**What we changed, in one sentence.** We rebuilt how JBrowse draws genome tracks
so the work happens on the **GPU** (the graphics chip — the same hardware that
renders video games) instead of the **CPU**, and we re-engineered the entire
data path that feeds it.

**Why it mattered.** A single view can contain hundreds of thousands to millions
of features (sequencing reads, variants, alignment columns). The old path drew
them one at a time on the CPU, so past a certain density the view stuttered on
pan/zoom or we had to cap what users could see. That is a direct ceiling on the
science people can do in the browser.

### The one contrast to internalize

**Canvas2D is *immediate mode*: the CPU draws one shape at a time.** You call a
draw command per feature and it paints right then — 500,000 features means
500,000 sequential CPU operations, every frame.

**The GPU is a *pipeline*: you hand it all the data at once and it draws
everything in parallel.** Same job, but a printing press instead of a clerk with
a pen. The vocabulary below is just the names for how that press works.

| Term (use this word) | Canvas2D world | What it means here |
|---|---|---|
| **GPU** | (only had the CPU) | the parallel graphics chip we now draw on |
| **Shader** | your draw-and-color code | a tiny program the GPU runs on *every* feature at once, in parallel |
| **Buffer** | a JS array of objects | all features packed into one compact block of raw numbers |
| **Upload** | (no equivalent) | the one-time copy of that block into the GPU's own memory |
| **Draw call** | one `fillRect` per feature | a *single* command that draws *all* the features |
| **Instancing** | a loop redrawing the shape | "here's one rectangle, stamp it 500,000 times with this data" |

If leadership remembers four words — **buffer, upload, draw call, shader** — they
can follow the whole story: *we pack features into a **buffer**, **upload** it to
the GPU once, and a single **draw call** runs a **shader** that paints them all
in parallel.*

### How we "fully optimized around" the GPU

Moving to the GPU is only half of it; we also rebuilt the *data path* that feeds
it. Four moves, each a phrase worth saying out loud:

- **Batching / instancing** — we don't issue one draw per feature; one draw call
  renders an entire screen of features. The CPU stops being the bottleneck.
- **Upload once, reuse** — panning and zooming no longer redraw from scratch.
  The data already lives in GPU memory, so navigating just re-runs the shaders
  over it. This is *why* interaction feels instant.
- **Zero-copy pipeline (parse → pack → upload)** — data is decoded straight into
  the exact binary layout the GPU consumes and handed off without being copied
  again. The data is touched essentially **once** between disk and screen,
  instead of being re-marshalled at each step.
- **Write once, run everywhere** — every visual is authored in a single source
  and auto-compiled to run on all GPU backends, so supporting multiple graphics
  interfaces doesn't multiply our maintenance cost.

### The payoff (what users feel)

- Dramatically smoother pan/zoom and far higher feature density on the *same*
  laptop — _[drop in jb2bench numbers: e.g. "X× faster render, Y× more features
  before stutter, webgl-poc vs. prior release"]_.
- Base-accurate positioning even zoomed across a 3-billion-base genome, which the
  old precision could not guarantee.

**How we kept it safe (three-tier fallback).** Newest/fastest interface
(**WebGPU**) where available → older one (**WebGL2**) → and if a machine has no
working GPU at all, the original **Canvas2D** CPU path. **No user is left unable
to view their data**; worst case they get the old behavior. Adoption risk is low
by design.

**Does this make JBrowse harder to customize? No — the GPU is opt-in.**
**Canvas2D is still the baseline; every display can draw with it** (we require a
Canvas2D path anyway, for image/SVG export). The GPU is a *performance upgrade a
display opts into* when its data volume demands it (roughly >100K features on
screen) — a plugin author writes a new track the same simple Canvas2D way as
before, reaching for the GPU only if they hit a wall. Everyday customization —
colors, thresholds, what's shown, hover text — lives in configuration and never
touched the rewrite. The skill bar rises for exactly one narrow case: writing
brand-new *high-performance, pixel-level* drawing. Everything else is unchanged,
with the CPU path as a permanent escape hatch.

**What it unlocks.** This is foundational infrastructure, not a one-off feature:
it raises the ceiling on dataset size and density across every track type, makes
previously-impractical views (dense matrices, whole-genome overviews, large
multi-genome comparisons) interactive, and puts JBrowse on the rendering
technology the web is standardizing on.

The rest of this document explains *how* it works, for engineers and the paper.

---

## 1. Start here: one concrete example

Forget GPUs for a second. Say you want to draw **50,000 genes** as little
rectangles across the screen.

**The Canvas2D way** (what JBrowse used to do): loop in JavaScript, and for each
gene call `ctx.fillRect(x, y, width, height)`. 50,000 function calls, run one
after another on the CPU. Simple, but the CPU is doing all 50,000 by hand, every
frame.

**The GPU way** (what JBrowse does now): write down all 50,000 genes' positions
and colors into one long list of numbers, hand that whole list to the graphics
card once, and say "draw all of these." The graphics card then colors the pixels
for all 50,000 rectangles *at the same time*, using hundreds of tiny cores
working in parallel.

That's the entire idea. Everything below is just the names for the parts of
"write down a list of numbers, hand it over once, and say draw."

The catch — and the reason there's vocabulary to learn — is that the GPU is a
separate piece of hardware with its own memory and its own rules. You can't just
call a function and have it draw. You have to (1) package your data the way the
hardware wants it, (2) copy it across into GPU memory, and (3) give the GPU a
tiny program telling it how to turn one entry in the list into pixels. Those
three things are §3, §4, and §6.

---

## 2. The big mental shift from Canvas2D

If you only remember one thing: **Canvas2D is a pen; the GPU is a printing
press.** With a pen you draw each mark yourself, in order. With a press you spend
effort up front setting the plates, then stamp the whole page in one motion. The
GPU is slower to set up and dramatically faster to "stamp."

Three specific differences, each of which earns a sentence in a "why GPU" paper
section:

**You don't draw one shape at a time.** Instead of 50,000 `fillRect` calls, you
hand over one list of 50,000 entries and issue a single "draw" command (a **draw
call**). The CPU stops being the bottleneck because it's no longer babysitting
each shape.

**The GPU runs the same little program on everything at once.** Canvas2D fills a
rectangle by having the CPU walk its pixels one by one. The GPU runs a small
program called a **shader** across hundreds of cores simultaneously. You write
the program for *one* rectangle; the hardware runs copies of it across all of
them. (This is the "data-parallel" or "SIMD" part — same instructions, many data
items.)

**You don't give commands, you configure a machine.** Canvas2D has verbs:
`stroke`, `fill`, `arc`. The GPU has a fixed assembly line — the **pipeline** —
with two slots where you can insert your own programs and a few fixed knobs
(like how to blend transparent colors). You don't tell it "draw a circle"; you
feed it geometry plus a program, and a circle comes out the end.

| Canvas2D | GPU equivalent | Plain meaning |
|---|---|---|
| `fillRect` in a loop | one instanced **draw call** | draw many copies of a shape at once |
| `fillStyle = color` | the **fragment shader** | the code that picks each pixel's color |
| computing `x` from a coordinate | the **vertex shader** | the code that places each corner on screen |
| `ctx.clip()` | the **scissor** rectangle | "only paint inside this box" |
| `globalAlpha` / compositing | **blending** | how a new color mixes with what's there |
| the canvas itself | the **framebuffer** | the image being drawn into |

---

## 3. The pipeline: the GPU's assembly line

"The pipeline" is just the fixed sequence of stages every draw call passes
through. Picture an assembly line where geometry goes in one end and colored
pixels come out the other. Naming the stages keeps a methods section crisp:

1. **Buffer** → the list of numbers (your 50,000 genes) sitting in GPU memory.
2. **Vertex shader** → runs once per corner of each shape. Its only job: "where
   on screen does this corner go?" For us, this is where a base-pair position
   becomes a screen position. (Your program — slot #1.)
3. **Rasterizer** → fixed, not programmable. Takes each triangle and figures out
   which pixels it covers. Also smoothly **interpolates** the vertex shader's
   outputs across those pixels (so a value set at the corners becomes a value at
   every pixel in between).
4. **Fragment shader** → runs once per covered pixel. Its only job: "what color
   is this pixel?" Gradients, anti-aliased edges, and color lookups happen here.
   (Your program — slot #2.)
5. **Blending** → fixed. Mixes the new pixel color with whatever was already
   there (this is how transparency and overlapping features composite).
6. **Framebuffer** → the finished image, i.e. the canvas the user sees.

The spine to memorize: **buffer → vertex shader → rasterizer → fragment shader →
blend → framebuffer.** Stages 2 and 4 are the ones you write; the rest you only
configure.

---

## 4. How data gets to the GPU (the part Canvas2D never had)

This is the genuinely new concept, because the GPU has its *own memory* separate
from JavaScript's. Getting your 50,000 genes into it has a fixed journey:

**compute → pack → transfer → upload → draw**

- **Compute** — we calculate each gene's geometry in a background thread (a web
  **worker**), off the main UI thread, so the page stays responsive.
- **Pack** — instead of an array of JavaScript objects (`{start, width, color}`),
  we write the values into one flat block of raw bytes (a typed array like
  `Float32Array`), with a fixed number of bytes per gene. Think of it as a
  tightly-packed spreadsheet with no labels — just rows of numbers in a known
  order. The bytes-per-gene is the **instance stride**. (Objects are convenient
  for code but wasteful and slow to hand to hardware; packed bytes are what the
  GPU actually wants.)
- **Transfer** — hand that block of bytes from the worker thread to the main
  thread. We do this **zero-copy** (the worker gives up ownership of the memory
  rather than cloning it), which is fast even for big blocks.
- **Upload** — copy the block from regular memory into **GPU memory**
  (`hal.uploadBuffer`). *This is the one cost Canvas2D never pays.* The whole
  performance game is to upload once and then reuse it: panning and zooming just
  re-run the shaders against data that's already on the GPU. Only scrolling to a
  brand-new region triggers a fresh upload.
- **Draw** — issue the **draw call** (`hal.drawPass`) that runs the pipeline over
  the uploaded buffer and paints the frame.

Two supporting ideas you'll need words for:

- **Uniforms vs. attributes.** An **attribute** is data that's *different for
  each gene* (its position, its color) — it lives in the packed buffer. A
  **uniform** is one value that's *the same for the whole draw call* (the current
  zoom level, the canvas size). Mnemonic: attributes vary, uniforms are uniform.
- **Textures and samplers.** A **texture** is an image (or a strip of colors)
  living in GPU memory that a shader can look things up in — we use them as color
  palettes. A **sampler** is the little rule for how to read it (snap to the
  nearest color, or blend between them).

---

## 5. Instancing: the trick that makes it fast

This is the single most important technique to name in a paper, because it's
*why* the GPU path beats the Canvas2D loop.

All our genes are the same shape — a rectangle — just at different places, sizes,
and colors. (A rectangle on a GPU is a **quad**: two triangles, because GPUs only
draw triangles.) **Instanced rendering** means: describe the basic rectangle
*once*, put the 50,000 per-gene differences in the packed buffer, and fire a
single draw call that says "draw this rectangle 50,000 times — and for copy
number *i*, read row *i* of the buffer for where to put it and what color."

The shader gets told two things: which corner of the rectangle it's working on,
and which gene (which copy) this is. That's enough to position and color all
50,000 with one command and zero per-gene JavaScript.

Paper sentence: *"Each feature is encoded as one instance record; a single
instanced draw call renders an entire block of features, eliminating the
per-feature CPU dispatch of the Canvas2D path."*

---

## 6. Shaders, for someone who knows `fillRect`

**The one-line intuition: a shader is the *inside of your draw loop*, shipped to
the GPU.** You're already writing shader logic in Canvas2D — you just run it
yourself, in a loop. Look at the two lines that *decide* things:

```js
for (const f of features) {
  const x = (f.start - viewStart) * pxPerBp        // WHERE it goes  → vertex shader
  ctx.fillStyle = f.score > 90 ? 'green' : 'red'   // WHAT COLOR     → fragment shader
  ctx.fillRect(x, y, w, h)                          // the stamp itself
}
```

The two computed lines — *where* a feature goes and *what color* it is — are
exactly what a shader contains. The difference is who runs them: in Canvas2D
**you** loop a million times on the CPU; with a shader you hand those lines to
the GPU once and it runs them on all million features in parallel.

The GPU splits that loop body into the two shaders you write:

- **Vertex shader = the *where* line.** The base-pair-to-pixel math, run on the
  GPU once per corner. Input: the gene's start/width plus the uniforms (zoom,
  canvas size); output: a position on screen.
- **Fragment shader = `fillStyle`, but per pixel.** It picks one pixel's color.
  Running per pixel gives you gradients, anti-aliased edges, and palette lookups
  essentially for free.

A few ideas Canvas2D never exposed you to:

- **Clip space.** The GPU doesn't think in pixels; it uses its own coordinate
  system that runs from −1 to +1 across the screen, regardless of resolution. The
  vertex shader's job is to convert your coordinates into this −1…+1 space. (This
  is unrelated to Canvas2D's `clip()` — that idea is "scissor," below.)
- **Interpolation (varyings).** A value the vertex shader sets at the corners is
  automatically blended across the shape before the fragment shader sees it. Set
  a color at each corner and you get a gradient in between, for free.
- **Same code, no peeking at neighbors.** Every copy of the shader runs the same
  instructions on its own data and can't see the others. Straight-line math is
  cheap; lots of `if`-branches that disagree between neighboring pixels are
  comparatively slow.
- **No objects, no allocation.** Shaders work in small fixed vectors of numbers
  (`float2`, `float4`) — no heap, no strings. You think in packed numbers, not
  objects.

---

## 7. What's special about *our* GPU work

The boilerplate above is true of any GPU app. These are the parts a paper would
actually claim as engineering contributions.

### 7a. Write the shader once, run it on two GPU APIs
The browser has two GPU APIs — the newer **WebGPU** and the older **WebGL2** —
and each speaks a different shader language (**WGSL** and **GLSL**
respectively). Maintaining two copies of every shader would be miserable.
Instead we write each shader *once* in a language called **Slang**, and a build
step compiles it ahead of time into both WGSL and GLSL, plus a little TypeScript
file describing the byte layout. So one renderer drives both GPU APIs from a
single source of truth. The same build step reads the shader to derive the
exact byte layout of the packed buffer, so the CPU-side packing can't silently
drift out of sync with what the shader expects.
*Phrase: "a single shader source, compiled ahead-of-time to dual targets."*

### 7b. Sub-pixel accuracy across a 3-billion-base genome ("hp-math")
GPUs do math in 32-bit floats, which can only hold about 7 significant digits.
A human genome is ~3 billion bases — so near the far end, a single float can't
tell two adjacent bases apart (you lose ~256 bases of precision). Our fix: split
each base-pair coordinate into a **high part and a low part** (two floats
together), and do the position math on the parts separately so the precision
survives. The result is base-accurate placement even when zoomed all the way
into a 3-billion-base genome. (Technique adapted from genome-spy, MIT.) One
subtlety worth a sentence in a paper: the shader compiler *wants* to "optimize"
the two parts back into one number, which would destroy the whole point, so the
math is written carefully to stop it from doing that.
*Phrase: "an emulated high/low float-pair coordinate transform preserves
sub-pixel base accuracy at whole-genome scale."*

### 7c. One interface over three rendering backends (the HAL)
We never call WebGPU or WebGL2 directly from track code. Both sit behind one thin
interface — the **HAL** (hardware abstraction layer) — that exposes plain verbs
like "upload this buffer," "draw this pass," "clip to this rectangle." On top of
the HAL, the same track code can also run on a pure-CPU **Canvas2D** path for
machines with no working GPU. So there are effectively three **backends** —
WebGPU, WebGL2, Canvas2D — behind one set of code. (A change to one GPU backend
must be mirrored in the other and in a test mock; we call that "HAL parity.")

**The GPU path is opt-in, Canvas2D is the baseline.** Every display already
ships a Canvas2D draw function (image/SVG export requires one), so a display can
be Canvas2D-only and skip the GPU entirely (`createCanvas2DBackend`); it gets the
GPU shader path only by opting into the dual-path `createRenderingBackend`. The
lifecycle machinery (`RenderLifecycleMixin` / `DisplayChrome`) is
backend-agnostic — nothing downstream knows whether a HAL exists. The documented
guidance is to *start a new display on Canvas2D and promote it to the GPU only
once profiling shows Canvas2D can't hold 60fps at real feature counts* (≳100K
features/frame). This is what keeps the rendering rewrite from raising the
authoring bar for ordinary displays.

### 7d. Clipping with the scissor, not clip paths
To keep each genomic block's drawing inside its slot, we use the GPU's
**scissor** — a hardware "only paint inside this rectangle" mask — rather than
clip paths. The Canvas2D fallback clamps to the exact same rectangle, so all
three backends clip identical pixels.

### 7e. Two shapes of backend: per-region and global
Most tracks are **per-region**: the screen is split into blocks, each block's
data is uploaded and drawn separately, and blocks are discarded as you scroll
away. A few dense displays (Hi-C, LD, the variant matrix) are **global**: one big
upload and one draw for the whole thing, no block splitting. Handy to name when
explaining why some tracks stream smoothly and others rebuild all at once.

### 7f. Packed colors
Rather than store each color as four separate numbers, we **pack** it into one
compact integer inside each gene's record. Smaller records mean less data to
copy to the GPU, i.e. faster uploads.

### 7g. A zero-copy pipeline: parse output *is* the upload payload
The usual flow — parse into JS objects, deep-copy them across the worker
boundary, then walk them again on the main thread to build a buffer — touches the
data three times and allocates twice. We collapse it: the worker decodes
**straight into the exact binary layout the GPU consumes**, then hands that
buffer to the main thread as a **transferable** (ownership moves, no copy; the
sender's buffer is left detached). The main thread passes those same bytes
directly to `hal.uploadBuffer`. The data is touched essentially **once** between
parse and screen. Where encoding depends on theme/settings rather than the raw
data (e.g. MAF), we pack on the main thread instead, so a recolor re-runs only
the cheap pack step with no worker roundtrip — and run-length-merge during
packing so the instance count tracks color transitions, not base count.
*Phrase: "decode directly into GPU-ready buffers and transfer them zero-copy, so
data is materialized once between worker and GPU."*

---

## 8. Dictionary (jump in anywhere)

- **Attribute** — data that differs per gene (position, color); lives in the
  packed buffer. Opposite of a *uniform*.
- **Backend** — which renderer is actually running: WebGPU, WebGL2, or Canvas2D.
- **Bind / binding** — connecting a specific buffer/texture so a shader can read
  it.
- **Blending** — the rule for mixing a new pixel's color with what's already
  there; how transparency and overlaps work.
- **Buffer** — a block of GPU memory holding the packed list of numbers.
- **Canvas2D** — the CPU drawing API; here, the baseline every display supports
  and the fallback when there's no GPU. The GPU path is opt-in on top of it.
- **Clip space** — the GPU's own −1…+1 coordinate system; what the vertex shader
  outputs.
- **Draw call / draw pass** — the single command that runs the pipeline and
  paints (`hal.drawPass`).
- **Fragment shader** — the program that picks each pixel's color (Canvas2D's
  `fillStyle`, but per pixel). Also called a pixel shader.
- **Framebuffer** — the image being drawn into; the canvas the user sees.
- **GLSL** — WebGL2's shader language; one of our two compile targets.
- **Glyph** — the shape drawn per feature (rectangle, arc, chevron…).
- **HAL** — hardware abstraction layer; one interface hiding WebGPU vs. WebGL2.
- **hp-math** — our high/low float-pair trick for base-accurate positions on a
  huge genome.
- **Instancing / instance / instance stride** — drawing one shape many times
  from a packed list; the stride is the bytes-per-item.
- **Interpolation (varying)** — a corner value blended smoothly across a shape
  before the fragment shader.
- **Pass** — one configured run of the pipeline (its shaders + settings); a
  renderer may do several.
- **Pipeline** — the GPU's fixed assembly line: vertex → raster → fragment →
  blend.
- **Quad** — a rectangle built from two triangles (GPUs only draw triangles).
- **Rasterizer** — the fixed stage that turns triangles into pixels and
  interpolates corner values.
- **Region** — a genomic block's slice of data in a per-region backend.
- **Sampler** — the rule for how a texture is read (nearest pixel vs. blended).
- **Scissor** — a hardware "paint only inside this rectangle" clip.
- **Shader** — a small program the GPU runs in parallel (vertex or fragment).
- **Slang** — the one language we write shaders in; compiled to WGSL + GLSL.
- **Texture** — an image or color strip in GPU memory that a shader looks up
  values in.
- **Transfer (transferable)** — handing a block of bytes from worker to main
  thread without copying.
- **Uniform** — one value that's the same for the whole draw call (zoom, canvas
  size). Opposite of an *attribute*.
- **Upload** — copying data from regular memory into GPU memory; the cost
  Canvas2D never pays.
- **Vertex shader** — the program that places each corner on screen (the
  base-pair → pixel math).
- **WebGL2 / WebGPU** — the browser's two GPU APIs; WebGPU is primary, WebGL2 the
  fallback.
- **WGSL** — WebGPU's shader language; our other compile target.
- **Worker** — a background thread where we compute geometry off the UI thread.

---

## 9. Sentences you can paste into prose

- "Per-feature geometry is computed in background workers, packed into flat
  binary buffers, and transferred to the main thread without copying."
- "Each feature becomes one instance record; a single instanced draw call renders
  an entire block, eliminating the per-feature CPU work of the Canvas2D path."
- "Shaders are authored once in Slang and compiled ahead-of-time to WGSL and
  GLSL, so a single renderer drives both WebGPU and WebGL2."
- "Panning and zooming re-run the shaders against buffers already resident on the
  GPU; only a newly visible region triggers a fresh upload."
- "Base-accurate positioning across a three-billion-base genome is preserved with
  an emulated high/low float-pair coordinate transform."
- "A hardware abstraction layer presents one rendering interface over WebGPU,
  WebGL2, and a CPU Canvas2D fallback."
- "The GPU path is opt-in: Canvas2D remains the baseline every display supports,
  and a display adopts the GPU only when its feature counts demand it."
- "Geometry is decoded directly into GPU-ready binary buffers and transferred
  zero-copy, so the data is materialized only once between worker and GPU."
