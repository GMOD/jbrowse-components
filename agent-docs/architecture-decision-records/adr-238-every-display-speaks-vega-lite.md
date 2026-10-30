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

Amended 2026-10-22 by [ADR-240](adr-240-the-alignments-display-speaks-vega-lite.md),
the alignments stage: a written `filter` list merges with the defaults by
field, a link's width is `strokeWidth`, `autosize` is not borrowed,
`scale: 'none'` goes with no value-beats-field rule, `scale.name` becomes
`scale.group`, and per-value names are `scale.names`.

Amended 2026-10-23 for Pass B, the y channel (below): `encoding.y` carries
`scale`, `axis` and `rules`; the outlier fence is `scale.fenceQuantile`; the
tree sidebar's toggles go to an `axis` beside `rows`.

Amended 2026-10-26 for the canvas feature display (below): its labels are
parts with `show`, `mouseover` is `tooltip`, `utrColor` is
`utrs.encoding.color`, `longestCoding` is `representative`, and `subParts`,
`connectorColor` and the per-feature `mark.height` callback are cut.

Amended 2026-10-27, ruling the leftovers once: no `view.*` predicate field is
built; the feature display's two label thresholds and the mark display's
`minWidthPx` are cut for the defaults they held; a mark's zoom interval stays
`minBpPerPx`/`maxBpPerPx`; the multi-way display's lane ticks are `axis.show`,
its lane names `labels.lanes.placement`, and its strand split the only layout;
view launch keys keep their pixel words.

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

`{ field, equal | lt | lte | gt | gte | range | oneOf | valid }`. A
`filter` list is the AND of its entries. Where a display declares default
entries (the alignments reads, modification calls and interbase triangles), a
written list merges with them by field, as ADR-240 amends: an entry replaces
its field's defaults, and `{ field }` alone removes them. Edit plot lists the
defaults beside the written list. With no defaults declared, the list is the
whole filter.

Amended 2026-10-24:
- `range` is built as a load-time lift to `gte` and `lte`, the tighter bound
  winning, so no compiler or hand reader sees it.
- `and`, `or`, `not` and `param` are not built. No display needs them, and
  a 5.0 host drops an unknown operator with a warning.
- An entry whose every written test is `null` or unknown (R's `NA`, Python's
  `None`, an operator from a later release) loads as no entry rather than a
  bare `{ field }`, which on alignments would remove the field's defaults.
- A missing value is `isMissing`'s (absent, empty, an all-empty list such as
  a VCF's `DP=.`), the color key's own; a comparison reads `numericValue`, so
  text that is no number fails it too, while `valid: true` admits it.

- A comparison on a missing value is false, and `valid: false` selects the
  missing values.
- Fields:
  - a record's own fields
  - BAM flag bits as booleans
  - `tags.XX`
  - a derived table's rows by namespace (`junction.reads`, `connection.reads`),
    which keeps ADR-232's one filter read by every part that draws those rows
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
- Amended 2026-10-20: the fence is not a quantile. `scales.y.domainQuantile`
  stops an extreme at twice the span its quantile draws (ADR-208), where a
  color ramp's stops at the quantile itself, so `{ quantile: 0.99 }` on the
  axis would clip what today draws whole. The fence's q, which "Clip extreme
  outliers" writes, needs a member of its own beside `domain`.
- `reverse` defaults per preset.
- Amended 2026-10-23: on an ordinal scale `unknown` paints the values
  `domain` leaves out, and `invalid`, Vega-Lite's word, paints a feature with
  no value. Unset, a feature with no value keeps the display's no-value color
  and its own key row; writing `invalid` as the `unknown` color files it under
  Other. Alignments had split the two first (ADR-240).
- `scale.name` shares a domain across tracks as the union of member domains,
  as `autoscaleGroup` does.
