# Bubbles next steps

See `BUBBLES_COMPLETED.md` for completed work.

## Consider: identity from bubbles

Currently identity is computed from segment overlap ratio in the segment-based
renderer. With bubbles, we could compute more accurate identity by counting
match/mismatch bases from the bubble CS data. This would give true base-level
identity rather than segment-level approximation.

## Refactor Rust tool (optional)

The standalone `scripts/vcf-to-bubbles.ts` now covers the VCF→bubbles use case
without needing GFA. The Rust tool's `--bubbles` flag still requires a GFA
input. This could be cleaned up but is no longer blocking.
