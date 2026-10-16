# Multi-sample variants

Rules and their rationale:
[reference/VARIANTS_DISPLAY.md](../../../agent-docs/reference/VARIANTS_DISPLAY.md)
— read the section before changing what it covers. Pipeline and measurements:
[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md).

**Hot loops** (`computeVariantCells.ts`, the upload/render callbacks) run 10⁸+
times, and only they take indexed `for`, `for (const key in obj)` and no
`??`/`||` wrapping an allocating right-hand side.
