---
name: gpu-architecture-review
description: An outside read of the GPU stack against GenomeSpy's — waiting on the Canvas2D generation census, whose count decides whether generated painters and generated hit-test geometry happen at all. The "deliberately does not have" list edits and the buffer-pool measurement landed 2026-09-04 (buffer-churn-pan, declined). Also records two things examined and declined (storage buffers in the render path, compute-driven packing) and the reasoning behind the choices that should not change
---

# GPU architecture review

Written after reading `packages/render-core`, `packages/shader-tools`,
`agent-docs/reference/GPU_RENDERING.md`, the per-plugin `Gpu*Renderer.ts`, and
the shader tree, alongside GenomeSpy's `packages/core/src/rendering` and
`packages/webgpu-renderer`. Nothing here is committed code; it is a list of
things worth doing and a record of two techniques examined and declined, so
neither gets re-derived from scratch.

The comparison itself is not the point and is not reproduced. The one-line
version: GenomeSpy is a grammar that generates shaders at runtime, we are
hand-written shaders compiled ahead of time, and almost every other difference
follows. What follows is only the part that suggests an action.

## What is worth doing

### 1. Census which Canvas2D painters could be generated

**Do this first; it decides whether the rest of the item exists.**

The mechanism is already built and already trusted: `//! export-consts:`
transliterates scalars, `//! js-export:` transliterates whole pure functions
into `*.js.generated.ts`. We already turn shader code into JS and rely on it for
parity. What follows extends that rather than inventing a path.

The census: walk all 13 renderers' pass lists and classify each pass.

- **A — transliterable functions only.** Available today; the limit is how much
  of Slang's surface the transliterator handles (vector swizzles, `saturate`,
  `lerp`, `step`, `smoothstep`, `clamp`). Worth extending regardless of B and C.
- **B — interpretable.** The painter reads the *same* packed instance buffer the
  GPU reads, through the generated `INSTANCE_OFFSET_F32` / `_U32` maps, and per
  instance calls transliterated functions for a rect and a color. Qualifies when
  there is no texture sampling, no derivatives, and the geometry is a Canvas2D
  primitive.
- **C — declarable.** A directive naming which exported functions supply the
  painter's arguments, e.g.
  `//! canvas2d: fillRect(leftPx, topPx, widthPx, heightPx, color)`, so the
  painter is generated rather than interpreted — and checkable at
  `pnpm gen:shaders` time the way `BINDINGS` is.
- **never** — samples a texture, or needs derivatives.

If eight passes qualify, build it. If two do, do not. That is the whole
decision, and it is roughly a day's work to answer.

**The shape library maps onto Canvas2D primitives unusually well**, which is
what makes this tractable — the target is native primitives, not emulation:

| Shader shape | Canvas2D |
| --- | --- |
| `rowRect`, `flatQuad`, `packedColorQuad` | `fillRect` |
| `capsule` (stroked segment, degenerate case a dot) | `lineWidth` + `lineCap: 'round'` |
| `pointGlyph` disc / square | `arc()` / `fillRect` |
| `{ op: 'max' }` blend | `globalCompositeOperation = 'lighten'` (per-channel max) |

Note that the "needs derivatives" exclusion is mostly antialiasing code, and
Canvas2D antialiases natively — that code is what we want to *drop*, not
translate.

**The payoff is larger than deleted painter code.** SVG export becomes correct
by construction for the generated set, since it runs through Canvas2D. The
`compare-backends` pixel diff becomes a tautology for those passes, so every
remaining diff is signal. And three-way parity (WGSL / GLSL / Canvas2D) shrinks
to two-way for them, which is the hardest invariant we hold.

### 2. Generate the hit-test geometry from the shaders

**This keeps CPU picking. It is not a step toward GPU picking** — see "What
should not change" below, where CPU picking is affirmed. It changes only where
the hit test's geometry comes *from*.

There are three descriptions of every mark's geometry, and only two are joined.
The shader draws it, the Canvas2D painter draws it, and the hit test decides
what is under the cursor — and the third is hand-written.
`hitTestGateParity.test.ts` exists because that drift is real, and
`reversedGlyphDirection.test.ts` records that a Canvas2D-vs-GPU pixel gate
structurally cannot catch the reversed-strand case.

