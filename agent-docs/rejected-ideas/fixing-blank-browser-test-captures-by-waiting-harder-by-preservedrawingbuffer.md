---
name: fixing-blank-browser-test-captures-by-waiting-harder-by-preservedrawingbuffer
description: Fixing blank browser-test captures by waiting harder, by `preserveDrawingBuffer`, or by using `toDataURL` bytes as the capture
area: performance-and-measurement
---

# Fixing blank browser-test captures by waiting harder, by `preserveDrawingBuffer`, or by using `toDataURL` bytes as the capture

all
three measured, all three declined; the last produced a false 93% drift because
a differential oracle cannot compare one backend's backing store against
another's composited layers. Also: **stop running whole-suite A/Bs against
this**, since failure counts range 0–20 under nominally identical conditions.
[CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md).
