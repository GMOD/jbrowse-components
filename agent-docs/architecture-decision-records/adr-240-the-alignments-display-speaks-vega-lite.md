---
status: Accepted
summary: "ADR-238's end state for LinearAlignmentsDisplay and LGVSyntenyDisplay, slot by slot: one `filter` predicate list that merges with its defaults by field (`flags.*`, `mapq`, `tags.XX`, the read categories, and the derived rows `junction.reads`, `connection.*` and `breakpoint.reads`); `encoding.color` with `scale.{type, domain, range, names, group, ...}` and a per-channel `legend` under a display-wide `legend.show`; `coverage.encoding.y`; a `show` on every band and layer (`pileup.mismatches`, `softClips`, `connectors`, `bases`, `coverage.interbase`, `alleles`, `sashimi.labels`, `readConnections.ordinaryPairs`); `pileup.mark.height`; `readConnections.mark` as `{ type: 'link' }` (a dome) or `{ type: 'rule' }` with `encoding.strokeWidth`. Amends ADR-238: a written filter list merges by field, a link's width is `strokeWidth`, `autosize` is not borrowed, `scale: 'none'` goes with no value-beats-field rule, `scale.name` becomes `scale.group`, per-value names are `scale.names`. Keeps `collapseSections`, `heightMode`, `fadeLowFrequency` and `maxLayoutHeight`; cuts `pileup.showOutline`"
---

# ADR-240: The alignments display speaks Vega-Lite

## Status

Accepted (2026-10-22), with three calls open (below). The alignments stage of
[ADR-238](adr-238-every-display-speaks-vega-lite.md), whose order of work this
follows. Amended the same day: a ramp's quantile is `scale.domainQuantile`,
not `{ quantile }`, which no slot type holds and which reads as d3's
`type: 'quantile'`.

Five reviews shaped it: an Opus design pass from ADR-238 and the schemas, two
Opus arbiters on its calls (one on Vega-Lite fidelity, one on authors, writers
and speed), a Fable cold read of the resulting surface with no rationale in
hand, and Colin's rulings on the calls they split.

## Decision

### Surface

```jsonc
{
  "height": 250,
  "heightMode": "fixed",                // fixed | grow | fit; house words (see Rejected)
  "growMaxHeight": 1200,
  "unit": "read",                       // read | chain

  // AND of every entry. A written list merges with the defaults by field.
  "filter": [
    { "field": "flags.UNMAP", "equal": false },      // defaults: 1540 as three
    { "field": "flags.QCFAIL", "equal": false },     //   bits, fused to one mask
    { "field": "flags.DUP", "equal": false },
    { "field": "junction.reads", "gte": 2 },
    { "field": "breakpoint.reads", "gte": 2 },
    { "field": "mapq", "gte": 20 },                  // examples
    { "field": "tags.HP", "equal": "1" },
    { "field": "spliced", "equal": false }
  ],

  "facet": { "field": "tags.HP", "sort": ["2", "1"], "hidden": [] },
  "collapseSections": false,
  "sort": "position",                   // or { field, pos, refName, within }

  "encoding": {
    "color": {
      "value": "steelblue",             // the constant, and nothing else
      "field": "tags.HP",
      "scale": {
        "type": "categorical",
        "domain": ["1", "2"], "range": ["#d95f02", "#1b9e77"],
        "names": ["Maternal", "Paternal"],
        "scheme": "viridis", "reverse": false,
        "domainMin": 0, "domainMax": 60, "domainMid": 30
      },
      "legend": { "show": true, "title": "Haplotype", "descending": false }
    }
  },
  "legend": { "show": false },          // the whole key

  "coverage": {
    "show": true, "height": 45,
    "encoding": { "y": {
      "scale": { "type": "linear", "zero": true, "domainMin": null, "domainMax": null,
                 "constant": 1, "group": "tumor-normal" },
      "axis": { "grid": false, "title": "Depth", "tickCount": 4 } } },
    "interbase": { "show": true },
    "alleles": { "show": true, "filter": [{ "field": "fraction", "gte": 0.2 }] }
  },

  "pileup": {
    "show": true,
    "mark": { "height": 7 },
    "maxLayoutHeight": 6000,
    "fadeLowFrequency": true,
    "mismatches": { "show": true, "encoding": { "opacity": {
      "field": "baseQuality", "scale": { "domain": [0, 50], "range": [0, 1], "clamp": true } } } },
    "softClips": { "show": false },
    "connectors": { "show": false },
    "bases": {
      "show": false,
      "encoding": { "color": { "field": "modifications" } },
      "filter": [ { "field": "probability", "gte": 0.1 },
                  { "field": "context", "oneOf": ["CG"] },
                  { "field": "code", "oneOf": ["m", "h"] } ],
      "unmodified": { "show": false }
    }
  },

  "sashimi": { "show": true, "height": 40, "placement": "up", "labels": { "show": false } },

  "readConnections": {
    "show": false, "height": 35, "placement": "down",
    "mark": { "type": "link" },     // a dome; or { "type": "rule" }: the read cloud
    "encoding": {
      "color": { "field": "insertSizeAndOrientation" },
      "strokeWidth": { "field": "reads", "scale": { "type": "log", "range": [1, 4] } }
    },
    "ordinaryPairs": { "show": null }   // unset follows the mark
  }
}
```

