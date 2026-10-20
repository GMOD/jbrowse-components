---
status: Accepted
summary: "Every display's settings take Vega-Lite's words and shapes, and each display keeps its hand-written pipeline: one predicate list (`{ field, gte | oneOf | valid | ... }`) replaces every filter family and every min/max/only/exclude/threshold setting; one channel object (`{ value | datum | field, scale: { type, domain, range, ... }, legend | axis }`) under `encoding` replaces the color-object variants, `scales.y`, `opacity` and the size settings; `link` with `interpolate` draws curves, ribbons and segments; `axis`, `legend`, `coord.ratio`, `data.resolution` and `render.antialias` replace the guide, scale-lock, level-of-detail and fade flags; a part or guide turns off through ADR-231's `show` member, every top-level `show*` and `hide*` going. Amended 2026-10-20: not with `null`, which resets a slot to its default. Composition (`layer`, `transform`) is written only where a display already composes: the mark display and the multi-way lanes. Reverses GRAMMAR_OF_GRAPHICS.md's decline of field predicates; keeps ADR-110 (no `condition`) and ADR-118 (no `dodge` or band chains on typed-row-less displays)"
---

# ADR-238: Every display speaks Vega-Lite

## Status

Accepted (2026-10-20), to build in stages before the 5.0.0 tag freezes config
slot paths (ADR-120). Amended the same day: a part turns off through its
`show` member, not `null`, once building the synteny view's `offscreen` part
showed the config system reading `null` as "reset to the default".

Colin's steer, on a review of the linear synteny view's settings: aim for
ideal grammar-of-graphics terms rather than house ones ("things like
'minLength' are exactly the types of things that concern me"), elegance over
"a maze of booleans/flags", speed as the one extra constraint, and churn is
fine if the end state is ideal. He asked for the whole app's surface to be
designed before any of it is built.

Four reviews shaped the design: a factual inventory of every display's
settings, a cold Fable design from that inventory alone, then an Opus review
of speed and mechanism against the code and a Fable cold read of the
spelling. The working papers are in the session's scratchpad; this record is
what they settled.

## Context

- The inventory counted about 18 color-object variants, each with its own
  `scale` vocabulary, and seven filter families. The words included
  `minMapq`, `minLength`, `minIdentity`, `minMinorAlleleFrequency`,
  `maxMissingness`, `minReads`, `threshold`, `only` and `exclude`.
- The same concept had several names. The location markers and the dotplot's
  gridlines are one guide (the ruler carried through the plot). `sameScale`
  and `lockAspectRatio` are one constraint. `lineWidth`, wiggle `size` and
  `readConnections.lineWidth` are one channel.
- The same word had several meanings: `rows`, `facet`, `filter`, `mark`, `y`,
  `size`, `labels`, `heightMode` and `domainQuantile`.
- ADR-091 refused composing a display's code from a declaration, and ADR-118
  priced a generic `pileup` step at 4.23x the layout it would replace. Both
  constrain the structure; neither constrains the words.

## Decision

**The vocabulary is Vega-Lite's; the engine stays each display's.** A
display spec uses Vega-Lite's names and object shapes. Each display resolves
them before its loop, into the typed reads, uniforms and lanes it already
uses. A spec writes composition (`layer`, `transform`) only where a display
already composes, so an edit to it works: the mark display's `marks`,
`transform` and `facet`, and the multi-way lanes. Elsewhere a band or part is
a named noun (`coverage`, `pileup`, `sashimi`), and its members use the same
vocabulary.

### Shape

```
{ type, filter, encoding, mark, facet, <named parts>,
  height, autosize, maxHeight,
  data: { resolution, normalization, limit }, render: { antialias },
  theme, navigation }
```

- Channels sit under `encoding`, inside a named part too:
  `coverage: { encoding: { y: { scale: { type: 'log' } } } }`.
- A part, sub-layer or guide turns off through its `show` member, ADR-231's
  band contract, so it keeps its other settings while off:
  `coverage: { show: false }`, `legend: { show: false }`. Every top-level
  `show*` and `hide*` goes into the part it toggles.

### Predicate

`{ field, equal | lt | lte | gt | gte | range | oneOf | valid }`, with
`and`, `or`, `not` and `param`. A `filter` list is the AND of its entries,
and it is the whole filter: writing one replaces the default list, which Edit
plot and the docs show.

- A comparison on a missing value is false, and `valid: false` selects the
  missing values.
- Fields:
  - a record's own fields
  - BAM flag bits as booleans
  - `tags.XX`
  - a derived table's rows by namespace (`junction.reads`, `connection.reads`),
    which keeps ADR-232's one filter read by every part that draws those rows
  - `view.bpPerPx`, a per-draw constant, which replaces every zoom gate
- A field predicate compiles to one typed read and a compare. Adjacent flag
  predicates fuse into one mask. On feature objects the read is
  `feature.get(field)`, and the constant's type decides coercion.
- jexl stays the slow path: a computed `field: 'jexl:...'` and the mark
  display's `{ type: 'filter', expr }` step.
- A filter edit fetches no bytes. A predicate upstream of a layout or
  aggregate reruns the worker over the cached parse, as today; one on a leaf
  layer is the main-thread zero-alpha mask that the draw, hit test, export and
  tables already skip.

### Channel

`{ value | datum | field, scale: { type, domain, range, scheme, reverse,
zero, clamp, constant, unknown, name }, sort, legend | axis }` serves
`color`, `opacity`, `size`, `strokeWidth`, `shape` and the positional
channels.

- `scale.type` is d3's list.
- A domain end of `null` autoscales by the display's own method, so wiggle
  keeps its outlier fence. `{ quantile: q }` means the q-quantile of the
  channel's values.
- `reverse` defaults per preset.
- `scale.name` shares a domain across tracks as the union of member domains,
  as `autoscaleGroup` does.
- A threshold takes at most eight cuts, which is the shader's cap.
- `scale: 'none'` goes. A constant is `value`.
- Presets are partial specs:
  - MAPQ is a threshold over `[1, 20, 30, 255]`, so 255 is a real value with
    its own bin and passes `gte: 20` as it passes `samtools -q`.
  - Insert size colors the worker-derived `pairClass` field.
- A constant compiles to a uniform. A field-mapped color or opacity bakes into
  the packed color lane the display already uploads. A mapped size needs a
  lane that exists, which today is the link's. No channel adds a lane.

### Mark, guides, coordinates

- **Marks:** `rect bar point rule tick line area text link gene`.
  - `link` joins `x..x2` to its mate: a curve between points, a ribbon between
    intervals. One mark covers the synteny ribbons, the dotplot segments and
    the chords.
  - `interpolate` (`linear step monotone bump arc`) is the one curve word.
  - The chord displays' `mark.depth` replaces `bezierRadiusRatio`, flipped so
    a larger value curves more: 1 runs an antipodal chord through the center.
- **Axis:** `axis: { grid, labels, title, tickCount, format, extent, tree }`.
  It replaces the gridline, location-marker, tick-label and minimal-tick
  flags and the tree sidebar's toggles.
- **Legend:** `legend: { show, title, format, values }` replaces
  `showLegend`, `labels`, `title` and `breaks`.
- **Coordinates:** `coord: 'cartesian' | 'parallel' | 'polar'` names the
  dotplot, the linear synteny view and the circle, and `ratio: 1` replaces
  `sameScale` and `lockAspectRatio`.
- **Data:** `data.resolution` replaces the comparative `lodMode`, the stored
  tier a tiered file is read at. Amended 2026-10-20: wiggle's `resolution`
  (points per pixel) and Hi-C's `resolutionBias` (steps from the zoom-chosen
  bin) measure other things, so each family's stage settles its own spelling
  rather than giving one number three meanings.
