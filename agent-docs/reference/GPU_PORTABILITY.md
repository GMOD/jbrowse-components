---
name: gpu-portability
description: What this codebase requires of a GPU against what the WebGPU and WebGL2 specs guarantee everywhere — which limits the code queries at runtime, which it hardcodes, and how much headroom each in-tree shader has over the floor. Read before trusting a GPU number measured on one machine, or when triaging a report from hardware nobody here owns.
audience: internal
---

# GPU portability: what is guaranteed, and what is one laptop

Every GPU number this repo records comes from one of two configurations: Firefox
Nightly on an Intel UHD 630, and Chrome 151 on the same box. The MSAA sizes, the
~2 GiB `maxBufferSize`, the pipeline-resolve timings, the 16-context ceiling —
all one machine, an integrated GPU several generations old.
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) and
[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) say so in each entry's provenance
line, and that is the right thing for a measurement to say. It leaves a
different question unanswered: **what is true on hardware we have never seen?**

This doc is that half, and none of it needs hardware. A conformant WebGPU or
WebGL2 implementation must meet published minimums; the tree either queries a
limit at runtime or bakes in a number. Comparing the two is a desk exercise, and
it is the only GPU claim here that generalizes.

**Provenance.** The floor columns below are the required-minimum ("default")
limits in the WebGPU spec's limits table and the OpenGL ES 3.0 spec's
implementation-dependent-values tables, which WebGL2 inherits. They are quoted
from the specs, not measured — check them against the current spec text before
resting a decision on one, because WebGPU's set has been renamed at least once
(`maxInterStageShaderComponents` became `maxInterStageShaderVariables`).
Everything said about *this tree* is grepped from it and re-derivable.

---

## The short answer

- **WebGPU is safe by construction.** Every device limit the HAL depends on is
  read from `device.limits` at runtime, and the two the guards trip on are
  reported to the user rather than assumed away. Nothing in tree requests a
  limit above the spec floor.
- **WebGL2 rests on convention in exactly one place** — `MAX_CANVAS_DIM_PX`, an
  8192 that the spec floor does not back. Unreachable today, and the entry in
  ARCHITECTURAL_LIMITS.md that owns it says why.
- **The scariest-sounding number is not a hardware limit at all.** The 16-context
  ceiling is browser policy — it varies by browser and version, not by GPU, so
  no amount of graphics hardware changes it. It is also measured on Chrome only;
  the Firefox figure in circulation is an unmeasured guess.

---

## What the code queries, and is therefore safe anywhere

A queried limit cannot be wrong on unseen hardware — the worst case is a smaller
budget and an earlier, legible refusal.

<!-- prettier-ignore -->
| limit | spec floor | where the tree reads it | what happens at the floor |
| --- | --- | --- | --- |
| `maxTextureDimension2D` | 8192 | `webgpuHal.recreateMsaaTexture`, and the data-texture path | `OomReporter` → "zoom in", not a blank canvas |
| `maxBufferSize` | 256 MiB | `webgpuHal` vertex upload guard | same refusal, at a lower threshold |
| `minUniformBufferOffsetAlignment` | 256 | `WebGPUHal`'s constructor, sizing the ring slot | nothing; an alignment limit can only be *better* than the default, never worse |
| `MAX_TEXTURE_SIZE` (WebGL2) | **2048** | `webgl2Hal`, before `texImage2D` | refuses the texture with the measured max in the message |

`gpuDevice.acquire` asks for `requiredLimits: { maxStorageBufferBindingSize,
maxBufferSize }` set to **the adapter's own maxima**, which is always
satisfiable — it raises the device above the 256 MiB default where the hardware
allows rather than requiring anything. A machine at the floor gets a device with
the floor, not a failed `requestDevice`.

---

## What the code assumes

<!-- prettier-ignore -->
| assumption | spec floor | verdict |
| --- | --- | --- |
| `MAX_CANVAS_DIM_PX = 8192` (`canvas2dUtils.ts`) | WebGPU 8192, **WebGL2 2048** | Exactly the WebGPU floor, so safe there by construction. On WebGL2 it rests on "≥ 8192 on essentially all real hardware", which the source comment states honestly and the spec does not guarantee. |
| `MAX_VERTEX_BUFFER_BYTES = 256 MiB` (`webgl2Hal.ts`) | not queryable in WebGL2 | Deliberate: WebGL2 exposes no equivalent, so the tree pins WebGPU's spec default. See the "No session-level GPU memory budget" entry — the unguarded alternative is a dropped context. |
| `SampleCount` is `1 \| 4`, and displays take 4 | 4 is required for multisampled textures | Safe, and the type is the spec rather than a choice: WebGPU permits no other count, so a per-display knob has exactly two positions. |
| 4x MSAA on the preferred canvas format | `maxColorAttachmentBytesPerSample` 32 | Safe with room: one 4-byte attachment. |

