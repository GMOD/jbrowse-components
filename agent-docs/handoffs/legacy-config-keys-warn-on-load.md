---
name: legacy-config-keys-warn-on-load
description: About 40 config keys that v1-v4 declared as slots print a console line when a config carrying one loads, because ADR-221 names every undeclared key and no `retired` entry covers them. Holds the per-schema key list a 2026-10-07 sweep found, the two ways out (retire each key, or stop warning on load) and the call that picks one, plus four smaller items the same review left open.
---

# Legacy config keys warn on load

[ADR-221](../architecture-decision-records/adr-221-a-closed-schema-warns-on-load-and-refuses-on-a-write.md)
makes a closed schema name an undeclared key on the console as a config loads.
A key an older release declared and a later one dropped is undeclared, so a v4
config prints `X "id" does not declare k: loading without it` for each such key
unless the schema's `retired` map lists it. The rule for this repo is no
warnings on normal data, and a config written for v4 is normal data.
**Delete this file when the call below is made and carried out.**

## The call

Colin has not chosen between these.

1. **Retire each key.** Every schema below gains its old keys in `retired`,
   dropped with `() => ({})` or lifted where a current slot takes the value.
   Old configs load in silence, a typo and a later minor's key still warn, and
   `jbrowse validate` reports each as never read (`droppedKeysOf` in
   `scripts/generateConfigManifest.ts`). Every later slot removal then needs a
   `retired` entry.
2. **Stop warning on load.** A load drops an undeclared key in silence, as MST
   did before ADR-217, a write still refuses, and `jbrowse validate` is the
   only reporter. No list to keep, and a typo in a hand-edited `config.json`
   gets no word from the app.

The recommendation is the first.

## Keys that warn today

Each row loaded through the real schemas and warned. Tags are the releases
whose slot lists, CLI output, docs or test data carried the key.

| Schema (retired type it came through) | Keys | Tags |
| --- | --- | --- |
| LinearAlignmentsDisplay | `maxFeatureScreenDensity`, `jexlFilters`, `maxDisplayedBpPerPx` | v1.0-v4.3 |
| LinearAlignmentsDisplay | `pileupDisplay`, `snpCoverageDisplay` (8 uses in `test_data/volvox`) | v1.2-v4.3 |
| LinearAlignmentsDisplay (LinearPileupDisplay) | `defaultRendering`, `renderers`, `colorScheme` | v1.0-v4.3 |
| LinearAlignmentsDisplay (LinearSNPCoverageDisplay) | `autoscale`, `minScore`, `maxScore`, `scaleType`, `inverted`, `multiTicks`, `renderers` | v1.0-v4.3 |
| LinearAlignmentsDisplay (LinearReadArcsDisplay) | `jitter`, `lineWidth`, `colorScheme` | v2.3-v4.3 |
| LinearAlignmentsDisplay (LinearReadCloudDisplay) | `hideSmallIndels`, `hideMismatches`, `hideLargeIndels`, `minSubfeatureWidth` | v4.0-v4.3 |
| LinearBasicDisplay | `maxDisplayedBpPerPx` | v1.0-v1.5 |
| LinearMarkDisplay (LinearArcDisplay) | `maxFeatureScreenDensity`, `mouseover` | v1.6-v4.3 |
| LinearMultiSampleVariantDisplay (MultiLinearVariantDisplay, LinearVariantMatrixDisplay) | `maxFeatureScreenDensity`, `colorBy`, `showReferenceAlleles`, `showSidebarLabels`, `autoscale`, `minScore`, `maxScore`, `numStdDev`, `scaleType`, `inverted`, `minimalTicks` | v2.18-v4.3 |
| LDTrackDisplay | `maxHeight`, `maxFeatureScreenDensity`, `fetchSizeLimit`, `mouseover`, `jexlFilters`, `colorScheme`, `signedLD`, `showLDTriangle`, `showRecombination`, `recombinationZoneHeight`, `fitToHeight`, `useGenomicPositions`, `minorAlleleFrequencyFilter`, `lengthCutoffFilter`, `hweFilterThreshold`, `callRateFilter` | v4.1-v4.3 |
| LinearWiggleDisplay | `maxFeatureScreenDensity`, `fetchSizeLimit`, `mouseover`, `jexlFilters` | v1.6-v4.3 |
| LinearHicDisplay | `baseColor`, `maxHeight` (both out of `renderer`), `maxFeatureScreenDensity`, `fetchSizeLimit`, `mouseover`, `jexlFilters` | v1.0-v4.3 |
| LinearReferenceSequenceDisplay | `featureHeight` (out of `renderer`) | v1.0-v4.3 |
| DotplotDisplay | `color`, `posColor`, `negColor`, `lineWidth`, `colorBy`, `thresholds`, `thresholdsPalette` (all out of `renderer`) | v1.0-v4.3 |
| LinearSyntenyDisplay | `color` (out of `renderer`), `trackIds`, `middle` | v1.0-v4.3 |
| LGVSyntenyDisplay | `maxFeatureScreenDensity`, `jexlFilters`, `colorScheme`, `renderers`, `defaultRendering` | v1.0-v4.3 |
| BamAdapter | `chunkSizeLimit` | v1.0-v1.5 |
| FromConfigAdapter and its two siblings | `featureClass` | v1.0-v1.5 |
| MCScanAnchorsAdapter | `subadapters` | v2.1 |
| CytobandAdapter | `cytobandsLocation`, which desktop's open-sequence dialog wrote for `cytobandLocation` | v2.4-v4.3 |
| NcbiSequenceReportAliasAdapter | `useUcscNameOverride`, now `useNameOverride` | v2.14-v2.18 |
| ReferenceSequenceTrack | `rendering`, from the assembly config guide | v1.0-v4.3 |
| every track | `textSearchAdapter`, `textSearchIndexingAttributes` | v1.3 |