- **Render:** `render.antialias`, `true`, `false` or unset to follow the data, replaces
  `fadeThinAlignmentsMode`. Amended 2026-10-20: `pileup.fadeLowFrequency`
  stays apart, since it fades a sub-pixel mark by the share of reads carrying
  it, a fact about the data rather than the pixel it covers.
- **Rows:**
  - A split with its own inner scale is `facet`.
  - One position per category is `encoding.y` on a `band` scale, with the
    dendrogram as `y.axis.tree`.
  - `facet.sort` orders and never drops; a predicate drops.

### CIGAR detail in the comparative views

The indels are a part of the alignment mark:

| Setting | Draws |
|---|---|
| `indels: { show: false }` | one block per record, today's `cigarMode: 'off'` and `drawCigar: false` |
| `indels: {}` | indels drawn in their op colors, `full` |
| `indels: { encoding: { opacity: { value: 0 } } }` | indels left as gaps, `matches` |

### Layers inside a part

Amended 2026-10-20. A band such as alignments `coverage` is already drawn as a
list of layers (`coverageBandMarks.ts`): depth bars, allele segments,
modification segments, the interbase histogram, its indicator triangles and
the clip strips. A setting inside a part that switches one of those layers is
the layer's `show`, and a threshold for drawing a layer's records is a
predicate in the layer's own `filter`:

