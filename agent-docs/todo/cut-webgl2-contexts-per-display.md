---
name: cut-webgl2-contexts-per-display
description: build — ceiling measured at 16, one ordinary view crosses it
metadata:
  area: GPU, limits
  category: measure-first
---

# Cut WebGL2 contexts per display

The ceiling is **16 live contexts** and one LGV with 17 GPU tracks crosses it —
measured 2026-08-05, same on a real Intel GPU and on SwiftShader, so it is a
browser property. See [reference/ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
§"One WebGL2 context per display canvas" for the walk and
[reference/GPU_CONTEXT_BUDGET.md](../reference/GPU_CONTEXT_BUDGET.md) for the
harness and the fixes already eliminated.
That was the number this entry used to ask for, and it answers the question it
was gating: an unremarkable session reaches the ceiling, so **track-level
mount/release is worth building**, and so is anything that shares a context
across displays.

**The software-rasterizer half is done as of 2026-08-12, and it shrinks what is
left here.** Detection landed first (`glRenderer` / `softwareWebgl` off the probe
context), then the routing: `createGpuHal` steps over the WebGL2 rung when the
rasterizer is software and nothing was pinned. Measured on one view with three
tracks and no churn — WebGL2 blocks the main thread 1.3-5.5 s in a single task,
Canvas2D never exceeds 0.34 s and never once exceeds 500 ms. Both the numbers and
the two things that must not break (the cross-backend gate, the figure corpus)
are in
[reference/GPU_CONTEXT_BUDGET.md](../reference/GPU_CONTEXT_BUDGET.md).

**So re-measure the population before building the structural work.** The
remaining group is *hardware* GL with no WebGPU and 17+ tracks: a machine with
WebGPU builds no WebGL2 display context at all, and software ones now take
Canvas2D. Canvas2D is ~2x worse for that group, so it cannot simply be routed
too — and the analytics `software-rendering` bit says how much of the no-WebGPU
population has already been taken out of it. Ask that before spending on context
pooling or track-level mount/release.