- A threshold takes at most eight cuts, which is the shader's cap.
- `scale: 'none'` goes. A constant is `value`.
- Presets are partial specs:
  - MAPQ is a threshold over `[1, 10, 30, 255]`, the cuts of today's
    `MAPQ_BINS`, so 255 is a real value with its own bin and passes `gte: 30`
    as it passes `samtools view -q 30`.
  - Insert size colors the worker-derived `pairClass` field.
- A constant compiles to a uniform. A field-mapped color or opacity bakes into
  the packed color lane the display already uploads. A mapped size needs a
  lane that exists, which today is the link's. No channel adds a lane.

### The y channel (Pass B, amended 2026-10-23)

`encoding.y` is the channel object of the Channel section above, for the value
axis of wiggle, the mark display (and Manhattan, which inherits it), and the
coverage bands of alignments, MAF and LGVSynteny. MAF's own `encoding.y` holds `field` alone, since
its only value scale is `coverage.encoding.y`.

- **Members:** `field` on wiggle (where `y` is the plotted field) and on MAF
  (where it picks the row bars), plus `scale`, `axis` and `rules`. The mark
  display's display-level `encoding.y` has no `field`: each mark's bare
  `encoding.y: 'score'` names the field and reads this object's scale, and a
  bare string at display level is refused at load.
  - It holds no field, so `checkMarks`, the mark schema's `requires` and the
    Plot field dialog still find `y` on the mark alone. Those are the costs
    [ADR-141](adr-141-one-y-scale-the-displays.md) rejected an inherited layer
    encoding for. A mark's `y` also keeps no scale of its own, where
    Vega-Lite's layer `y` replaces the parent's.
  - ADR-141's objection to `{ field }` on a positional channel, that the
    object had no second member, no longer holds once `scale`, `axis` and
    `rules` share it. Colin chose this shape (2026-10-22).
- **`scale`** holds `type`, `domainMin`, `domainMax`, `zero`, `fenceQuantile`,
  `constant` (was `symlogConstant`) and `group` (was `autoscaleGroup`), as
  ADR-240 spells them. **`axis`** holds `title` and `grid`, and from
  2026-10-30 `show`, as every other guide turns off: off, the value axis, its
  short-band caption and its grid go and the `rules` stay. This removes
  `tickCount` and `tree` from the Axis bullet below and overrides ADR-240's
  `tickCount: 4` sample.
- **The fence:** `scale.fenceQuantile` replaces `scales.y.domainQuantile`, so
  the word stays out of the y scale. A ramp's `scale.domainQuantile` keeps
  its meaning, clipping at the quantile itself. The fence stops an extreme at
  twice the span its quantile draws, measured per side of 0 (ADR-208).
- **`rules`** sits on `encoding.y`, not in `axis`: reference lines are values
  in the scale's domain, drawn across every band the scale rules.
- **`minimalTicks`** is cut with the move.
- **Writes** merge member by member on `encoding.y`, while a color, shape or
  size channel writes whole. A reset rewrites `scale`, `axis` and `rules`, not
  `field`, since `setConf` on a sub-schema path replaces the whole object.
- **Tree sidebar:** `showTree`, `showBranchLength`, `showRowLabels`,
  `showRowSeparators` and `treeAreaWidth` go to an `axis` beside `rows`, not
  `y.axis.tree`, since `rows` writes whole (Colin, 2026-10-22). The mark
  display keeps `facet`, `rows` and `encoding.row` as three words, and its
  per-category band is Vega-Lite's `row` channel over a shared `y`, not a
  `band`-scale `y`. This replaces the Rows bullet below.
  - **Members** (`RowAxis`, from tree-sidebar): `tree`, `branchLength`,
    `labels` and `width`. Wiggle, the multi-sample variant and the multi-row
    feature displays add `grid` (`RowAxisWithGrid`); MAF and the mark display
    draw no row separators.
  - `tree`, `labels` and `grid` are Vega-Lite's axis booleans, each naming
    the part it draws. `rows` holds what the axis draws (`rows.tree` the
    newick, `rows.labels` the text) and `axis` whether it draws it.
  - `grid` means the lines an axis carries across the plot, as on the views'
    `axis` and on `encoding.y.axis`; on a row axis they fall between rows.
  - `width`, not `extent`: wiggle's `extent` is the min-max band. A display's
    `encoding.y.axis` is the value axis and its top-level `axis` the row axis.
  - The model getters keep their names (`showTree`, `treeAreaWidth`), as
    `showLegend` reads `legend.show`. The old five names lift on each display.