The mechanism to fix it is the one item 1 leans on. A shape module already
computes "is this fragment inside the mark" as an SDF; a
`//! js-export:` on the containment predicate makes the hit test a *derived*
view rather than a parallel one — the same move already made for
`snapBoxTopPx` and `extendToMinWidthPx`.

It also closes the accuracy gap. Arcs, chevrons and capsule end-caps are
currently approximated by a hand-written test standing in for a shape the shader
knows exactly.

Sequencing: this shares the transliterator work with item 1's Tier A, so do the
census first and let the two share whatever surface has to be added.

### 3. Two edits to the "deliberately does not have" list — DONE 2026-09-04

Landed in [reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"What
this architecture deliberately does not have", as four new entries beside the
two edits. The edits themselves: **indirect drawing** now states the condition — it holds
exactly as long as every instance buffer is packed CPU-side, and names the pass
kind that would reopen it — and **storage buffers** carry the access-pattern
reason (one instance reading its own fixed struct sequentially is the
vertex-fetch case, and the 11-of-16 attribute headroom means the limit never
binds) beside the portability one, so the decline survives WebGL2 being dropped.

The three techniques the list did not address got entries: **depth buffer /
early-Z** (every pass blends, blending only composes in draw order, so a depth
test breaks the painter's-algorithm compositing the z-ordered pass lists exist
to define), **draw-call batching / merging** (measured — tens of draws a frame,
not what a frame is bound by; and GenomeSpy's `coalesceSampleFacetBatches` turns
out to be sample-facet specific rather than general adjacent-draw merging, a
case our per-row instance buffers do not have), and **persistent staging /
mapped buffers** (`queue.writeBuffer` already IS the browser's staging ring).
The principle is its own entry, "Compute where a CPU fallback must exist
anyway", and the indirect-drawing entry points at it.

`GPU-driven culling` stayed the template throughout. Every figure the new
entries quote is an inline-figure marker over `buffer-churn-pan`, so none of
them can go stale silently.

### 4. Measure the buffer-pool churn — DONE 2026-09-04, declined

`agent-docs/measurements/buffer-churn-pan.json`, taken by
`products/jbrowse-web/browser-tests/probe-buffer-churn.ts`, which wraps the
page's own `GPUDevice.createBuffer` / `GPUBuffer.destroy` and `gl.bufferData` /
`deleteBuffer` — so the uniform ring and the UBO are counted too — and counts
draws per animation frame at the same time, which is where item 3's draw-call
number came from.

A screen-and-a-half pan with two alignments tracks open creates
26<!--m:buffer-churn-pan.allocs.max--> buffers at worst across the whole
gesture, and the summed time inside the create calls is
0.004%<!--m:buffer-churn-pan.allocShare.max--> of it. A pan that stays inside
the loaded blocks allocates none, so the churn arrives at the fetch cadence
rather than the frame cadence: a pool would have nothing to recycle. Declined,
and the entry now carries the table.

## What was examined and declined

### Storage buffers in the render path

**Declined, and for a stronger reason than the one currently written down.**

Instance struct field counts across the shader tree: `read.slang` is the largest
at 11 attributes, and almost everything else is 4–5. WebGPU's default
`maxVertexAttributes` is 16 and WebGL2's floor is the same, so we are
comfortably inside the limit with room to spare.

What storage buffers buy over `stepMode: 'instance'` is random access (an
instance reading elements other than its own), variable-length indirection,
deduplication of shared columns, escape from the attribute-count limit, and
write access for compute. None of those describe our access pattern, which is
one instance reading its own fixed struct, sequentially — the canonical
vertex-fetch case, served by dedicated hardware. On modern GPUs storage loads
are roughly a wash and can go either way. There is no throughput win sitting
there.

**GenomeSpy needs them for a reason we do not have.** Its generic `rect` mark
declares ~28 channels (`RECT_CHANNEL_SPECS`: fill, stroke, four corner radii,
four shadow fields, four offsets, hatch, min-width/height/opacity, …), which
physically cannot be vertex attributes. Storage buffers there are a consequence
of generic marks, not a performance choice. We have specific marks with 4–11
fields, so the constraint never binds.

### Compute-driven packing

**Declined.** Three reasons, the second decisive:

- **Parsing is the bottleneck, not packing.** BAM/CRAM decode is branchy,
  variable-length bit-twiddling and a poor GPU fit; pileup row assignment is
  greedy and sequential-ish. Moving the pack step accelerates the cheap half.
- **It forks the logic, which is what the SSBO ban exists to prevent.** A
  compute packer is WebGPU-only, so Canvas2D and WebGL2 need a TS packer
  emitting identical bytes — the same logic maintained twice, in two languages,
  with no codegen joining them. `packInstances()` exists precisely so a worker
  that cannot import the shader still cannot drift; a compute packer
  reintroduces that drift one level up.
- **The genuine win is narrow** — re-deriving from data already resident on the
  GPU without a roundtrip (recolor, re-filter, re-threshold) — and
  `createInstanceCache` already covers the common case more cheaply by patching
  one lane.

The LD kernels pass the principle in item 3 cleanly: O(n²) pairwise over
genotypes, embarrassingly parallel, large output, and a CPU version too slow to
be a real fallback, so "WebGPU-only" is an honest answer. Instance packing fails
it, because Canvas2D is a mandatory floor and the CPU packer has to exist.

### LUT-indexed color

**Dropped, at the owner's call.** Packing a `uint categoryIndex` and sampling
`colorRampLut` instead of a per-instance packed ABGR would make a recolor a
small texture write rather than a lane patch. But recolors are not frequent
enough here for that to be a clear win, and `createInstanceCache` already
patches the color lane without a full repack. Not worth the change.

## What should not change

Recorded because these are the choices most likely to be re-litigated by someone
reading a comparison and concluding the other design is more advanced.

**CPU picking.** GPU picking answers the wrong question for us: it returns a
pixel id, but every consumer needs the feature record — the tooltip wants flags
and tags, the details panel the whole feature, the overlay the row. So it is an
extra pass plus a readback and then the same `findRead` lookup we were going to
do anyway. It would also be a *third* hit-test implementation, not a
replacement, since the Canvas2D floor needs one regardless. And `readPixels`
blocks on WebGL while WebGPU makes it async, which would put a frame or more of
latency into hover. Our geometry is mostly rectangles on rows, cheap and exact
to test analytically. GenomeSpy made the opposite call for the mirror reason:
its marks are arbitrary user-specified shapes with SDF strokes and rotation, and
its feature record is just a datum index, so there the pixel id *is* the answer.
Item 2 fixes the one real weakness — approximated non-rectangular geometry —
without touching the model.

**Ahead-of-time Slang codegen, not runtime shader generation.** The value is
that a worker in a package that cannot import the plugin owning the `.slang`
still packs bytes that provably match its struct. Runtime codegen gives that up,
and it is the property preventing the exact bug class the docs describe — a
hand-written packer writing a float bit pattern into a `uint` field, compiling
fine, rendering an enormous integer.

**A flat z-ordered pass list, not nested render scopes.** GenomeSpy's scopes
(`{bounds, opacity, items}`, nested) exist because its specs are trees of views —
`layer`, `hconcat`/`vconcat`, `facet`, `unit` — where a view can carry opacity
and its children must composite *within* it before compositing into the parent.
Five overlapping marks at 0.6 cannot each be drawn at alpha 0.6; the group needs
an isolated layer composited once. We have no analogue: a track is a display is
a canvas, displays do not nest, and there is no per-display group opacity. The
nearest thing we have, the shared-canvas views (dotplot, the synteny level), is
flat co-tenancy rather than nesting. A flat list is the correct model for our
composition, and adopting scopes would be building for a requirement we do not
have.

## Owed

- The census in item 1. Everything downstream of it is conditional on the count.
- Items 1 and 2 were not run, profiled, or opened in a browser; item 4 was
  (`buffer-churn-pan`). The field counts in "Storage buffers" came from reading
  the `.slang` structs, and the vertex-attribute limits are the WebGPU/WebGL2
  spec defaults rather than a device's — `reference/GPU_PORTABILITY.md` carries
  the same numbers, also by grep.
