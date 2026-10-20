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

> A table is the region's records in tidy form: every per-record field the
> file states is a column, every per-base field the display decodes is its
> own long table, and the display's decisions (row, color, section, fade)
> ride along as extra columns. JBrowse chooses what it adds, never which of
> the file's fields a host sees, and a host never re-parses a string the
> engine already parsed.

What follows from it:

- **No projection argument.** A table never takes a list of fields. CIGAR,
  `seq`, `qual`, MD, MM and ML stay out, since they are per-base and the
  engine decodes them into `gaps`, `mismatches`, `modifications` and
  `qualities`.
- **BAM and CRAM tags are the one exception, for now.** They arrive when
  binary transport makes them free, or when someone asks for one.
- **A GFF has no header**, so its attribute columns are the keys the
  region's records use; a host binding regions fills a missing column with
  NA, as it does for INFO.
- **A whole file is the same table with no region:** `fileRegions` lists the
  regions, `byteLimit` and alignments' `spanLimit` still apply, and
  `rowLimit` refuses a read whose largest table passes it.
- **`fileRegions` gives each contig's length and whether it holds data.**
  `end` is the length the assembly (when the call names one), the `@SQ`
  `LN`, the BigWig or BigBed chrom table or a VCF's `##contig` line states
  (a multi-wiggle's longest over its BigWigs), else 2^31-1, and
  `lengthKnown` says which. `hasData` is true where a CRAI
  or a BAI/CSI count shows reads, or where a tabix index or the parsed
  records name the contig; false where a CRAI shows none; null where the
  index cannot tell (a BAI counts 0 for an empty contig and an unindexed
  one alike, and a chrom table lists empty contigs). No contig is dropped.
- **A host flattens a name collision with a prefix:** ggjbrowse writes
  `info_type` and `attr_type`.
- **VEP's `CSQ` and SnpEff's `ANN` parse into `annotations`**, and their
  raw strings leave `info`.

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
size, since a host holds the whole table in memory. A region spanning over
`spanLimit` (10 Mb by default) is refused before anything is fetched: the
coverage band holds every base of the span, so a sparse file read across a
whole contig needs memory its compressed size doesn't show. A read's `id` is the
record's own `feature.id()`, built from the worker's read keys, the same in
every call; `read` indexes `reads` within one call, and a read's `name` is
shared by its mates and supplementary segments. The coverage band's tables
stop at the region's ends: the worker counts depth wherever its reads reach,
which past the region is a partial count. A band or mark the display's
`show` members hide (`coverage.show`, `pileup.show`, `pileup.showMismatches`,
`coverage.showInterbaseIndicators`, `sashimi.show`) comes back as empty
tables. `pileup.showMismatches: false` empties `mismatches` and `insertions`
and drops the deletions from `gaps`, as the display's marks do; the skips
and `clips` stay.
`@jbrowse/tables` composes them (`createTablesEngine`) and adds
`missingContig` to each table: where the region's contig is not one the file
lists, the tables come back empty, as the browser draws such a track, and
`missingContig` says so and names the file's contigs, so a host can tell a
typo from a quiet region. A BED or GFF lists only contigs holding records, so
for those a contig of the call's sequence counts as the file's. `alignmentTables` also returns `settings`, the
four band objects resolved (`coverage`, `pileup`, `sashimi`,
`readConnections`), which decide which bands a host stacks, so the host
composes from the config rather than restating its defaults. The engine also serves the colors a
host should draw in (`alignmentColors`), read off the palette rather than
copied.

**Every table returns `config` and every alignments mark its color.**

- `config` is the display's whole resolved config, every slot under
  JBrowse's own name, defaults included (`fullConfSnapshot`), from
  `alignments`, `features`, `wiggle` and `variants` alike. `multiway`
  returns its display's the same way; `synteny` and `dotplot`, whose
  settings live on a view rather than a config schema, return the view's
  settings with the view's defaults, `color` and `opacity` as config
  objects.
- `alignmentTables` adds a `color` column, off the palette, to
  `mismatches`, `gaps`, `insertions`, `clips`, `coverage`, `alleleCoverage`,
  `interbaseCoverage`, `indicators` and `junctions`. It resolves a base
  through `effectiveBaseColors`, so under a `modifications` or `bisulfite`
  layer every base is the muted grey.
- `baseLegend` (empty while the bases are muted), `junctionLegend` (the
  sashimi band's own strand key, over the junctions shown) and
  `interbaseLegend` come back as `legend` does, each with its title, keying
  only what the tables paint.
- `junctions` has `shown`, true where the junction passes `filter.junctions`
  (the browser counts a junction whose motif it never read as canonical), `arcHeight`
  (`sashimiArcHeightFraction`) and `strokeWidth` (`sashimiStrokeWidth`, in
  px). `alleleCoverage` has `shown`, true where the allele's share of the
  depth reaches `coverage.minAlleleFraction`, the coverageSnp shader's
  test.
- `readPitch` gives the read height (`pileup.readHeight`) and the gap below a read
  (`featureSpacingForHeight`). Under `heightMode: 'fit'` the browser
  squeezes the pitch to the track's height, which is the host's.
- Under `unit: 'chain'`, `chains` holds each chain's line and `overlaps` the
  spans where two of its reads both align. The display draws no overlap
  below a 3 px read (`shouldDrawOverlaps`), so there `overlaps` comes back
  empty. Where the tables return an overlap, `legend` ends with the
  display's row for it, "Pair/chain reads overlap here".
- The tables lay each facet section out as a stack and ignore
  `collapseSections`, so they return none of the overlap tint the display
  draws over a collapsed section. Where a faceted config sets it, `warnings`
  holds a line saying so.

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
carry it.

**Or it passes the assembly, and the engine renames.** Each region table
(`alignments`, `features`, `wiggle`, `variants`) and `sequence` take
`assembly`, an assembly config as a config's `assemblies` entry writes it,
shorthand included (`{ name, uri, refNameAliases: { uri } }`):

- `@jbrowse/tables` (`src/assembly.ts`) expands it with core's own
  `expandAssemblyShorthand` and `expandSidecarShorthand`, reads the alias
  file, and maps every alias to its canonical name with `buildRefNameMaps`,
  once per assembly.
- It then renames each region as `renameRegionsIfNeeded` does: `refName` to
  the name the file's `getRefNames()` lists for that contig, and
  `originalRefName`, unless given, to the sequence file's.
- The assembly's sequence stands in for `sequenceAdapter` where the call
  names none, so a CRAM decodes against it.
- Each table returns `readAs` (`refName`, `originalRefName`, one per region),
  the names it read under. A host labels the rows with the name it asked for.
- `regions` lists the assembly's contigs as its sequence file names them.
- A host matching a contig name to a file's goes through `canonical`:
  `fileRegions` and `regions` give each contig's canonical name in
  `canonical` (`refName` itself under no assembly), and
  `canonicalNames({ assembly, refNames })` returns `{ refName, canonical }`
  for names a user typed, through the alias file and in any case, an
  unknown name as given. `refNames` may be one string, as R's `auto_unbox`
  sends a single name. ggjbrowse finds a bare contig name (`12` for a file
  spelling it `chr12`) this way, as the engine renames a locus.

Only the requested regions are renamed: a mate's or SA tag's contig keeps the
file's spelling, as `REFNAME_NAMESPACES.md` describes for the browser.

A setting the table cannot serve is refused with an error:

- A facet that hides every section holding reads is refused, so an empty
  table always means an empty region.
- With no assembly, coloring by the mate's contig takes each contig's name
  hash, where the browser takes the assembly's own contig order.

**Several regions read as one view.** `alignmentTables` and
`variantTables` take `regions`, as the feature and wiggle tables do, and read
`region` as `regions: [region]`:

- Every index and key column (`region`, `read`, `variant`, `key`, `row`) is
  a 0-based int32. A call with one region names region 0 in every row.
- A read crossing regions is listed in each, under one `key` and on one
  `row`, from the display's multi-region layout (`buildLaidOutPileupMap`).
  A per-read table's `read` points at that region's copy.
- The engine clips each coverage table to its region, and `coverageScale`
  pools every region into one depth axis.
- `sections` is the union over the regions, in stacking order.
- `junctions` merge once over the regions (`mergeJunctions`), with
  `refName`, and `startRegion` and `endRegion` naming the region holding
  each foot, -1 where none does.
- An arc is listed once, under the region holding its near foot, with
  `startRegion` and `endRegion`. A tick or a chain's line is listed in each
  region whose reads give it.
- `variants` lists a record once per region it falls in, under one `key`,
  and `cells.variant` indexes the joined table. `rows` and `bands` are one
  set for every region.
- `spanLimit` and `byteLimit` apply to the regions' sum.
- `warnings` names each setting the layout drops without an error, such as
  a column sort with no `pos`, a sort across contigs or held by no region
  with reads, a sort or `pileup.showSoftClipping` under `unit: 'chain'`,
  and `collapseSections` on a faceted display.

Beside the reads come the marks the display draws on them, each as the
worker ships it: `insertions` (position, length, sequence, read), `clips`
(position, length, `soft` or `hard`, read) and `junctions`, the skips merged
as the sashimi band merges them (start, end, supporting-read count, strand off
the reads' tags or the splice motif, and the motif where the region's sequence
covers both ends), every junction down to a single read, with `shown`
marking the ones the display's `filter.junctions` keeps. `alignmentColors` names the
insertion, soft-clip and hard-clip colors beside the rest. A mismatch, gap,
insertion or clip carries `fade`, the worker's own frequency byte: its share
of the depth at its site, zeroed below the display's depth-dependent
threshold, which is what the pileup fades a sub-pixel mark by (the shaders'
`frequencyAlpha`: `width + fade * (1 - width)` for a mark under a pixel
wide), so a host can fade sequencing errors as the display does without
porting the threshold. `alignmentMarkAlpha` finishes the fade at the host's
px per bp (below). The display's `baseColor` and `modifications`
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
share of the local depth, and the most common `type` there). The display
draws neither while `settings.showInterbaseIndicators` is false.

**`alignmentMarkAlpha` draws a mark as the pileup does at a host's zoom.**
A host's px per bp depends on its figure, so the host calls it once per
figure with the marks' columns, and the engine runs the shaders' generated
twins:

- **In:** `pxPerBp`, a finite number of at least 0, and any of
  `insertions` (`length`, `fade`), `deletions` (`length` in bp, `end - start`
  of a gap whose `type` is `deletion`, and `fade`), `mismatches` (`fade`,
  `quality`, the Phred score, 255 where the read has none) and `clips`
  (`fade`).
- **Settings:** `featureHeight` (`readPitch.featureHeight`),
  `fadeLowFrequency` and `fadeLowBaseQuality` (`config.pileup`'s). Each one
  left out takes the pileup config's default: a 7 px read, `true` and
  `false`.
- **Columns:** a column may be a number, read as one mark, as R's jsonlite
  unboxes a one-row table. The call refuses a missing column, naming it,
  and a table whose columns differ in length. `mismatches.quality` may be
  left out while `fadeLowBaseQuality` is false.
- **Out:** `insertions.widthPx` and `insertions.alpha`, and `alpha` for
  `deletions`, `mismatches` and `clips`, one per mark in the order given.
  `widthPx` is in px; `alpha` runs from 0 (not drawn) to 1.
- An insertion is `insertionBarWidthPx` wide, and its alpha is
  `insertionSizeAlpha` times, for one shorter than
  `LONG_INSERTION_MIN_LENGTH` (10 bp), `frequencyFadeGate` over `pxPerBp`
  squared.
- A deletion's alpha is `sizeAlpha` of its width in px times
  `frequencyFadeGate` over that width squared.
- A mismatch's alpha is `qualityFade` times `frequencyFadeGate` over
  `pxPerBp`, and a clip's is that gate alone.

The bundle serves it as `jbrowse.alignmentMarkAlpha`, beside
`variantDensityAlpha`.

`coverageScale` is the band's depth axis as the display autoscales it:
`domain` over every shown section's visible depths under `scales.y` (quantile,
rules, bounds, nice rounding, a log scale floored at one read), its `type`,
the `symlogConstant` it resolves from that domain, and the `ticks` the display
labels at `coverage.height`. Every section shares it.
`glyph` gives the px the band draws in: the triangle's width and height,
`coverageInset` (the label room the band keeps at both ends, inside which the
depth axis runs) and `interbaseTop` (where the histogram starts below the
band's top, at the triangle's tip). A stack of N reads hangs N / `domain[1]` of
half the depth area, in px, whatever the axis type. The display's
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
  labelled `''`, as there is for a faceted region with no reads.
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
- `arcLegend` and `arcLegendTitle` are the band's key. Every member of
  `readConnections` acts as it does in the display.

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
- A gene's marks (`rects`, `lines`, `chevrons`, `arrows`, `aminoAcids`) name
  the transcript they draw in `subfeature`, an index into `subfeatures`, -1
  for a feature's own mark. The worker stamps each child's primitives with
  the child's ordinal, which `featureTables` matches to the child's entry.
- `attributes` and `subfeatureAttributes`, the fields the file states for
  each feature and transcript, a column per key aligned to them, and
  `attributeFields`, each key's `type`, `number` and `description`
  (`featureAttributeTables`). A GFF3's column-9 keys come as the file writes
  them (`Gff3Feature.fileAttributes`), so `ID` and `Name` sit beside the
  table's own `id` and `name` rather than lowercased onto them, each a
  `String`, a list where the spec lets the key list several or a record
  does. A BED or BigBed takes its autoSql's types (`getAutoSqlFields`). Keys
  JBrowse gives a feature or decodes into its glyph (`start`, `blockSizes`)
  stay out.
- `legend` and `legendTitle`, the color field's key (`featureColorKey`, the
  display's own), and `ramps`, a ramp's color bar.
- `sections`, under the display's `facet`: each section's `key`, `label`,
  and `top` and `height` in px, its chip row included, in stacking order.
  Each feature names its section's `label`, and a section `facet.hidden`
  lists leaves every table. Ungrouped, one section labelled `''` spans the
  track.

`@jbrowse/tables` installs the BED, GFF3 and GTF plugins, which register
adapters and nothing else, and registers `FromConfigAdapter`
(`@jbrowse/plugin-config/adapters`), so a track that writes its features
inline in its config reads as a file does.

**A VCF read as features is the plain variant display's table.** A
`VariantTrack` draws its records with `LinearVariantDisplay`, whose config is
the feature display's, and that display draws every record. The genotype
matrix (`variantTables`) drops a site with no called allele
(`passesSiteThresholds`), so a calls VCF whose FORMAT has no GT, such as a
somatic SV caller's, has no row in it. For a VCF adapter the engine's
`features` adds `vcf`, which `variantRecordTables` fills, aligned to
`features`:

- `records`: `ref`, `alt` and `filter`.
- `info` and `infoFields`, as `variantTables` gives them.
- `annotations` and `annotationFields`, as `variantTables` gives them,
  keyed by `feature`.
- `samples` (`feature`, `sample`, a row per record and sample), with
  `format`, a column per FORMAT key typed by the INFO rules, and
  `formatFields`.

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
  color, as the display fills it. Under a gradient, a heatmap's unset pair
  included, the color is the shared ramp's (`makeDensityLutFillFn`) over the
  resolved domain.
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
  jexl `filter`, and at least one called allele, so a VCF with no GT keeps
  none), with its lane color and its `filter`, the FILTER column
  as the file writes it (`PASS`, or the failed filters joined by `;`), null
  for `.`.
