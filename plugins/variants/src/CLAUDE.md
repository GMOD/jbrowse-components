# Multi-sample variants

Rules and their rationale:
[reference/VARIANTS_DISPLAY.md](../../../agent-docs/reference/VARIANTS_DISPLAY.md)
— read the section before changing what it covers. Pipeline and measurements:
[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md).

**Hot loops** (`computeVariantCells.ts`, the upload/render callbacks) run 10⁸+
times: only there, use indexed `for` and `for (const key in obj)`, and keep
`??`/`||` off an allocating right-hand side.
