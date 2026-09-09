---
status: Accepted
summary: "A display declares the colour scales it paints with — `colorScales`, a list of categorical entries or ramp stops on `LegendMixin` — and the legend derives from that list: `DisplayChrome` places it on screen and `renderDisplaySvg` in the export, so a display places no legend and writes no legend component. Eight displays migrated in the first pass, the mark display in the second; gwas, both wiggles, alignments and the synteny family are the remainder"
---

# ADR-108: A display declares its colour scales

## Status

Accepted (2026-09-09), first pass landed; the remainder is listed below and in
[handoffs/mark-grammar-v5.md](../handoffs/mark-grammar-v5.md). Extends
[ADR-094](adr-094-colour-cardinality-is-one-channel-not-four-shapes.md): the
four cardinalities of the colour channel resolve, for a legend, to two scales.
`LegendMixin`'s docstring and
[reference/DISPLAY_HOOKS.md](../reference/DISPLAY_HOOKS.md) are the operational
docs.

## Context

[mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md) states
the rule every plugin kept by hand: colour is resolved in exactly one place and
the legend reads the same answer. The shared half already existed —
`LegendSpec`, `FloatingLegend`, `SvgColorLegend`, `SvgGradientLegend`,
`LegendMixin`'s `showLegend` — and what every display still wrote twice was the
derivation of a `LegendSpec` from its colour rules and the placement of the
legend, once in its component and once in its `renderSvg.tsx`. Ten displays
carried a legend component of their own and eight an SVG twin; HiC and LD each
owned a gradient legend; Manhattan's toggle had its own slot name.

A grammar of graphics derives a legend from a scale. The tree resolves colour
once per display already, so the scale is what that resolution returns.

## Decision

- **`ColorScale`** (`packages/core/src/ui/colorScale.ts`) is `CategoricalScale
  { kind, id, title?, entries: { value, label, color?, swatches?, hidden? }[] }`
  or `RampScale { kind, id, title?, domain, stops: { offset, color, opacity? }[],
  format? }`, and `legendSpecOf(scales)` is the one derivation into the
  `LegendSpec` the shared components already draw. A ramp is a gradient row on
  screen and a `<linearGradient>` row in `SvgColorLegend`; `SvgGradientLegend`
  is deleted.
- **`LegendMixin` is the whole legend.** It keeps the `showLegend` slot handling
  and gains the `colorScales` hook (a getter, default `[]`), the derived
  `legendSpec`, `dismissedLegendSections` / `dismissLegendSection` (re-showing
  clears them; the variants override is gone), an optional `focusLegendEntry`
  action for a clickable row, and `svgLegendWidth()` for a display that reserves
  an export gutter (HiC, LD).
- **Placement is the chrome's.** `DisplayChromeBase` mounts `ChromeLegend` for
  any model `isLegendHost` recognises, and `renderDisplaySvg` appends `SvgLegend`
  inside `SvgChrome` — at the right edge over the plot, or beside it when the
  display reserved the gutter. A display's component and `renderSvg.tsx` place
  nothing.
- **Where colour is resolved in the worker from data, the payload carries the
  scale table** and the getter reads it off the loaded regions (multi-row's
  colour classes, the mark display's categories and ramps, Manhattan's field
  categories); a static vocabulary is a constant scale.

Migrated: `LinearBasicDisplay` and `LinearVariantDisplay` (the `legend` slot and
the impact / SV-type presets), `LinearMultiRowFeatureDisplay`, both multi-sample
variant displays, `LDDisplay` (metric LUT as a ramp), `LinearHicDisplay` (its
count ramp), `LinearMafDisplay` (the row rendering as one categorical scale),
`MultiWaySyntenyDisplay` (gene and ribbon scales), and `LinearMarkDisplay`. Each
lost its legend component, its SVG twin and its two placement sites.

## Consequences

- Placement moved where the migrated displays disagreed: gradient legends sit
  at the same edge as categorical keys (y 0, right 4), the multi-row key is a
  `FloatingLegend` box rather than an SVG overlay, HiC's log scale is in the
  title, and the variants' export key reads the session palette as MAF's did.
  The `dog10k` figure spec and FIGURE_CAPTURE.md gate on `floating-legend`.
- The chrome carries `FloatingLegend` for every display, +26 KB plain / +10 KB
  gzip on the web bundle baseline.
- **Remainder, pass two:** gwas (Manhattan's `legend` getter and its two
  components), both wiggle displays (`ScoreLegend`, the multi-wiggle
  `legendItems`), alignments (`legendUtils`, `PileupComponent`, `renderSvg`) and
  `LGVSyntenyDisplay` with it, synteny-core's `TrackColorsMixin` /
  `ColorByLegend` / `SVGColorByLegend` with dotplot's and the linear synteny
  view's view-level legends. sv-inspector's `ChordLegend` is a filter with
  tallies, not a colour key, and stays view-owned.

## Rejected alternatives

- **A `scale` slot on `defineMark`.** ADR-097 measured the refusal, and a
  legend is a property of the display's colour resolution, not of one mark.
- **Keeping placement in each display with a shared component.** That was the
  state before; the two call sites per display were the restatement.
