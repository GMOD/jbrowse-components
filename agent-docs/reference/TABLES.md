---
name: tables
description: "@jbrowse/tables — a display's data as columnar tables for a host that draws it (R through V8 in ggjbrowse): the contract, the bare-host bundle, and the downstream canary keeping ggjbrowse, JBrowseR and jbrowse-anywidget current."
audience: internal
kind: spec
---

# @jbrowse/tables

A display's data as tables, for a host that draws it with its own graphics
system: the alignments display's reads on their pileup rows, with their
mismatches, gaps and coverage, each as columns (one array per field), which R
reads as data frames. [ggjbrowse](https://github.com/GMOD/ggjbrowse) is the R
package on it; ggbandage and ggtubemap do the same over bandage-core and
tubemap-core.

## Why tables and not a translator

The R exporter ([R_EXPORT.md](R_EXPORT.md)) re-derives the browser's rules in
R: a BigBed parser, the BED12 transcript shape, MAPQ bins, the category hash,
the insert-size band, the pileup packing, the mismatch walk. Two adversarial
reviews found nearly every bug in one of those copies drifting from the
browser. A table is the browser's own answer, so that class of bug cannot
happen. On volvox ctgA the alignments table's reads, rows and mismatches equal
the exporter's hand-written R exactly, and a CRAM gives the tables its BAM
gives, with no samtools.

## Publishing

`@jbrowse/tables` was published first by hand (5.0.0-beta.13, tag `next`),
since a name npm has never seen cannot publish through the trusted-publisher
(OIDC) path `publish.yml` uses; the trusted publisher is set up, so the next
release tag publishes it with the rest. Its npm tarball carries
`dist/jbrowse-tables.js`, which ggjbrowse takes releases from.

## The contract

Each table lives in the plugin whose code computes it, exported on a subpath:
`@jbrowse/plugin-alignments/tables` (`alignmentTables`,
`registerAlignmentsAdapters`), and `@jbrowse/plugin-sequence/adapters` for the
reference. A table function takes a plugin manager holding the adapters, so it
needs none of the plugin's displays, React or MobX state. Coordinates are
0-based genomic; a `read` column is a 0-based index into `reads`. A
mismatch's `frequency` is its base's count over the depth there, not the
worker's `mismatchFrequencies`, which is a display fade zeroed below a
depth-dependent threshold. A region over `byteLimit` (200 MB of compressed
alignments by default) is refused off the index with an error naming the
size, since a host holds the whole table in memory.
`@jbrowse/tables` composes them (`createTablesEngine`) and adds
`missingContig` to each table: where the region's contig is not one the file
lists, the tables come back empty, as the browser draws such a track, and
`missingContig` says so and names the file's contigs, so a host can tell a
typo from a quiet region. `alignmentTables` also returns `settings`, the
resolved slots that decide which bands a host stacks (`showCoverage`,
`showPileup`, `showSashimiArcs`, `minSashimiScore`, ...), so the host composes
from the config rather than restating its defaults. The engine also serves the colors a
host should draw in (`alignmentColors`), read off the palette rather than
copied.

**A table takes the display's own config and answers what the display draws
with it.** `alignmentTables` takes `display`, the `LinearAlignmentsDisplay`
config as a track's `displays` entry writes it, resolves it through the
display's config schema, so the schema's defaults are the table's, and runs
the display's pipeline: the worker filters and fetches under
`colorBy`, the main-thread bake and classification (`applyReadColorsByGroup`)
paint each read, and the display's own key (`getReadDisplayLegendItems`) comes
back as `legend` with `legendTitle`. Each read carries its painted `color` as
`#rrggbb` and its `category` (`fwdStrand`, `mapq`, `unmappedMate`, ...). A host
draws `color` as given and keys the legend off `legend`, so a scheme the
browser gains paints in R with no port. A color bar the display keys (a
linear tag or MAPQ ramp, base quality) comes back in `ramps`.
A host has no assembly manager, so where a file spells a contig another way
than the reference does, it names both: `region.refName` for the file and
`region.originalRefName` for the reference, as the browser's renamed regions
carry it (ggjbrowse's `reference_chrom`).

A setting the table cannot serve is refused with an error:

- `unit: 'chain'` is refused with an error. Chain mode joins a read to its
  mates on the main thread, which the table does not run.
- A facet that hides every section is refused, so an empty table always
  means an empty region.
- With no assembly, coloring by the mate's contig takes each contig's name
  hash, where the browser takes the assembly's own contig order.

Beside the reads come the marks the display draws on them, each as the
worker ships it: `insertions` (position, length, sequence, read), `clips`
(position, length, `soft` or `hard`, read) and `junctions`, the skips merged
as the sashimi band merges them (start, end, supporting-read count, strand off
the reads' tags or the splice motif, and the motif where the region's sequence
covers both ends), every junction down to a single read, since the display's
`minSashimiScore` and `showNonCanonicalJunctions` are the host's to apply. `alignmentColors` names the
insertion, soft-clip and hard-clip colors beside the rest. A mismatch, gap,
insertion or clip carries `fade`, the worker's own frequency byte: its share
of the depth at its site, zeroed below the display's depth-dependent
threshold, which is what the pileup fades a sub-pixel mark by (the shaders'
`frequencyAlpha`: `width + fade * (1 - width)` for a mark under a pixel
wide), so a host can fade sequencing errors as the display does without
porting the threshold. The display's `baseColor` and `modifications`
objects select its per-base layer the same way `color` does: under
`{ field: 'modifications' }` the reads' base modifications come back as
`modifications` (position, read, type code and name, probability, whether
the call says the base is unmodified, and the color and opacity the display
paints it at), the reads take the layer's pale strand tints, and the key
gains the modification rows. Under `{ field: 'baseQuality' }` each aligned
base comes back in `qualities` (position, read, Phred score, and the ramp
color the layer paints it), and `ramps` holds the quality bar.
`referenceSequence` reads a region's bases
through the assembly's sequence adapter, for a host drawing them under a
pileup; the bundle serves it as `jbrowse.sequence`. The coverage band's
stacks come back as the worker packs them for the display: `alleleCoverage`
(each mismatch position's alleles as fractions of its bar, `from` and `to`,
with the `depth` there) and `modificationCoverage` (each modification state's
share, in its color and opacity), decoded through alignments-core's own
segment readers, so a host stacks what the display stacks. The interbase
histogram comes back the same way, as `interbaseCoverage` (each position's
insertions, soft clips and hard clips stacked in that order, `from` and `to`
in reads), with `indicators` (the positions whose events pass the display's
share of the local depth, and the most common `type` there), and `glyph`
gives the indicator triangle's size in px. The display
hangs the histogram from the band's top at half a depth unit per read, and
draws neither while `settings.showInterbaseIndicators` is false. The display's
`sort` object (a whole-window order, or a column sort over `pos`) lays the
rows out as the display does, through the display's own `sortOf`; a column
sort may leave out `refName`, which then means the region's, and may name the
contig as the reference spells it (`originalRefName`). Under
`color: { field: 'mateRefName' }` the palette is dealt in the assembly's
contig order, `refNames` spelled as the file spells them, or the file header's
order where a host passes none.

The display's `facet` object (`field`, `domain`, `hidden`) splits the reads
into stacked sections as the worker partitions them for the display, ordered
by `orderedGroups` under the facet's `domain`, each laid out on its own:

- Every table carries a `section` column, the section's label, and `sections`
  lists `key` and `label` in stacking order. Ungrouped, there is one section
  labelled `''`.
- A `read` column indexes the joined `reads`, across sections.
- The read colors and their key pool over the sections, as the display's do,
  so one key serves every section.

Under `readConnections` (`'arc'` or `'cloud'`) the read-connection band comes
back from the display's own arc pass (`computeArcsByGroup`), run over every
section at once as the display runs it:

- `arcs`: each mate-pair or split-read connection's feet (`start`, `end`,
  the near foot first, so `start` can lie right of `end`), `shape` (`arc`, `flat`, `flatSplit`, `unplaced`), `category`, and the
  `color` and `opacity` the band paints it in.
- `y` is where the band plots it in bp: an arc's genomic radius, or the read
  cloud's |TLEN| with the display's ±8% jitter. `span` is the distance
  itself, and `arcSpanMax` the read cloud's y domain.
- `support` is the reads behind it, and `width` the stroke in px from the
  shader's own `linkStrokeWidthPx` over `arcStrokeScale`, past its 1.5 device
  px antialiasing floor, which is the GPU's concern and not the host's.
- `arcTicks` are the interchromosomal ticks, with the contigs each reaches.
- `arcLegend` and `arcLegendTitle` are the band's key. `arcColor`,
  `showOrdinaryPairs`, `showInterchrom`, `showLongRange`,
  `minInterchromSupport` and `readConnectionsLineWidth` act as they do in the
  display.

A host has no assembly, so a split read whose SA tag spells its contig
another way than the BAM does reads as interchromosomal.

`@jbrowse/plugin-canvas/tables` (`featureTables`) does the same for a feature
track. It takes the `LinearBasicDisplay`'s config as a track's `displays`
entry writes it and a `bpPerPx`, runs the feature worker, then the display's
own layout under its `heightMode` and `height` (the fit ladder,
`fitLadderViews`), color resolution (`resolveMapColors`) and label placement
(`forEachDisplayLabel`). Under the default `fit` the table gives up the labels,
isoforms and row height the browser gives up to fit the track; `heightMode:
'grow'` places every feature at full size:

- `features`, one per top-level feature on its laid-out row (`top`,
  `bottom` in the display's px), and `subfeatures`, a gene's transcripts.
- `rects`, `lines`, `chevrons` and `arrows`, the glyph's primitives in their
  resolved colors. A chevron or arrow comes back only where the display
  draws one at this zoom (the shaders' `showChevrons` and `arrowDraws`), and
  `glyph` gives the px sizes they draw at.
- `labels`, each name, description and transcript label the display shows at
  this zoom, placed by its rule, with `position` in bp.
- `legend` and `legendTitle`, the color field's key (`featureColorKey`, the
  display's own), and `ramps`, a ramp's color bar.

The layout is the display's grown to its content, as under `heightMode:
'grow'`: no fit ladder, no facet sections. `@jbrowse/tables` installs the
BED, GFF3 and GTF plugins, which register adapters and nothing else.

`@jbrowse/plugin-wiggle/tables` (`wiggleTables`) does the same for a
quantitative track. It takes the `LinearWiggleDisplay`'s config and a
`bpPerPx`, which picks the BigWig zoom level that answers. It runs the
display's worker (`executeRenderMultiWiggleData`), its autoscale
(`computeAutoscaleDomain`, `widenRangeToRules`, `getNiceDomain`) and its
layer encoder (`buildSourceRenderData`):

- `bins`: each source's scores as the worker ships them, with the bin's min
  and max where the file summarizes.
- `marks`: the encoder's layers in paint order, so a min-max extent comes
  back as the max, aggregate and min bands, tinted as the display tints them,
  and a line's min-max band as rows with `band` set, at the `opacity` the
  display paints it. `low` is where a mark reaches down to: the band's min,
  or the `origin` bars grow from.
- Each mark's `color` is the display's. A bar takes its value's color; a line
  takes the color of the band between the cuts its score is in
  (`thresholdBandOf`); a min-max band comes back in pieces split at the cuts, each in its band's
  color, as the display fills it. Under density and a gradient the color is
  the shared ramp's (`makeDensityRgbStringFn`, `makeDensityLutFillFn`) over
  the resolved domain.
- `run` numbers an interpolated line's stretches, starting a new one where
  the display breaks the line (`centerLinksToPrevious` over the encoder's
  `gapLimitBp`).
- The sources stack in the order `rows.domain` gives them
  (`orderRowsByDomain`, the tree sidebar's own rule), each on its `row`
  under a row layout and all on row 0 in a shared panel.
- `domain`, `scaleType` and `symlogConstant` are the axis `scales.y`
  resolves to, and `rules` the reference lines it draws.
- `ramps` holds the score's color bar where one ramp paints every row
  (`scoreRampApplies`, the display's own rule): density, or a declared
  gradient outside the line renderings.

A source paints the color the display gives it, through the tree sidebar's
own rules (`dealtValueColors`, `resolveRowColors`, `markColorOf`): its row
color where nothing else colors the marks, and in a shared panel the
tableau10 palette dealt by name, or `rowColor`'s pairs. The `display` config
fills its defaults from the track type's: a `MultiQuantitativeTrack`
(`trackType`, inferred from a `MultiWiggleAdapter`) defaults to a row per
source and no min-max extent.

`@jbrowse/plugin-variants/tables` (`variantTables`) does the same for a
multi-sample VCF. It takes the `LinearMultiSampleVariantDisplay`'s config,
runs the display's worker (`executeVariantCellData`) at genomic positions,
and paints the cells as the display does (`paintCellColors`,
`paintFeatureColors`):

- `variants`: each record the display's filters keep (MAF, missingness, the
  jexl `filter`), with its lane color.
- `cells`: each row's cell at a record, with its genotype, its alt dosage over
  the called alleles, and the fill `shade(hue, dosage)` paints. Under
  `referenceDrawingMode: 'skip'`, the default, a reference call has no cell.
- `rows`: one per sample, or under `unit: 'haplotype'` one per haplotype,
  named as the display names them, in file order.
- `legend` and `ramps`: the display's key, from `getVariantColorScales` over
  what the cells painted.

The table does not apply the display's density fade, which depends on zoom,
and does not order the rows by the `rows` arrangement. A categorical `color`
deals its values into slots the browser keeps per session; the table deals
afresh on every call, so one value can take two colors across two calls.

## In grammar-of-graphics terms

A host draws the tables with its own grammar, so a table hands it the parts
of the display's that it can't rebuild:

- **Data:** each table is one mark kind, a row per mark. Beside the marks'
  geometry it carries the semantic columns a host may map instead (`mapq`,
  `strand`, `score`, `genotype`, `dosage`, `type`), and `section`, the
  display's facet.
- **Scale output:** each mark's `color` is what the display's `color` object
  resolves to. The display's scale has already run, so a host draws the
  column through an identity scale (ggjbrowse classes it `jbrowse_color`,
  whose `scale_type` is identity).
- **Guides:** `legend` and the other keys are that scale's guide, a label
  per color. `ramps` are its color bars (`rampKeyOf`): the stops the display
  samples, as `offset`, `color` and `opacity`, and the end labels its bar
  prints.
- **Stats left to the host:** the derived geometry (a read split at its
  skips, an arc's points) is the host's, computed from the table's own
  columns. A stat the display runs on the main thread (layout, autoscale,
  the arc pass, label placement) comes back as columns, since a host
  re-running it is the drift these tables exist to remove.

A new table follows the same split: geometry and semantic columns as data,
the display's resolved colors as one column, its key as a guide.

The field names are an external contract once ggjbrowse reads them: renaming
one breaks a downstream repo with no compiler between them, which is what the
downstream canary is for.

## The bare-host bundle

`pnpm build:bundle` writes `dist/jbrowse-tables.js`, one IIFE with no imports.
`src/bareHost.ts` installs what the readers need of `fetch`, `TextDecoder`,
`URL`, `Headers`, `AbortController`, `Intl` and the timers, and answers every byte
range through the host's synchronous `jbrowseHost.readRange(url, start, end)`.

- **A timer with a delay never fires.** There is no event loop; the only
  delayed timers on this path are deadlines guarding a request that has
  already answered.
- **`fetch` is replaced even where the host has one**, so Node or Deno still
  reads every byte through `readRange`; the other globals are installed only
  where missing. A range starting past the end of a file answers 416, as a
  server does: a 206 naming an end before its start is refused by the range
  cache.
- **`TextDecoder` follows the WHATWG UTF-8 decoder**, U+FFFD and `fatal`
  included, and `bareHost.test.ts` holds it to Node's on random bytes. A
  decoder that threw on a byte past 0xF7, or swallowed the newline after a
  Latin-1 byte, read a text header wrong.
- **`sideEffects` names `hostGlobals.*` and `bundle.*`.** With `false`,
  esbuild drops the side-effect import that installs the globals, and core's
  `featureTable.ts` reads `TextDecoder` at load.
- **R's V8 is built without ICU, so it has no `Intl`.** The shim's segmenter
  splits code points rather than graphemes, which only changes where a label
  truncates on a combining sequence or an emoji join. Node's `vm` context
  keeps `Intl`, so the bundle test deletes it.
- **The test that matters runs the bundle in an empty `node:vm` context**,
  which has no web globals, as V8 in R has none (`bundle.test.ts`). A shim
  removed turns it red.
- **The output is printable ASCII, newline and tab, and ES2020.** A host reads
  the bundle as a text file, and the CRAM reader inlines its htscodecs wasm as
  a binary string: the raw control bytes in it broke R's Windows check, so the
  build escapes every other byte, and `bundle.test.ts` holds both.

## Hooks: who notices a break

Downstream repos build against a jbrowse-components checkout beside them and
commit what they build, so a change here fires no event there.

- **Each downstream repo keeps its checks in one script of its own**,
  `check-against-jbrowse.sh` under its `scripts/` (ggjbrowse, JBrowseR,
  jbrowse-anywidget), which its own CI runs too.
- **`.github/workflows/downstream-canary.yml`** runs each of those scripts
  against this commit, nightly and on a `v*` tag, with this checkout and the
  downstream repo side by side under the workspace. A red run names the repo
  this commit broke. It goes red for any repo whose main lacks the script,
  and for ggjbrowse until that repo exists on GitHub.
- **ggjbrowse takes each `@jbrowse/tables` release from npm** into its
  committed bundle once R CMD check passes (its Bundle workflow), so nothing
  here has to tell it a release happened.
- ggbandage and ggtubemap follow bandage-core and tubemap-core, not this repo;
  their upstreams are where the same canary would go.
