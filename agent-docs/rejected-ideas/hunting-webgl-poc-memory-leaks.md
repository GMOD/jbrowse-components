---
name: hunting-webgl-poc-memory-leaks
description: Hunting webgl-poc memory leaks
area: performance-and-measurement
---

# Hunting webgl-poc memory leaks

there are none. Deep-CRAM zoom churn,
20-navigation churn, remote nav and track open/close all return to a flat
post-GC floor. The hundreds-of-MB is a transient RPC-worker peak (longread
CRAM ~997MB → 7MB), root cause `@gmod/bgzf-filehandle`'s grow-only
module-global wasm memory. Only a rising post-GC floor is a leak.
