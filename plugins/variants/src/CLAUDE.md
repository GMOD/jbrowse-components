# Multi-sample variants

Pipeline, measurements and what each optimization bought:
[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md).
Fetch/render tiering: `agent-docs/ARCHITECTURE.md`.

**Hot loops** (`computeVariantCells.ts`, `computeVariantMatrixCells.ts`, the
upload/render callbacks) run 10⁸+ times: indexed `for`,
`for (const key in obj)`, no `??`/`||` wrapping an allocating right-side. Not
elsewhere.

## Rules

Each is a section of
[reference/VARIANTS_DISPLAY.md](../../../agent-docs/reference/VARIANTS_DISPLAY.md),
which has the why — read that section before changing what it covers.

- Genotypes
- Cells
- One composition rule: `fill = shade(hue(variant, cell), dosage)`
- The legend lists what was painted
- Mixed ploidy: five consumers, one contract
- The unphased matrix is one column per ALT, not one per site
- Settings
- The arrangement is `rows` and `rowColor`, by row name
- One display, two layouts: `variantLayout`
- Bands above the rows
- How wide a cell draws: `variantCellSpanPx`
- Connectors and allele counting