- `info`: each INFO key's values, a column per key aligned to `variants`,
  and `infoFields`, each key's `number`, `type` and `description` off its
  header line. See the INFO shape below.
- `cells`: each row's cell at a record, with its genotype, its alt dosage over
  the called alleles, and the fill `shade(hue, dosage)` paints. Under
  `referenceDrawingMode: 'skip'`, the default, a reference call has no cell.
- `rows`: one per sample, or under `unit: 'haplotype'` one per haplotype,
  named as the display names them, in file order.
- `legend` and `ramps`: the display's key, from `getVariantColorScales` over
  what the cells painted.

**INFO comes back as typed columns, one per key.** A host compares a
record's `AC` with its own genotype counts, so the value sits beside the
record. A long table (variant, key, value) would mix integers, floats,
strings and flags in one text column.

- **The header decides each column's shape, never the data.** A flag
  (`Type=Flag` or `Number=0`) is a boolean, false where the record lacks it.
  A `Number=1` key is its value. Any other `Number` (`A`, `R`, `G`, `.`, 2)
  is an array per record, an entry per value with null for `.`, even where
  every record in the region has one alt. A region of biallelic sites then
  types `AC` as a region with a multiallelic site does.
- **A record lacking a key, or giving `.`, has null.** R reads it as `NA`.
- **The keys are the header's, in its order**, so every region of a file
  returns the same columns, then any key a record uses undeclared. An
  undeclared key takes the type the VCF spec reserves for it, else reads as
  a flag where every use is bare and as a `Number=.` string otherwise.
