---
name: parsing-a-pif-row-straight-into-its-pifline-shape-skipping
description: Parsing a PIF row straight into its `PifLine` shape, skipping the `PAFRecord` it is renamed from
area: performance-and-measurement
---

# Parsing a PIF row straight into its `PifLine` shape, skipping the `PAFRecord` it is renamed from

measured 2026-08-20 and declined, which is
the third time ADR-039's reading of this has held. `parsePifLine` builds a
second shallow object per row that only *references* the same `extra` map, so
one object per row instead of two looked free. It measured **1.38x** on a
16,066-row fine PIF tier and **0.88x** — the wrong way — on an 84k-row coarse
tier, in the same harness, minutes apart. Both readings are noise: at that row
count the control was 0.94-1.38x, so the harness resolved nothing (see the row
ceiling in `benches/pafLineParse.bench.ts`). Nothing survives it, and the
rename is what makes the anchor/mate roles readable at the two call sites that
consume them.

**The same session's two accepted changes were both work, not allocation** —
the tab-offset parse stops scanning and re-wrapping a 1.8kB CIGAR to read
twelve short fields, and the spread removal stops rebuilding the feature's data
object dynamically. This entry is the allocation, and it measured nothing,
again.
