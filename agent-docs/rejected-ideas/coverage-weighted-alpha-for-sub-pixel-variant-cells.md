---
name: coverage-weighted-alpha-for-sub-pixel-variant-cells
description: Coverage-weighted alpha for sub-pixel variant cells
area: rendering-and-displays
---

# Coverage-weighted alpha for sub-pixel variant cells

rejected; the 2px
opaque floor stays. Ramp is legible over ~1-4 variants/px and >99% saturated
by 12, while whole-genome cohort zoom is 3,000-31,000/px. Any alpha < 1 blends
alt toward ref (`#e41a1c` → `#d77c7d`, ~55% contrast lost). If revisited, the
lever is worker-side binning at fetch bpPerPx, not compositing.
