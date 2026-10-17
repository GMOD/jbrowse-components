---
status: Accepted
summary: "The alignments display's settings group by band: `coverage`, `pileup`, `sashimi` and `readConnections` are closed config objects holding `show`, `height`, `placement` where the band has one, and a `filter` of their own, beside the display-wide `filter`, `unit`, `facet`, `sort` and `color`. A predicate on a band's rows leaves `show*` for that band's `filter`, spelt as the read filter is (`min<Measure>` floors, `only | exclude | unset` categories), so `show` only ever toggles a band or a part of a mark. MAF takes the shared `coverage` object and a `conservation` one. Overturns GRAMMAR_OF_GRAPHICS.md's 'no filter object per alignments layer' (2026-10-16 morning) and the flat band convention for these two displays"
---

# ADR-231: An alignments band is one config object

## Status

Accepted (2026-10-16), Colin's call between one object per band and flat
band-prefixed slots, after two adversarial reviews of the vocabulary. v5.0.0
is the one release where config spellings may change wholesale, so the end
state was judged as the spelling users keep.

## Context

- **`show` meant two things.** On `showCoverage`, `showPileup` and
  `showSashimiArcs` it toggled a band. On `showNonCanonicalJunctions`,
  `showInterchrom`, `showLongRange` it was a predicate on which rows of a
  band's table draw, the grammar's filter (ADR-218 names `filter` the one
  word for a predicate). The sashimi menu already read "Hide non-canonical
  junctions" over a `show` slot.
- **Floors of one kind had three spellings**: `minSashimiScore` (a read
  count called a score), `minInterchromSupport`, `coverageSnpMinFrequency`
  (v4's LinearSNPCoverageDisplay word for an allele fraction).
- **Each band spelt its own noun several ways**: the sashimi band as
  `sashimiArcs`, `sashimi` and `Junctions`; the connections as
  `readConnections*`, `arcColor`, `showInterchrom`; `sashimiArcsMode` and the
  boolean `readConnectionsDown` for one role, placement.
- **Seven height words** (`height`, `coverageHeight`, `sashimiArcsHeight`,
  `readConnectionsHeight`, `featureHeight`, `maxHeight`, `growMaxHeight`),
  two of which a code comment had to tell apart.

## Decision

- **One closed object per band**, whose members mean the same in every band:
  `show`, `height`, `placement`, `filter`. The display-wide grammar words stay
  top-level, as Vega-Lite keeps a shared encoding beside its layers.

  | Band              | Members                                                                                                        |
  | ----------------- | -------------------------------------------------------------------------------------------------------------- |
  | `coverage`        | `show`, `height`, `showInterbaseIndicators`, `filter.minAlleleFraction`                                        |
  | `pileup`          | `show`, `readHeight`, `maxHeight`, `showMismatches`, `showSoftClipping`, `showOutline`, `showConnectors`, `fadeLowQuality`, `fadeLowFrequency` |
  | `sashimi`         | `show`, `height`, `placement` (`up`, `down`, `auto`), `showCounts`, `filter.minReads`, `filter.nonCanonical`   |
  | `readConnections` | `show`, `mark` (`arc`, `cloud`), `height`, `placement` (`up`, `down`), `lineWidth`, `color`, `showOrdinaryPairs`, `filter.interchrom`, `filter.offscreenMates`, `filter.minInterchromReads` |

- **A band's `filter` is spelt as the read filter**: a floor is
  `min<Measure>`, a category is `only | exclude | unset`, and members AND.
  `only` is new on the three categories and costs one comparison each
  (`passesCategory`).
- **`showOrdinaryPairs` stays a toggle beside `mark`.** Each mark has its own
  ordinary-pair test (concordant flags and baseline paint for arcs, modal
  |TLEN| for the cloud) and its own default, as `showOutline` follows the
  unit. A filter member must mean the same under both marks and be unset when
  not filtering; folding it in would have lost drawing the cloud's ordinary
  pairs.
- **Two placement enums, one word.** Only sashimi has `auto`; `up` draws over
  the coverage histogram, inside its band, so Vega-Lite's `orient: top|bottom`
  would mislead.
- **MAF's coverage band is the same `CoverageBand` object**
  (`@jbrowse/alignments-core/coverageBandConfigSchema`), and its conservation
  band is `conservation: { show, height, unit }`, `unit` being what one bar
  stands for (`base` or `codon`). LGVSyntenyDisplay inherits the bands and
  narrows `coverage.show` to off.
- **`PLOT_VOCABULARY` names the bands** and drops `arcColor`, so Edit plot and
  an agent's `plot` see whether arcs draw.
- **Menus write band members**: each category is the read filters'
  All / Only / Hide radio submenu (`categoryFilterItem`), and the SV-channel
  preset applies a config-shaped delta through `applyDisplaySettings`.

## Rejected

| Proposal | Why |
| -------- | --- |
| Flat band-prefixed slots (`sashimiFilter`, `sashimiHeight`, `showSashimi`) | The prefix was a band object spelt as four keys; the one-object form gives every member one meaning and puts the bands in the plot. A reviewer's claim that flat keys escape validation was wrong: both forms warn on load and refuse on write (ADR-221) |
| Data-named filters (`junctionFilter`, `pairFilter`) | The filter belongs to the band whose rows it tests, and `sashimi.filter` reuses the idiom a reader met at `filter` |
| `readConnections.filter.ordinaryPairs` | See the decision: the default depends on the mark |
| A shorthand on a band object | A settings bag replaces a shorthand object whole (`getConf.ts`), so a share link writing one member would reset the band's height |
| One opacity object for the two fades | Each fades by one variable; the object would hold two booleans under another name |

## Consequences

- v4.3.0 spellings still lift: `drawInter`/`drawLongRange` to the connection
  filter's `exclude`, `featureHeight`, `maxHeight` and the PileupRenderer block
  into `pileup`, the retired display types into the bands they drew
  (`retired.ts`, merging band members under what an entry spells). The flat
  v5 beta names lift nowhere.
- The model keeps a scalar getter per member (`showCoverage`,
  `sashimiPlacement`, `readConnectionsColorField`) so a reaction reads only the
  member it needs; the filters are one object getter each. `drawnReadConnections`
  answers `'off' | mark` for the render state.
- `ConfigSlotDefaults` lists a sub-schema's slots under dotted names, so the
  band defaults stay pinned.
- Figure specs, the spec-recipe table (which flattens band objects to dotted
  paths), jbrowse-img slot writes (`coverage.height=170`) and the tables
  engine's `settings` (the four resolved bands) follow. ggjbrowse reads
  `settings` and passes slot names through, and needs the same update.
- The multi-sample variant display's `showVariantLane`/`variantLaneHeight`
  still follow the flat convention; the external graph plugin writes them, so
  they move in their own change.