- **Every band and layer has the same three members:** `show` turns it on, its
  look is its `encoding`, and which of its items draw is its `filter`.
  `pileup.bases` no longer turns off by an empty field.
- **The derived rows keep one display-level filter** (ADR-232): sashimi, its
  counts and the tables engine read `junction.*`; the arcs, the cloud, the
  connectors and the tables read `connection.*` and `breakpoint.*`.
  - `breakpoint.reads` counts the reads in an inter-chromosomal mate-pair
    cluster. A split read is no cluster, so the exemption today's
    `minInterchromReads` spells out holds by what a row is, and the compiler
    stays AND-only.
  - Every count field is `reads`, the strokeWidth's included.
- **`value` is the constant only.** Today alignments also paints it on a read
  with no value under a tag; that fill moves to a scale member for missing
  values, named in the channel step with display-kit's `unknown`, which means
  "not in the domain".
- **`scale.names`** names each domain value, by position, in the key, the hovers
  and the arc key. `labels` keeps Vega-Lite's boolean on `axis` and the text
  layer on `sashimi`; the rows objects' `labels` map converges on `names` in the
  rows step.
- **`scale.group`** shares one autoscaled domain across tracks, as
  `autoscaleGroup` does. ggplot2's scale `name` is the axis title, and a ggplot
  reader writing `name: "Depth"` would join a share group.
