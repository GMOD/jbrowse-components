---
name: maf-color-object
description: "Colin's 2026-10-04 call: MafColor takes display-kit's colour kit with a preset per field (base, mismatch, chromosome and codon categorical; identity linear over 0..1 through a new named redgreyblue scheme), landing first with no pixel change and then the identity domain and scheme and the chromosome range as overrides. Base, mismatch and codon colours stay the theme's. The order of work and the one trap."
---

# MafColor onto the colour kit

Colin settled this on 2026-10-04. `MafColor`
(`plugins/maf/src/LinearMafDisplay/mafColorConfigSchema.ts`) is a bare field
enum; every colour resolves on the main thread (`encodeMafRows`, through
`createEncodeMemo` and `renderSvg.tsx`), so no worker or wire changes. Delete
this file when stage 2 lands.

## Facts that shape it

- Each field is one scale over a value the main thread computes per cell:
  `base` and `mismatch` categorical over A/C/G/T/N/gap (+ `match`) through a
  64K lookup built once per region (`resolveCellColor.ts`
  `packMafCellColorConfig`, `mafChannels.ts`); `chromosome` categorical over
  a source-chromosome rank (`components/drawSourceChrom.ts` `RANK_ABGR`);
  `codon` categorical over same/syn/nonsyn/stop (`encodeMafRows.ts`
  `codonFills`); `identity` linear 0..1 through a 101-entry table
  (`LinearMafRenderer/identity.ts` `IDENTITY_ABGR`). Availability (codon
  needs frames, identity yields at base level, the summary tier forces
  mismatch) stays the display's rule in `rowsColor`.
- **The trap**: the identity ramp red→grey→blue is no named scheme. A preset
  carrying it as `range` would make `withPreset` fill that range under any
  `scheme` a user writes, and range wins over scheme, so `scheme: 'viridis'`
  would be silently ignored. Hence a named `redgreyblue` scheme in core
  (`packages/core/src/util/colorSchemes.ts` plus its stop table in
  `colorRamp.ts`), pixel-identical to today's stops.
- `ROW_RENDERINGS` (`rowRenderings.ts`) is a menu over (color, y) pairs with
  its own wording, pinned both ways by `satisfies`; keep it. `y: 'identity'`
  is the same kind of channel as the mark encoding's `y` and stays a bare
  enum; it joins `PLOT_VOCABULARY` so Edit plot can reach the X-Y plot.
- `MafColor` shipped only in v5.0.0-beta.10 and beta.11, and every written
  `color: '<field>'` keeps reading: no lift needed.

## Stage 1: no pixel change

1. **Schema**: `field` stays a stringEnum with shorthand `field`; add
   `colorDomainSlot`, `colorRangeSlot`, `colorLabelsSlot`, `colorTitleSlot`,
   `colorRampSlots`, `colorDomainEndsSlots`; no `scale` slot (each field has
   one scale); `fieldPresets: MAF_FIELD_PRESETS` with
   `base` and `mismatch` categorical (domains A/C/G/T/N/gap, + match; no
   range, so empty means the theme's), `chromosome` categorical with
   `SOURCE_CHROM_PALETTE` as range and rank labels, `codon` categorical
   (nonsyn/syn/stop with labels), `identity` linear `domainMin 0`,
   `domainMax 1`, `scheme: 'redgreyblue'`, each with the key title the legend
   shows today.
2. **Model** (`stateModel.ts`): `colorEncoding` through `colorSettingOf` +
   `colorEncodingOf(…, MAF_FIELD_PRESETS)` with `scale: undefined`;
   `colorScalesIn` builds each legend section from the encoding (default keys
   byte-identical; the chromosome clamp at 5 stays; base and mismatch stay
   keyless until a range is written); `setRowRendering` writes through
   `colorForField` so a new field drops the old field's range; a `notices`
   getter (`colorNotices` plus the codon-without-frames line, which is silent
   today) and `ConfigProblemsIndicator` in `LinearMafDisplayComponent.tsx`.
3. **Shared**: the `redgreyblue` scheme; `y` in `PLOT_VOCABULARY`
   (`packages/core/src/configuration/plot.ts`).
4. **Tests**: schema shorthand and `plot` round trip; encoding per field;
   notices; `legendKeys.test.ts` unchanged and green.

## Stage 2: identity and chromosome overrides

- `identity.ts`: the 101-entry table becomes a memoized LUT over
  (scheme, reverse, domainMin, domainMax, domainMid) from
  `continuousColorScale`, byte-identical at the defaults (test it), so a
  `domainMin: 0.7` stretches the ramp over close clades as the mark-display
  example already does.
- `drawSourceChrom.ts`: `RANK_ABGR` becomes a parameter from the encoding's
  range.
- The merged inputs reach `encodeMafRows` through a computed getter with a
  stable identity (`colorPalette`, `rowsEncodePropsIn`) so `createEncodeMemo`
  props do not churn; `renderSvg.tsx` merges through the same function.
- Rerun `plugins/maf/benches` at the defaults: 1.00x against before.

Held for a later call: a base, mismatch or codon `range` (alignments'
`AlignmentsBaseColor` is MafColor's twin, so both or neither), a `value` slot
for the X-Y bar colour.