- **`info` sits beside `variants` as an object of its own**, so an INFO key
  never shadows `start`, `type` or `color`. A host that flattens the two
  names a collision its own way: ggjbrowse prefixes the INFO column
  `info_`.
- **A consequence key parses into `annotations`** where its header line
  names its fields (VEP's `Format: Allele|Consequence|...`, SnpEff's
  `'Allele | Annotation | ...'`): a row per record and consequence,
  `variant` naming the record, `key` the INFO key, then a column per field
  in the header's order, each text, as the header types none, and null
  where empty. `annotationFields` lists each key's fields, and the key
  leaves `info` (`consequenceTables`).

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
  column as it is (ggjbrowse paints it as `I(color)`, which trains no
  scale).
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
`jbrowse.<table>(argsJson)` resolves to JSON and leaves the tables' numbers
in `jbrowseBytes`, a Uint8Array, until the next call (`src/wire.ts`):

- **Numbers cross as bytes.** A column crosses as `$i32` where JSON would
  read as integers in R, else `$f64`, booleans as `$lgl`, each null as R's
  NA, so a column keeps the type it had over JSON alone.
- **Text that repeats crosses as codes** (`$dict`), each row an index into
  `levels`; text that seldom repeats stays a JSON array.
- **A nested column crosses as `$list`**, its rows' lengths and values each
  a column of their own, so no host guesses a matrix from rows that share a
  length.