**The `MAX_VERTEX_BUFFER_BYTES` row has a consequence worth stating plainly.**
ARCHITECTURAL_LIMITS.md says "WebGL2 is therefore the stricter of the two",
which is true on the measured box because its adapter reports 2147483644 bytes
(~2 GiB). On a machine at the WebGPU floor both backends refuse at 256 MiB and
the asymmetry disappears. The direction of the claim is machine-dependent; the
safety of the guard is not.

---

## How close the shaders sit to the floor

Grep, not measurement: `awk '/VERTEX_ATTRIBUTES/,/^]/'` over
`**/*.iface.generated.ts`.

<!-- prettier-ignore -->
| quantity | widest in tree | floor | headroom |
| --- | --- | --- | --- |
| vertex attributes in one pass | **11** (`read.iface.generated.ts`, alignments' pileup) | 16 | 5 attributes |
| vertex buffer stride | 44 bytes (same pass) | 2048 | ~46x |
| uniform block size | 864 bytes (alignments), 1024 aligned | WebGPU 64 KiB binding, WebGL2 16 KiB block | ~16x on the tighter of the two |
| color attachments | 1 | 8 | 7 |

Alignments is the widest pass on every axis, so those are the numbers to re-take
when a pass grows a dimension. The one to watch is vertex attributes: 11 of 16,
and the pileup pass has taken a new attribute more than once
(`a_colorCategory`, `a_edgeFlags`).

---

## The one number that generalizes badly, and by how much

The MSAA target in ARCHITECTURAL_LIMITS.md is measured at **79.2 MiB** for a
1266x4100 canvas. That entry also gives the formula — canvas area x dpr² x 4
samples x 4 bytes — and the formula reproduces its own anchor exactly
(`1266*4100*4*4 = 79.20 MiB`), which is what makes it safe to extend.

Extending it is alarming, and the reason is the display rather than the GPU.
**dpr enters squared**, so the same track on a retina panel costs 4x before the
window is any wider. Arithmetic rather than measurement, and every row is
**a single track**:

<!-- prettier-ignore -->
| case | device px | MSAA target |
| --- | --- | --- |
| measured anchor (dpr 1, 1266 px window, 4100 px tall) | 1266 x 4100 | 79.2 MiB |
| a 27" retina window (2560 CSS px wide, dpr 2) with the height at the clamp | 5120 x 8192 | **640.0 MiB** |
| both axes at the clamp, the absolute ceiling | 8192 x 8192 | 1024.0 MiB |

The measured 79.2 MiB is near a best case — dpr 1, a small window. The middle
row is the one to hold in mind, because it is an ordinary desk setup, it is 8x
the recorded figure, and the session counts none of it (which is that entry's
whole point). A handful of tall tracks there is where hardware nobody here owns
would fail first.

**Measured 2026-08-22 on a retina panel, and the dpr² term is real.** The same
window, the same track and the same driver, with `layout.css.devPixelsPerPx`
the only thing moved:

<!-- BEGIN GENERATED MEASUREMENT msaa-target-dpr -->

| scenario                              | dpr 1 (MiB) | dpr 2 (MiB) | retina cost |
| ------------------------------------- | ----------- | ----------- | ----------- |
| one alignments track, 1266x840 css    | 16.20       | 64.90       | 4.01x       |
| eight GPU tracks, default heights     | 27.40       | 109.70      | 4.00x       |
| one track dragged to the canvas clamp | 154.50      | 316.50      | 2.05x       |

<!-- END GENERATED MEASUREMENT msaa-target-dpr -->

So the projection above stands: a CSS box costs 4x its dpr-1 allocation, and
eight ordinary tracks — nobody's idea of a heavy session — ask for 109.7 MiB of
multisample target that nothing in the session counts.

**Asks for, not necessarily holds.** These are the sizes the texture descriptors
request, taken on immediate-mode parts (Intel UHD 630 / AMD RDNA-1) where a
render attachment is an allocation. `beginFrame` attaches the MSAA view with
`storeOp: 'discard'` and a `resolveTarget`, and that is precisely the shape a
**tiler** may keep in tile memory and never commit — so on Apple Silicon the same
descriptors may cost nothing. Nobody has profiled it, and it decides whether the
size is a problem for a large share of our users or only for some of them:
[../ideas/arc-antialiasing-without-msaa.md](../ideas/arc-antialiasing-without-msaa.md)
ranks that residency check first, ahead of every mitigation.

One thing bounds it: `getDpr()` caps at `MAX_DPR = 2`, so dpr² cannot exceed 4
however the hardware reports itself.

**What does NOT bound it is the refusal this doc used to promise** (and what
happened instead is now fixed — see the end of this section). The claim
here was that `recreateMsaaTexture`'s `maxTextureDimension2D` check refuses past
~4096 CSS px tall at dpr 2, so "the failure at the top of this range is a legible
refusal, not an OOM". It is neither. `syncCanvasSize` clamps the backing store at
`MAX_CANVAS_DIM_PX` = 8192 **first**, and this device's `maxTextureDimension2D`
is exactly 8192 — so the store never exceeds the limit, the refusal never fires,
and what the user gets instead is the clamp regime: the whole track paints blank,
with no banner, no console error and no `display.error`. Measured by walking a
track's height up at dpr 2 (`--ceiling`): 4000 CSS px paints, 4200 is blank, and
it came back when the track was shrunk. At dpr 1 the same walk painted all the
way to 8000, which is what made it a retina bug specifically — the reachable
ceiling is halved to ~4096 CSS px.

**Fixed the same day.** `syncCanvasSize` now reports the scale each axis actually
got, `hal.resize` returns it, and every device-px rect derives from that instead
of from `getDpr()` — so past the clamp a display draws at reduced resolution
rather than asking for a viewport its attachment cannot hold. Re-verified on the
same panel: the walk paints to 8000 CSS px with no validation error at any
height. [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"A canvas past
`MAX_CANVAS_DIM_PX` renders wrong, not smaller" has the mechanism; what remains
is only whether a drag should be *bounded* as well, which is
[../TODO.md](../TODO.md) §"Decide whether a track's height should be bounded at
all".

---

## The limits that are browser policy, not hardware

**The 16-context ceiling is not a GPU limit.** It is what the browser is willing
to keep alive per page, so the number most likely to differ on untested hardware
differs because of the *browser*, not the GPU. A faster card does not raise it.

**And only one browser has actually been measured.** GPU_CONTEXT_BUDGET.md
measured 16 on Chrome 151, on both a real GPU and SwiftShader — that part is
solid. The companion "Firefox around 16" is RFC-001 §12b, and §12b's own
superseded-in-part note says its context-cap figures **were guesses**; the
measurement killed its "Chrome around 8" and left the Firefox guess standing
because nothing contradicted it. So Firefox's real ceiling is unknown, and the
number in circulation for it has never been taken.

That is the single cheapest GPU measurement outstanding: the harness exists in
GPU_CONTEXT_BUDGET.md and walks `--tracks` up on one LGV. Running it once on
Firefox converts the most-cited cross-browser GPU figure in this repo from a
guess into a measurement.

Two others in the same class: whether WebGPU is available at all (a browser and
driver-allowlist decision, not a capability), and whether
`WEBGL_debug_renderer_info` is exposed (Firefox with
`privacy.resistFingerprinting` withholds it, which is why
`graphicsCapabilities.glRenderer` is optional).

---

## How to find out what real machines give you

**The data is already being printed on every user's machine, and nothing
collects it.** `logGpuCapabilities` (`gpuDevice.ts`) `console.warn`s the vendor,
architecture, description, `maxTextureDimension2D`, `maxBufferSize` and
`maxStorageBufferBindingSize` on every successful WebGPU device acquisition. Its
own comment names the reason — "the whole point of the GPU path is scaling
across hardware we can't see". It reaches a console nobody reads.

`graphicsCapabilities.ts` is the piece that already travels: it feeds the About
widget's "Graphics:" line, the stack-trace dialog, and one coarse
`softwareWebgl` bit to analytics. It reports **which GPU**, never **what it
allows** — so a bug report from unseen hardware names the adapter and omits
every number that would explain the failure.

The cheap lever is therefore not a hardware lab. It is adding the three limits
already being logged to the capability object the stack-trace dialog copies, so
a report from a machine we cannot see arrives with its budget attached. That is
a UI-visible change and a product decision, which is why this doc proposes it
rather than the tree already doing it; it is parked in
[../ideas/gpu-limits-in-bug-reports.md](../ideas/gpu-limits-in-bug-reports.md).

Until then, the honest statement for any GPU number in this repo is the one its
provenance line already makes — one machine, named — and the floors above are
what holds without it.
