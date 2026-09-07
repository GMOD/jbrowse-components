---
name: compute-driven-instance-packing-a-webgpu-compute-pass-writing-the
description: Compute-driven instance packing (a WebGPU compute pass writing the instance buffers)
area: rendering-and-displays
---

# Compute-driven instance packing (a WebGPU compute pass writing the instance buffers)

declined 2026-09-04, same review. Three reasons, the second
decisive. Parsing is the bottleneck, not packing: BAM/CRAM decode is branchy
variable-length bit-twiddling and a poor GPU fit, and pileup row assignment is
greedy and sequential-ish, so moving the pack step accelerates the cheap half.
It forks the logic, which is what the SSBO decline exists to prevent — a
compute packer is WebGPU-only, so Canvas2D and WebGL2 need a TS packer emitting
identical bytes, the same logic in two languages with no codegen joining them,
where `packInstances()` exists precisely so a worker that cannot import the
shader cannot drift. And the genuine win is narrow — re-deriving from data
already resident on the GPU without a roundtrip (recolour, re-filter,
re-threshold) — which `createInstanceCache` covers more cheaply. The LD kernels
pass the "compute where a CPU fallback must exist anyway" principle
(GPU_RENDERING.md) cleanly and instance packing fails it, because Canvas2D is a
mandatory floor and the CPU packer has to exist either way.