| Today | Grammar |
|---|---|
| `coverage.showInterbaseIndicators` | `coverage.interbase.show` |
| `coverage.minAlleleFraction` | `coverage.alleles.filter: [{ field: 'fraction', gte }]` |
| `INDICATOR_THRESHOLD` and the minimum depth in `interbaseCoverage.ts` | the default `coverage.interbase.filter`, which an author can see and edit |
| `pileup.showMismatches` | `pileup.mismatches.show` |
| `sashimi.showCounts` | `sashimi.labels.show`, a text layer |
| `modifications.threshold`, `cytosineContext`, `shownModifications` | predicates on the modification layer: `probability`, `context`, `code` |
| `variants`' `minMinorAlleleFrequency`, `maxMissingness` | `{ field: 'maf', gte }`, `{ field: 'missingness', lte }` |

- **`minAlleleFraction` is a filter, not a color rule.** ADR-232 called it
  one, but the allele layer omits a segment below the share and the grey
  depth bar shows through, which is what a filter on that layer draws.
- **This is not the `filter.alleles` ADR-232 rejected.** That rejection was
  of one display-wide setting driving both the coverage floor and the pileup
  fade. A layer's own filter reaches only that layer, and
  `pileup.fadeLowFrequency` stays a render rule.
- **A layer's filter costs what the hand-written test does.** The allele
  painter compares each segment's fraction already, and the interbase rule
  already runs in the worker, so a compiled predicate replaces a compare with
  the same compare.
- **Open: `pileup.fadeLowBaseQuality`** reads as
  `mismatches.encoding.opacity: { field: 'qual' }`. GRAMMAR_OF_GRAPHICS.md
  kept the fades as booleans because an opacity object would take one legal
  value, and the channel object of this ADR may change that. The alignments
  stage settles it.

## Rejected

| Proposal | Why not |
|---|---|
| Bands as `vconcat`, the pileup as `dodge`, coverage as `bin` + `aggregate` chains | A user could not edit the chain and get what was written without a generic engine; ADR-118's 4.23x stands until it is re-measured on typed BAM rows |
| `condition` for hover and selection | ADR-110's measurement: a hover in render state repaints the whole pileup per mousemove on Canvas2D. The synteny shade is also a function of the base alpha, which a constant cannot express. Hover and selection stay guides, and `colorHover`/`colorSelected` become `theme.highlight` |
| A part removed with `null` (Vega-Lite's `legend: null`) | `null` already means "reset to the default" in every config write (`setSlot(name, null)`, JSON having no `undefined`), and a part turned off by `null` loses its settings, where ADR-231's `show` keeps them for the way back |
| A field-keyed filter map (`{ mapq: { gte: 20 } }`) | A record list names its parts and grows operators; the same call kept `filter.tags` as records |
| Missing values passing comparisons | `gte: 0.9` would not mean at least 0.9. The UI hints when no track carries the field instead |
| Per-distinct-value evaluation of jexl | It needs structure read back out of jexl, which GRAMMAR_OF_GRAPHICS.md already declined |
| `ribbon` and `cell` marks | `link` between intervals and a band-scaled `rect` say them |
| Separate `fetch` and `layout` bags | Vega-Lite puts these on `data` and the top level |
| `showOffscreenMates` as a clamped end | A clamped end cannot carry the click that navigates to the mate; it is the synteny view's `offscreen` part |
| `bridgeSkippedLanes`, `showIntraviewLinks`, implied UTRs as flags | One behaviour each |
| `tension` for the chord curve | Vega-Lite's `tension` (d3's bundle `beta`) runs from a straight line to the full pull; the chord curve straightens no chord but an antipodal one, bows past straight toward the rim, and scales with each chord's length, as circlize's `h.ratio` does |

## Consequences

- GRAMMAR_OF_GRAPHICS.md's "declined: filter shorthands such as
  `{ field, oneOf }`" is reversed: a field predicate compiles to a lane
  compare, which jexl cannot.
- `domain: null` is each display's own autoscale method, not one algorithm.
- A user-written filter list drops the default flag predicates it does not
  repeat.
- The predicate compiler and the flag fusion are benched against today's
  `flagInclude`/`flagExclude`/`minMapq` path before the alignments display
  moves, since GRAMMAR_OF_GRAPHICS.md rule 3 holds a declared form to 1.00x
  the hand-written path.

## Order of work

1. The predicate compiler in display-kit, benched.
2. The comparative views: `filter`, `encoding`, `link`, `indels`, `axis`,
   `coord.ratio`, `render.antialias`, `data.resolution`.
3. The channel object across display-kit's color factory, then each family:
   alignments, canvas and variant, wiggle and mark, Hi-C, LD and MAF.
4. Guides, legends and layout across every display.
5. The writers: jbrowse-img, the R and Python packages, the figure specs, the
   docs.