- R's V8 hands a Uint8Array back as a raw vector: 8 MB in about 3 ms, where
  jsonlite parses numbers at 50-70 ms a MB.
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

### What the engine keeps between calls

A browser worker frees an adapter when its track closes. A host has no tracks,
so `src/cache.ts` trims after every call, one state for every engine in the
process, in three pools that share no space, each under one setting, `limit`
(`DEFAULT_CACHE_LIMIT`, 256 MiB):

- **Decoded records:** the decoded-bytes budget (`cacheBudgets.ts`) gets all
  of `limit`, where a browser worker allows 1 GiB.
- **Chunks:** `setCacheLimit(limit)` (`@gmod/range-cache-filehandle` 2.0)
  bounds the bytes the range cache holds and evicts the least recently used, in
  pieces of at most 1 MiB, at once when `limit` drops. `chunks` reports its
  `cachedBytes()`.
- **Adapters:** `keepAdapters` keeps the adapters the last call used, whatever
  they weigh, then walks the others from the most recently requested, keeping
  each whose weight still fits under `limit` beside those kept. `setLimit`
  keeps the last call's too.
- **An adapter's weight** is at least `MIN_ADAPTER_BYTES`, or each file its
  config names that `readRange` read whole, at its uncompressed size (summed
  BGZF block sizes, or a gzip's last member size), times
  `INDEX_HOLDS_PER_BYTE` (4) for a `.bai`, `.csi`, `.crai` or `.tbi` and
  `PARSED_HOLDS_PER_BYTE` (10) for any other file. `parsed` reports the sum.
- **Assemblies:** the `RESOLVED_ASSEMBLIES` (16) most recently read.
- **`jbrowse.cache({ limit })`** sets `limit` and reports what is held;
  **`jbrowse.clearCache()`** empties every cache in place.
- **Every tables lookup passes the sequence adapter** through `tablesAdapter`
  or `tablesFeatureAdapter` (`@jbrowse/core/data_adapters/getFeatureAdapter`),
  which lint enforces in `packages/tables` and each plugin's `tables.ts`: core
  keys a BAM, SAM or CRAM on it, so a lookup without it builds a second
  instance that reads the index again.
- **R's V8 stops at a heap of about 1.4 GB**, which whole-file adapters reach
  first, since a 24 MB plain VCF parses to about 220 MiB. Whole files weigh
  their uncompressed size for that reason.

What an adapter holds per uncompressed byte of a file it read whole, measured
with Node's heap and ArrayBuffer totals after a warm-up parse, so the
inflater's wasm memory is not counted (indexes with five contigs read, the
most the libraries' `memoizeByRefId` keeps decoded):

| File | Uncompressed | Held | Per byte |
| --- | --- | --- | --- |
| BAI | 8.3, 2.6 MiB | 35.0, 9.3 MiB | 4.2x, 3.6x |
| CRAI | 1.1 MiB | 4.7 MiB | 4.3x |
| TBI | 4.9, 2.3, 2.1 MiB | 18.9, 6.9, 4.0 MiB | 3.9x, 3.0x, 1.9x |
| TBI of the HPRC v2.1 graph's links | 605.5 MiB | 605.7 MiB | 1.0x |
| CSI | 6.4, 6.4 MiB | 8.0, 8.0 MiB | 1.2x |
| VCF parsed whole, plain or gzipped | 23.3 MiB | 218 MiB | 9.4x |
| GFF3 parsed whole | 20.2 MiB | 41 MiB | 2.0x |

- **The variance follows the file's content.**
- **The estimate overcounts:** an index read on one contig holds about half,
  and a GFF3 a fifth. An index under about 1 MiB uncompressed holds more than
  four times its size, which the 1 MiB floor covers.

The rows below come from the bundle in Node's `vm`, or from R where noted. Read is
the bytes the host read on each pass, `chunks` is what `cache()` reports, Wasm
is the largest ArrayBuffer backing store after `clearCache()` (the inflater's
wasm memory), and Held is heap plus ArrayBuffers after a full GC in Node, or
RSS in R:

| Workload | `limit` | Read | `chunks` | Wasm | Held |
| --- | --- | --- | --- | --- | --- |
| 20 x 100 kb of a 100x BAM, twice | 256 MiB | 75.9 + 0 MiB | 75.9 MiB | 9.6 MiB | 543 MiB |
| 20 x 100 kb of a 100x BAM, twice | 64 MiB | 75.9 + 75.9 MiB | 63.9 MiB | 9.6 MiB | |
| 12 x 20 kb of 200x long reads, twice | 64 MiB | 52.4 + 0 MiB | 52.4 MiB | 9.3 MiB | 157 MiB |
| One 100 kb region, ten displays | 256 MiB | 5.5 MiB | 5.5 MiB | 9.6 MiB | 81 MiB |
| 20 kb of 1000x long reads | 64 MiB | 169.8 MiB | 64.0 MiB | 9.3 MiB | 165 MiB |
| The HPRC v2.1 segs TBI, read whole | 256 MiB | 4.2 MiB | | 9.1 MiB | 717 MiB RSS |
| 30 remote BAMs, an 8.3 MiB BAI each | 256 MiB | 269.0 MiB | | | 135 MiB, 7 adapters |
| cancer_sv tutorial, from R | 256 MiB | 73.7 MiB, 16.5 s | | | 757 MiB RSS |
| 12 remote ONT regions of 100 kb, twice, from R | 256 MiB | 168.5 + 0 MiB, 28.5 s | 127.2 MiB | | 953 MiB peak |
| 12 distinct gzipped 24 MB VCFs | 256 MiB | | | | 238 MiB, 1 adapter |
| 120 distinct gzipped 20 MB GFF3s | 256 MiB | | | | 61 MiB, 1 adapter |
| 16 distinct 24 MB plain VCFs, from R | 256 MiB | | | | 730-980 MiB RSS |
| 6 distinct 70 MB plain VCFs, from R | 256 MiB | | | | 1175 MiB RSS |

- **The engine holds up to a full `limit` each of chunks and records between
  calls.**
- **A call's own working memory comes on top.** One 1 Mb read of a local 100x
  BAM takes R to 2.2 GB at the default, and peaks at 1832-1865 MiB RSS in Node,
  holding 780-786 MiB after `clearCache()`.
- **The inflater's wasm memory stays near 20 MiB.** A `WebAssembly.Memory`
  only grows, so `@gmod/bgzf-filehandle` caps each inflate at 8 MiB and puts
  the runs of one chunk in one buffer.
- **A working set wider than `limit` reads again.** At 64 MiB the second pass
  over 75.9 MiB of chunks misses on every one, since the least recently used
  chunk is always the next one read.
- **One call can fetch bytes again inside itself.** A CRAM window of 20 kb
  over 1000x long reads makes 73 range requests for 84.2 MiB at a `limit` of
  64 MiB or 16 MiB, and 76 for 90.7 MiB at 0: chunks past `limit` leave the
  cache while the call still reads them.
- **`limit = Inf` leaves the range cache unbounded.** Only its 15-minute idle
  sweep frees bytes, and that sweep needs a timer a bare host lacks.
- **Whole-file loops from R level off:** 16 distinct 24 MB plain VCFs hold 757
  MB RSS, and 6 distinct 70 MB ones 1147 MB.
- **The engine still estimates what a parsed index holds.**
  [ideas/waiting-on-someone-else/compact-parsed-indexes-in-bam-js-and-tabix-js.md](../ideas/waiting-on-someone-else/compact-parsed-indexes-in-bam-js-and-tabix-js.md)
  lists what would replace it.

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