- **Tables output names stay.** The tables' `type`, `scaleType` and
  `symlogConstant` are the R-facing contract; the exports map from the
  config's words.
- **Lifts.** Each moved display declares `scales` in `retired`, lifting
  `scales.y` onto `encoding.y` (the coverage bands onto
  `coverage.encoding.y`), until jb2hubs' hosted configs regenerate. Every v4
  `scales` lift (`valueScaleOf`, `retiredScaleSpellings`, the alignments
  coverage lift) targets the moved path in the commit that moves its display,
  since a lift to an undeclared key drops silently. Wiggle's `y` field lifts
  to `encoding.y.field`. A stored `trackConfigDeltas` display lifts by its
  display's schema before it merges over the base, so an old spelling there
  still beats the base's current one.

### The feature display (amended 2026-10-26)

`LinearBasicDisplay`, and `LinearVariantDisplay` on the same base. Two
reviews, a cold Fable read of the generated reference and an Opus read
against the code, checked the spelling twice.

- **Labels are parts:** `labels: { name, description, subfeatures }`, each
  with ADR-231's `show`. `name` and `description` hold the `field` they read;
  a bare string is that field's shorthand, written member by member
  (ADR-232), so jb2hubs' `labels.name: '<jexl>'` keeps loading on every host.
  `subfeatures` holds `placement`: `auto` labels a polyprotein's cleavage
  products on their rows, `below` and `overlay` every part. `showLabels` and
  `subfeatureLabels` go.
  - The variant band's `variants.labels`, LD's `labels.name`, and the
    multi-way display's `labels.name` (from `text` and `showGeneLabels`) take
    the same shape. The multi-way display's top-level `labels` holds its gene
    names and its lane names (`labels.lanes`), as its top-level `encoding`
    means the gene glyphs.
- **The density gate always runs, at thresholds the display fixes.** A name
  hides above `MAX_LABEL_FEATURE_DENSITY` (`zoomThresholds.ts`, features per
  pixel on screen), except gene names while the genes alone stay under it; a
  description hides above the lower `MAX_DESCRIPTION_FEATURE_DENSITY`,
  whether or not names draw. Amended 2026-10-27:
  `maxLabelFeatureDensity` and `maxDescriptionFeatureDensity` are cut, since
  no config, figure spec or menu wrote them, and `labels.<part>.show` is the
  one label control.
- **`tooltip: { show, field }`** replaces `mouseover`, as the multi-sample
  display's `tooltip` is a part. `mouseover` lifts until the hosted hub
  configs regenerate with `tooltip`.
- **`geneGlyphMode: 'representative'`** replaces `longestCoding`, which
  lifts for v4 configs. The mode draws the first isoform by `transcripts.sort`.
- **Cut:** `subParts` (the coding-transcript glyph draws its CDS and UTR
  boxes), `connectorColor` (the glyph's lines take the theme's stroke color)
  and `mark.height`'s per-feature callback (`pileup.mark.height` takes none).
- **`utrs: { encoding: { color } }`** replaces `utrColor` on both gene
  glyphs, the canvas feature display's and the multi-way display's, as a
  part's fill sits in its own `encoding` (`pileup.bases`, `readConnections`,
  `ribbons`). display-kit's `FeatureUtrs` serves both. The color is a
  constant or a per-feature jexl `value`, no field: a UTR takes a field's
  color through its transcript's fill. Unset, a UTR takes its gene's fill,
  and the contrasting UTR blue only where nothing sets one, which repaints
  the multi-way UTRs under cluster or constant colors to match the gene
  track above the lanes.
