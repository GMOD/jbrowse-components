---
name: chunking-the-ld-gpu-kernel
description: Chunking the LD GPU kernel
area: performance-and-measurement
---

# Chunking the LD GPU kernel

proposed, argued at length, reverted as
unjustified, and three of its supports failed on contact with measurement.
"TDR at n=8000" could not be reproduced; "integrated graphics would blow
through the watchdog" is false (Intel UHD 630 runs n=3000 in 1534ms against
discrete AMD GCN-4's 1469ms — a ~4% gap, not a multiplier); and the display
needs >=2897 variants *and* WebGPU to have ever been affected. The one device
loss ever seen was under sustained benchmark load and was never characterised.
**The 1.8s kernel duration is real and sits in `160158ae26`'s message under
"Known gap: nothing bounds kernel duration"** — treat that as a standing
invitation to rebuild the argument from a plausible mechanism, and decline it.
Don't chunk without a *reproduced* TDR on a named device. Repro
`jb2bench/scripts/ldlimits.ts`, perf `jb2bench/scripts/ldbench.ts`.
