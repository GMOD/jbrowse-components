---
name: hic
description: A user-draggable color threshold, checking normalization-vector availability before calling hic-straw, an A/B compartment log-ratio mode, and surfacing the inter-chromosomal data `getHeader` already detects but never shows.
---

# Hi-C

**User-adjustable color threshold.** A draggable slider on the HiC color legend (like
Juicebox) so users set the saturation threshold manually; store as a
`colorThresholdMultiplier` override. The 95th-percentile auto-scale is a good default
but some datasets benefit from manual tuning.

**Normalization availability check.** Before calling hic-straw with a normalization (e.g.
KR), check whether a normalization vector exists for the current resolution/chromosome;
if not, warn and fall back to NONE (mirrors Juicebox `contactMatrixView.js:checkColorScale`).
hic-straw doesn't expose `hasNormalizationVector` directly — detect by catching empty
results or inspecting masterIndex keys.

**A/B compartment ratio mode.** A÷B log-ratio display (diverging red/blue) when a
control/background map is loaded — needs a second `hicLocation` and `RatioColorScale`
logic.

**Inter-chromosomal UI.** `getHeader` already computes `hasInterChromosomalData` but
never surfaces it; when true, show a chromosome-pair selector (chr1 × chr2) to navigate
inter-chromosomal contact blocks without a manual multi-region view.