- **Kept:** `displayMode`, igv.js's word for the same presets, which apply on
  the main thread and also step font size and row padding; `geneGlyphMode`
  as a slot; `transcripts`; `containers`; and `encoding.color.value`'s
  callback, which colors per box where a `field` reads the transcript.

### The multi-way display (amended 2026-10-27)

- **`axis: { show }`** replaces `showLaneTicks`: the lanes' coordinate
  ticks are the display's axis, a guide that turns off through `show`. The
  display draws no row-axis gutter, so its top-level `axis` has no other
  meaning to clash with.
- **`labels.lanes: { placement: 'above' | 'overlay' }`** replaces
  `inlineLaneNames`. `above` gives each genome's name and span a line over
  its genes; `overlay` prints the name over the left end of the gene row, the
  feature display's `labels.subfeatures` word for a label drawn on its glyph.
- **The strand split is the only layout.** Genes reading rightwards on screen
  sit above the lane line and leftwards below; a lane too short for two rows
  already draws one, so `splitStrands` is cut.

### Mark, guides, coordinates

- **Marks:** `rect bar point rule tick line area text link gene`.
  - Amended 2026-10-24: the mark display and wiggle say `rect` where they
    said `span`, a band from `x` to `x2` filling its row, as Vega-Lite and
    GenomeSpy name it; render-core's shape keeps the id `span`, since canvas
    registers a `rect` pass. Built today: `bar point rule line rect text
    link`.
  - `link` joins `x..x2` to its mate: a curve between points, a ribbon between
    intervals. One mark covers the synteny ribbons, the dotplot segments and
    the chords.
  - `interpolate` (`linear step monotone bump arc`) is the one curve word.
    `linear`, `step` and `monotone` are Vega-Lite's. `bump` is d3's
    `curveBump`, the cubic with both control points at mid height that the
    synteny ribbons draw. `arc`, and the mark display's default `dome`, are
    ours, a link's `mark.interpolate` there. Vega's `linkpath` transform calls the same
    family `shape` (`line arc curve diagonal orthogonal`).
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
  Amended 2026-10-23, reversing the 2026-10-20 split: `data.resolution` takes
  three meanings, one per family.
  - `SyntenyData`: `'auto' | 'fine' | 'coarse'`, the stored tier.
  - `WiggleData`: points per pixel, default 1.
  - `HicData`: binsize steps from the zoom's pick, default 0. Larger is finer
    as wiggle's is, so the old `resolutionBias` flips sign.

  Kept 2026-10-27: one concept, how finely the data is read, and each
  family's typed `data` object names its unit.

  Hi-C's `selectedNormalization` is `data.normalization`. BigWigAdapter's
  `resolutionMultiplier` is an adapter slot and keeps growing coarser.
- **Render:** `render.antialias`, `true`, `false` or unset to follow the data, replaces
  `fadeThinAlignmentsMode`. Amended 2026-10-20: `pileup.fadeLowFrequency`
  stays apart, since it fades a sub-pixel mark by the share of reads carrying
  it, a fact about the data rather than the pixel it covers.
