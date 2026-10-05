---
status: Accepted
summary: "jb2export names a display setting by the slot the display declares (`showLegend=true`, `scales.y.type=log`, `mark=point`, `facet=tags.HP`), and keeps a colon modifier only where it translates: a preset, a multi-slot write, a parsed value or a post-open action. Eighteen modifiers that restated one slot under a house name are gone, as are the per-track-type `tag:` and `attribute:` field spellings. The display validates a slot write and lists its valid names on a typo, where a modifier typo warned and left a wrong figure"
---

# ADR-212: jb2export spells a display setting by its slot

## Status

Accepted (2026-10-05).

## Context

jb2export took a display setting two ways: a colon modifier (`scaletype:log`,
`group:tag:HP`, `fill:false`) and a slot write (`scales.y.type=log`,
`facet=tags.HP`, `mark=point`). Sixteen of the 32 modifiers wrote one slot under
another name, so each setting had two spellings the README listed twice and a
reader had to learn both. Four of the names were also narrower than the slot:
`fill` reached two of the four wiggle marks, `group` spelt a field `tag:` on a
read and `attribute:` on a feature, and `resolution:fine` named two multipliers.

## Decision

A display setting is its slot. The modifiers that restated one are removed:
`coverage`, `coverageHeight`, `readConnectionsHeight`, `readConnectionsLineWidth`,
`softClipping`, `legend`, `maxHeight`, `sashimiScore`, `sashimiHeight`, `arcColor`,
`unit`, `group`, `snpcov`, `minmax`, `scaletype`, `crosshatch`, `fill`,
`resolution`. `color:tag:X` and `color:attribute:X` are refused with a message
naming `color.field=`.

A colon modifier stays where it does work a slot write cannot: `featureHeight`
and `heightMode` pick a preset, `arcs` and `sashimi` write two slots, `flags`,
`filterTag` and the read categories edit `filterBy` after the display opens,
`sort` resolves against the view, `baseColor` and `display` select, and `color:`
routes a constant or a read field by track type. `height`, `force`, `name` and
`index` stay as the words every track type shares. `--alpha` is `--opacity`, the
slot the synteny view declares.

## Consequences

- A misspelled slot fails the render with the display's own list of valid names,
  where a misspelled modifier warned and left a wrong figure.
- `mark=` reaches `line` and `heatmap`, which `fill` never did.
- The category gate (`on` lists, `categoryByTrackType`) now covers only the
  remaining translators. A slot write needs no gate, since the display rejects
  a key it does not declare.
- A script using a removed modifier gets `unknown track option` and draws the
  default. Beta only, so no migration.

## Left open

`categoryByTrackType` still sends GWAS, GC-content, MAF and LD tracks to
`'feature'` and ignores `display:`, so a translator can gate on the wrong set.