Fixture-only keys the sweep also met, which no release wrote: a track-level
`autoscale` on QuantitativeTrack, `trackIds` and `renderDelay` on SyntenyTrack,
and `configuration` on a LinearBasicDisplay entry.

## Doing the first option

- **A retired name the schema also declares loses its value.**
  `applyRetiredSpellings` deletes every retired key it finds before lifting, so
  a shared list spread into a display that still declares `mouseover` drops the
  setting. Give each schema its own list, or teach the lift to skip a declared
  name first.
- **Lifts that are renames:** `cytobandsLocation`, `useUcscNameOverride`,
  `showSidebarLabels` to `showRowLabels`. `retiredAxisSpellings`
  (`@jbrowse/wiggle-core`) and `retiredFilterSpelling` (`@jbrowse/display-kit`)
  already lift the wiggle scale keys and `jexlFilters` on the displays that
  spread them; whether the alignments coverage band should take them is a
  separate question from silencing the line.
- **The keys reaching a display out of `renderer`** arrive because that
  display's preprocessor spreads the block. Retiring `renderer` whole on those
  displays is one entry each.
- **Check with the sweep's method:** build one track per row above through
  `pluginManager.pluggableConfigSchemaType('track')` with jbrowse-web's
  `corePlugins`, spy on `console.warn`, and expect no `does not declare` line.
  A test doing that over this table is the guard that keeps a later removal
  from warning.
- **Sweep older tags the same way before closing.** The table came from 39
  sampled tags (the last patch of each minor) read through `git show
  <tag>:website/docs/config/*.md`, the CLI's snapshots and `test_data`.

## Also open from the same review

- **`displayDefaults` and `displays[]` disagree.** An undeclared member inside
  a `displayDefaults` value fails the track's load
  (`expandTrackConfigShorthand.ts`), where the same object in a `displays`
  entry warns and draws. The router uses the refusal to pick which displays
  take a value, so dropping it outright would warn on valid configs; warning
  and dropping the key only when every candidate refuses for an undeclared
  member would make the two agree, and changes ADR-134.
- **A v4 `LinearHicDisplay` whose `renderer.color` is a `jexl:` callback throws
  at load** (`HicColor.field takes no jexl`), which costs the track. That is
  the callback check, not the undeclared-key check.
- **`products/jbrowse-cli/README.md` and `website/docs/cli.md`** still say a
  display refuses an undeclared key and fails to load. The CLI's
  `generate-readme` rewrites both at pack time from
  `commands/validate/index.ts`, which is current.
- **No test pins the write refusal for `SyntenyColor` or for the mark channel
  schemas** (`MarkColor`, `MarkShape`, `ValueScale`, `ValueScaleRule`, `Mark`,
  `MarkAggregateOp`); their tests assert the console line. The core suite pins
  the refusal at any depth.