- **Rows:**
  - A split with its own inner scale is `facet`.
  - One position per category is `encoding.y` on a `band` scale. The
    dendrogram's toggles are an `axis` beside `rows` (see "The y channel").
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
| `modifications.threshold`, `cytosineContext`, `shownModifications` | predicates on the modification layer: `probability`, `context`, `code`. The threshold is a percent and `probability` a 0–1 fraction, and today only the by-type view applies it |
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
| `unknown` also painting a missing value, as d3's `ordinal.unknown` does | A feature with no value is something people look for (unannotated genes, unphased reads), and setting `unknown` hid it in Other on the feature, mark and variant displays while alignments kept it apart. `invalid` set to the `unknown` color still lumps them |
| Missing values passing comparisons | `gte: 0.9` would not mean at least 0.9. The UI hints when no track carries the field instead |
| Per-distinct-value evaluation of jexl | It needs structure read back out of jexl, which GRAMMAR_OF_GRAPHICS.md already declined |
| `ribbon` and `cell` marks | `link` between intervals and a band-scaled `rect` say them |
| Separate `fetch` and `layout` bags | Vega-Lite puts these on `data` and the top level |
| `showOffscreenMates` as a clamped end | A clamped end cannot carry the click that navigates to the mate; it is the synteny view's `offscreen` part |
| `bridgeSkippedLanes`, `showIntraviewLinks`, implied UTRs as flags | One behaviour each |
| `tension` for the chord curve | Vega-Lite's `tension` (d3's bundle `beta`) runs from a straight line to the full pull; the chord curve straightens no chord but an antipodal one, bows past straight toward the rim, and scales with each chord's length, as circlize's `h.ratio` does |
| `encoding.stroke` for the feature display's `connectorColor` | A constant-only stroke is a color-object variant, a field-mapped one needs a lane and a key nobody asked for, and nothing wrote the slot |
| A `maxDensity` member on each label part | A new `max*` word, and no value of it means "always": the label gate counts features on screen, while the too-many-features gate reads a sampled average and skips a force-loaded track |
| `show: true \| false \| 'auto'` on a label part | `show` is a boolean on every part |
| `displayMode`'s presets as written `mark.height` values, `collapsed` as a `layout` | The worker reads the height, so each preset click would refetch; the presets also step font size and padding |
| `containers` as `unnest` | It names a data transform; only the layout changes, and filters, tables and counts see the same records |
| A flat `utrColor`, or `encoding.utrColor` | Flat, it is the one fill left outside an `encoding`; under `encoding` it is a part-qualified channel, which Vega-Lite never spells (no `encoding.medianColor`) |
| `labels.subfeatures.filter` defaulting to the cleavage-product types, in place of `placement: 'auto'` | A written `placement: 'below'` would then label only the cleavage products, and labeling every part would take `filter: [{ field: 'type' }]`, today's `below` spelled obscurely |
| `encoding.y.scale.reverse`, the successor to wiggle's v4 `inverted` | No use case justified it (Colin, 2026-10-26): it would change the shaders, their Canvas2D twins, the axis and the band compare for about 2-3 days of work. `retiredScaleSpellings` drops `inverted` |
| A `view.*` predicate field (`view.bpPerPx`, a feature density) replacing the zoom and density gates | The label gate keeps gene names where the genes alone are sparse, which a predicate on one density cannot say, and nothing wrote the label thresholds. A mark's zoom interval keeps `[minBpPerPx, maxBpPerPx)`, the words core's adapter `zoomRange` uses for the same interval |
| `minWidthPx` as Vega-Lite's `minBandSize`, or kept as a slot | Nothing wrote it; the floor is 1 px for every bar and rect |
| A Vega-Lite word (`spacing`, `padding`, `strokeWidth`) for the views' pixel launch keys (`spacingPx`, `paddingPx`, `minimumRadiusPx`, `minVisibleWidth`, `overdrawPx`, dotplot `lineWidth`) | They are view state the app writes into sessions, and v4.3.0 share links carry the circular view's; this ADR settles display settings |
| `splitStrands` kept as a switch, or as a `yOffset` channel on reading direction | One layout reads better at every lane height it fits, and a short lane already falls back to one row |

## Consequences

- GRAMMAR_OF_GRAPHICS.md's "declined: filter shorthands such as
  `{ field, oneOf }`" is reversed: a field predicate compiles to a lane
  compare, which jexl cannot.
- `domain: null` is each display's own autoscale method, not one algorithm.
- A user-written filter list replaces the default predicates only on the
  fields it names (ADR-240).
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