- **The legend switch is display-wide and each channel's is its own.** `legend.show:
  false` hides the whole key and skips its scans; a channel's `legend.show:
  false` drops that channel's entries.
- **`pileup.showOutline` is cut.** `read.slang` repaints a fixed 1 px edge that
  no width could set, and no config, menu or figure writes the slot. The
  outline follows `unit`, as unset does today.

### Amendments to ADR-238

The six amendments below change the shared vocabulary, so every display takes
them in its own stage:

1. **A written `filter` list merges with the defaults by field.** An entry
   replaces the defaults on its own field, entries an author writes on one
   field all apply (`gte` and `lte` on `insertSize`), and an entry naming a
   field with no test removes that field's defaults. Edit plot and the docs show
   the merged list. ADR-238's whole-list replacement silently dropped the 1540
   flags and both floors on any hand-written filter, and broke the launch-arg
   modifiers, which compose onto what the config says
   (`readFilterModifiers.test.ts`). The merge runs once at config resolve.
2. **A link's width is `strokeWidth`**, as Vega-Lite spells a line's width;
   `size` is a point's area.
3. **`autosize` is not borrowed.** Vega-Lite's `autosize` fits guides and
   padding inside a size; `pad` and `none` would claim the grow and fixed
   modes. `heightMode: fixed | grow | fit` stays, in every display's height
   step.
4. **`scale: 'none'` goes with no value-beats-field rule.** A written `field`
   always paints. A display whose color maps a field by default declares it as
   `impliedField` (wiggle, the multi-way ribbons), which LGVSyntenyDisplay's
   `field: 'strand'` default and its `shorthandWith: { scale: 'none' }` move
   onto. The field Color by → Default leaves becomes display state; the
   variant cells read it from there.
5. **`scale.name` is `scale.group`**, and **per-value names are `scale.names`**.
6. **`legend.descending` stays a legend member.** A channel `sort` reorders the
   domain and so reassigns colors, and a threshold domain must ascend.

### Every current slot

| Today | End state |
|---|---|
| `height`, `heightMode`, `growMaxHeight`, `unit`, `sort`, `collapseSections` | unchanged |
| `filter.flagInclude`, `flagExclude` | `flags.<samFlagName>` entries; names from launch-args' `flags:` list |
| `filter.minMapq`, `readName` | `mapq gte`, `name equal` |
| `filter.tags[{ tag, value }]` | `tags.XX equal`, or `valid: true` with no value |
| `filter.spliced`, `svSignal`, `alone`, `split` | `<field> equal true \| false` |
| `filter.junctions.minReads`, `nonCanonical` | `junction.reads gte`, `junction.canonical equal` |
| `filter.connections.interchrom`, `offscreenMates`, `minInterchromReads` | `connection.interchrom`, `connection.offscreen`, `breakpoint.reads gte` |
| `facet.domain` | `facet.sort`; every `domain` that only orders moves in the same sweep |
| `color.*` | `encoding.color`: `scale.{type, domain, range, names, scheme, reverse, domainMin, domainMax, domainMid, domainQuantile}`, `legend.{show, title, descending}` |
| `showLegend` | `legend.show` |
| `scales.y.*` | `coverage.encoding.y.scale` and `.axis`, with wiggle's y step (`ScoreScaleMixin` hard-codes the path); `rules` follows wiggle's spelling |
| `coverage.showInterbaseIndicators`, `minAlleleFraction` | `coverage.interbase.show`, `coverage.alleles.filter` |
| `pileup.readHeight` | `pileup.mark.height` |
| `pileup.showMismatches`, `showSoftClipping`, `showConnectors` | `pileup.mismatches.show`, `softClips.show`, `connectors.show` |
| `pileup.showOutline` | cut |
| `pileup.fadeLowBaseQuality` | `pileup.mismatches.encoding.opacity` over `baseQuality` |
| `pileup.fadeLowFrequency`, `maxLayoutHeight` | unchanged |
| `baseColor` | `pileup.bases.show` and `.encoding.color` |
| `modifications.threshold` (percent), `cytosineContext`, `shownModifications` | `pileup.bases.filter` on `probability` (0–1), `context`, `code`; the threshold applies in the by-type view only, as today |
| `modifications.unmodified` | `pileup.bases.unmodified.show`; the data picks implicit or called sites, as the menu does (`modificationsMenu.ts`) |
| `sashimi.showCounts` | `sashimi.labels.show` |
| `readConnections.mark: arc \| cloud` | `{ type: 'link' } \| { type: 'rule' }`, a bare name lifting to the type. A link draws a dome (`arcMarks.ts`); `interpolate` joins the object when a second shape does, since one legal value would be a setting that sets nothing |
| `readConnections.lineWidth` | `encoding.strokeWidth`, field-mapped over `reads` as it draws today |
| `readConnections.color.field` | `encoding.color.field` |
| `readConnections.showOrdinaryPairs` | `ordinaryPairs.show` |

## Open

1. **Legend precedence.** The display-wide `legend.show` above, or only the
   per-channel one, as Vega-Lite has. The display-wide switch saves an author
   three nested writes and gates real scans.
2. **`unmodified` as a code** (`code: oneOf ['m', 'h', 'unmodified']`) in place of
   `bases.unmodified.show`, which removes a boolean. The data picks implicit or
   called sites, so a methylation owner confirms MM `?`-mode data first.
3. **`pileup.connectors` beside `readConnections`.** Both draw mate links and
   differ in where; one of the two names changes.

## Rejected

| Proposal | Why not |
|---|---|
| `collapseSections` as `pileup.stack: false` or `pileup.position` | Vega-Lite's `stack` sums values sharing a position, and ADR-118 rejected `dodge` for the pileup; the facet field on `encoding.y` misses that a collapsed section keeps its own coverage band |
| `heightMode` as `autosize` | Amendment 3 |
| A field-keyed filter map (`{ mapq: { gte: 20 } }`) | ADR-238's own rejection, and the same shape declined for `filter.tags` |
| Junction and connection predicates in each band's own `filter` | ADR-232: several parts and the tables engine read one filter |
| `or` / `not` / `range` in the compiler for `minInterchromReads` | Nothing else in the display needs them; `breakpoint.reads` says the same with AND alone |
| `ordinaryPairs` as a filter predicate | "Ordinary" is modal insert size for the cloud and a concordant, baseline-colored pair for arcs, and in `filter.connections` it would drop the pileup connectors too |
| `facet.hidden` as a predicate | A hidden section is main-thread, and coverage still counts its reads |
| `hideSelfAlignments` as a view-assembly token in `facet.hidden` | A token in a value list is templating; `facetForField` wipes it on a field change. LGVSyntenyDisplay's own stage decides |
| `bases.impute` for `unmodified: 'all'` | `'all'` runs another extraction path, and a probability default would break the two-color view, where no threshold applies |
| `legend.labels` | `labels` already means a boolean on `axis` and a text layer on `sashimi` |
| `legend.descending` as the channel's `sort` | Amendment 6 |
| `size` for a link's width | Amendment 2 |
| Cutting `fadeLowFrequency` | ADR-238's amendment keeps it: it fades by a fact about the data |
| `maxLayoutHeight` as an engine constant | The chip's expand and deep-coverage users write it |
| `mark: 'arc' \| 'rule'` | ADR-238 settled `link` with `interpolate`; `arc` is Vega-Lite's pie wedge |

## Order of work

Each step moves one concept everywhere at once, with its in-repo writers in the
same commit: the menus, `launch-args/src/displaySettings.ts`, `TrackModifiers`,
jbrowse-img's `applyTrackOpts.ts` key list, `retired.ts`, `plotExamples`, the
`test_data` and figure-spec configs, and the docs. ggjbrowse follows each step.

| Step | Moves work? | Gate |
|---|---|---|
| 1. Layer `show`s, MAF's coverage band with them through the shared schema | rename | `pnpm verify --full`, plotExamples round-trip, launch-args tests |
| 2. The channel object, from display-kit's color factory out: `encoding.color`, `scale.names`, `scale.group`, the missing-value member, `readConnections.encoding`, `pileup.bases`, legends; coverage y with wiggle's y step | rename | `--all`; agree the order with the color-object thread |
| 2b. The quality fade as opacity | two uniforms and a subtract | one run of the mismatch bench |
| 3a. The read filter on the predicate compiler, with the merge rule | worker | whole-fetch A/B on `1000x.shortread.bam` on ada; on a loss the flag and MAPQ entries lower to today's hand test behind the same config |
| 3b. `junction.*`, `connection.*`, `breakpoint.*` | main thread, same compares | arcs and sashimi suites; no refetch on an edit |
| 3c. The layer filters: `alleles`, `interbase`, `bases` (percent to fraction) | same compares | coverage and modification suites |
| 4. `pileup.mark.height`, `facet.sort` | rename | fit and grow tests |
| 5. `readConnections.mark` | rename | menus, launch-args |

The internal `ColorBy` scheme object and the `filterBy` / `colorBy` RPC
arguments converge on the config's own words in whichever step shrinks by it.
ADR-120 freezes only config paths, so these can follow later.

## Consequences

- An author who writes `filter: [{ field: 'mapq', gte: 20 }]` keeps the duplicate
  exclusion and both floors.
- `pileup.connectors` or `readConnections` changes name once Open 3 is settled.
- `breakpoint` is a new row namespace beside `junction` and `connection`.
