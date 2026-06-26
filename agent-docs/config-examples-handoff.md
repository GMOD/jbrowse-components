# Config Example Improvements — Handoff

## Goal
Standardize all `#example` JSDoc blocks in config schema source files:
1. First example = minimal (no `displays` override)
2. Additional examples = instructive display customizations using `displayDefaults: { ... }` object shorthand (not array), unless the display is non-default (then array required)
3. Shorthand notes link to `/docs/config_guides/tracks#configuring-displays`
4. Track-specific guides cross-linked where they exist
5. Height examples included (they're high-value)
6. Multi-sample variant examples include pre-declared `layout` with sample colors/groups

## Committed (3 commits on `webgl-poc`)

| Source files | Change |
|---|---|
| `plugins/gccontent/src/GCContentTrack/configSchema.ts` | Split into minimal + shorthand second (gcMode skew, windowSize/windowDelta), cross-link |
| `plugins/gccontent/src/LinearGCContentDisplay/config2.ts` | Same split, shorthand |
| `plugins/hic/src/HicTrack/configSchema.ts` | Split minimal + shorthand (useLogScale, resolutionBias, height), hic_track guide link |
| `plugins/hic/src/LinearHicDisplay/configSchema.ts` | Same |
| `plugins/linear-comparative-view/src/SyntenyTrack/configSchema.ts` | Dropped empty displays block, synteny_track guide link |
| `plugins/linear-comparative-view/src/LinearSyntenyDisplay/configSchemaF.ts` | Same |
| `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts` | 3 examples: minimal BAM / CRAM methylation shorthand / long-reads shorthand (height+softclip+arcs), alignments_track guide link |

Generated docs updated for all of the above via `pnpm autogen`.

---

## Uncommitted (needs review + commit)

These 6 source files (+ their generated docs) are staged/modified but not committed:

### `plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts`
- Removed old array-form untagged prose block; replaced with shorthand equivalence note + link
- Split into: minimal / `displayDefaults: { height: 200, scaleType: 'log', color: 'darkgreen' }`
- Link to `/docs/config_guides/quantitative_track`

### `plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts`
- Same prose-block fix
- Split into: minimal / `displayDefaults: { height: 300, defaultRendering: 'multixyplot' }`
- Link to `/docs/config_guides/multiquantitative_track`

### `plugins/variants/src/LinearVariantDisplay/configSchema.ts`
- Split into: minimal / `displayDefaults: { height: 200 }`
- Link to `/docs/config_guides/variant_track`

### `plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts`
- Split into: minimal / shorthand with `height: 400, colorBy: 'ld', ldAdapter: { ... }`
- **OPEN ISSUE (see below)**
- Link to `/docs/config_guides/gwas_track`

### `plugins/variants/src/LinearMultiSampleVariantDisplay/configSchema.ts`
- Split into: minimal (array required — non-default type) / phased + height + `layout` with sample colors/groups
- `layout` is the `TreeSidebarMixin` field; seeds initial sample order, color, group from config

### `plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/configSchema.ts`
- Same pattern: minimal / height + MAF filter + `layout` with sample colors/groups

---

## Open issues (raised by user, not yet resolved)

### 1. `ldAdapter` in `LinearManhattanDisplay` example
User flagged: putting an adapter config inside `displayDefaults` is unusual. Options:
- Make `ldAdapter` a subadapter of `GWASAdapter` (so it lives at the adapter level, not display level)
- Or keep it in `displayDefaults` but note it explicitly

Current state in the file: `displayDefaults: { height: 400, colorBy: 'ld', ldAdapter: { type: 'PlinkLDTabixAdapter', ... } }`

### 2. `displayId` in array-form examples
User noted `displayId` is not required in the array form — MST defaults it to `{trackId}-{displayType}`. The multi-sample variant examples currently include explicit `displayId`. Remove them.

---

## Remaining files — already clean, no changes needed
Per audit: `AlignmentsTrack`, `VariantTrack`, `QuantitativeTrack`, `FeatureTrack`, `GWASTrack`, `LDTrack`, `BamAdapter`, `CramAdapter`, `VcfTabixAdapter`, `ReferenceSequenceTrack`, `LinearArcDisplay`, `LinearPairedArcDisplay`, `DotplotDisplay`, `LGVSyntenyDisplay`, `LinearMultiSampleVariantDisplay` (slot-level), all `packages/` adapter files.

---

## To finish this session's work
1. Resolve the two open issues above
2. Commit the 6 uncommitted source files + their 6 generated docs
3. Run `pnpm autogen` one more time after any edits
