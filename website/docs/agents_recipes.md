---
title: Recipes for driving JBrowse from an agent
sidebar_label: Recipes
description:
  Worked snippets against the live session, each run against the app before it
  was written down. Finding tracks, opening a hosted genome at a gene,
  tabulating and joining what is on screen, derived tracks, restyling, a figure
  per locus, and adding a remote file
---

- Each recipe is a `run_javascript` body for JBrowse Desktop over MCP.
- In JBrowse Web the same code runs in the page, where the value is the last
  expression rather than a `return`, so wrap a body in
  `(async () => { ... })()`.
- Every snippet runs against the `volvox` test config or the hosted hg38 config
  in the Desktop conformance suite, and the values quoted are what came back.
- Inside the app the same page is `docs topic:"recipes"`, one section at a time.

## Find the tracks you can use

`jb.listTracks` answers `{ total, tracks }`, not an array. A row carries
`trackId`, `name`, `type` and `assemblyNames`, so a config with several
assemblies is filtered in code:

```js
const { total, tracks } = jb.listTracks('vcf')
return {
  total,
  onVolvox: tracks
    .filter(t => t.assemblyNames.includes('volvox'))
    .map(t => `${t.trackId} (${t.type})`),
}
```

The search matches `trackId` and `name`, case-insensitively. Connection and hub
tracks are included, which is why this and not `session.tracks` is the catalog.

## Open a hosted genome at a gene

- With nothing open, Desktop's `open` tool takes the hosted config URL directly,
  `https://jbrowse.org/ucsc/hg38/config.json`; JBrowse Web takes it as
  `?config=`. [](/docs/agents_hosted_data) has the URL for every UCSC database
  and GenArk accession.
- Then a spec builds the view. A `loc` that is a gene name goes through the
  config's text index.
- Because the spec names its tracks, the track the hit was found in is not added
  on top of them.

```js
return jb.loadSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'BRCA1',
      tracks: ['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'],
    },
  ],
})
```

The result is the settle report plus a session summary naming the view, its
visible region and each track's display and height. Here the report also says
that ClinVar is over its fetch-size gate at a whole-gene zoom:

```json
{
  "settled": true,
  "notReady": [
    {
      "trackId": "hg38-clinvarMain",
      "display": "LinearBasicDisplay",
      "height": 100,
      "phase": "tooLarge",
      "reason": "Requested too much data (8.52 Mb)"
    }
  ],
  "session": {
    "views": [{ "visibleRegion": "chr17:43,019,038..43,195,484", "...": "..." }]
  }
}
```

The ClinVar track draws once the view is zoomed in. A read over the same span is
refused the same way; the next recipe narrows the region to work around it.

## Tabulate what is on screen

Features come back as live objects, so count in code and return the counts. Over
the default region of `volvox`:

```js
const count = (feats, key) => {
  const out = {}
  for (const f of feats) {
    const k = String(f.get(key) ?? 'none')
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}
const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf' })
const genes = await jb.getFeatures({ trackId: 'gff3tabix_genes' })
return {
  variants: count(variants, 'type'),
  geneFeatures: count(genes, 'type'),
  strands: count(genes, 'strand'),
}
```

```json
{
  "variants": {
    "SNV": 106,
    "deletion": 1,
    "insertion": 1,
    "sequence_variant": 1
  },
  "geneFeatures": { "gene": 2, "mRNA": 2, "CDS": 1, "match": 76, "...": "..." },
  "strands": { "1": 79, "-1": 31, "0": 4 }
}
```

- `f.get('start')` is zero-based and `f.get('end')` exclusive.
- A VCF feature also answers `REF`, `ALT` (an array), `QUAL`, `FILTER`, `INFO`
  and `samples`; a GFF feature its column-nine attributes by name.
- `Object.keys(f.toJSON())` lists what one feature has, and is worth a look
  before filtering on `name`: the hosted RefSeq GFF names a gene by `ID` and
  `gene_id` with no `Name`, so `name` is `null` on every gene there and `id` is
  the symbol.

The same tabulate-in-code pattern works over ClinVar on the hosted hg38 config,
counting by clinical significance instead. The whole BRCA1 view is over the
read's byte gate, so `loc` narrows it to the gene's last exons:

```js
const feats = await jb.getFeatures({
  trackId: 'hg38-clinvarMain',
  loc: 'chr17:43,044,000-43,060,000',
})
const by = {}
for (const f of feats) {
  const k = f.get('clinSign') ?? 'unstated'
  by[k] = (by[k] ?? 0) + 1
}
return { n: feats.length, by }
```

Without `loc` the call throws `region too large for jb.getFeatures` naming the
estimate and the limit, rather than returning a short answer that looks whole.
Pass `byteLimit` alongside `trackId` for a read you mean to be that big.

## Which genes carry a variant

Two reads over the same region and a join in code. Overlap is the half-open
interval test, and the gene track is filtered to its top-level `gene` features
so exons are not counted again:

```js
const genes = await jb.getFeatures({ trackId: 'gff3tabix_genes' })
const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf' })
const overlaps = (a, b) =>
  a.get('start') < b.get('end') && a.get('end') > b.get('start')
return genes
  .filter(g => g.get('type') === 'gene')
  .map(g => ({
    gene: g.get('name') ?? g.get('id'),
    variants: variants.filter(v => overlaps(v, g)).length,
  }))
  .filter(h => h.variants > 0)
  .sort((a, b) => b.variants - a.variants)
```

## Find the highest value in a quantitative track and go there

A bigWig answers one feature per interval with a `score`. Reduce with a loop
rather than `Math.max(...scores)`, which overflows the call stack on a
base-resolution track, then navigate to what you found:

```js
const view = jb.view()
const feats = await jb.getFeatures({
  trackId: 'volvox_microarray',
  loc: 'ctgA:1-50,000',
})
let best
for (const f of feats) {
  if (!best || f.get('score') > best.get('score')) {
    best = f
  }
}
const peak = {
  refName: best.get('refName'),
  start: best.get('start'),
  end: best.get('end'),
  score: best.get('score'),
}
await view.navToLocString(
  `${peak.refName}:${peak.start - 2000}-${peak.end + 2000}`,
)
const settle = await jb.waitReady(30000)
return { scanned: feats.length, peak, now: view.visibleLocStrings, ...settle }
```

```json
{
  "scanned": 500,
  "peak": { "refName": "ctgA", "start": 24500, "end": 24600, "score": 899 },
  "now": "ctgA:22,500..26,600",
  "settled": true
}
```

## Reads by strand and mapping quality

An alignment feature answers `strand` as `1` or `-1`, `score` as the mapping
quality, and `flags`, `CIGAR`, `seq`, `qual`, `template_length` and `tags`
besides:

```js
const reads = await jb.getFeatures({ trackId: 'volvox_alignments' })
const byStrand = { forward: 0, reverse: 0 }
const mapq = {}
for (const r of reads) {
  byStrand[r.get('strand') === -1 ? 'reverse' : 'forward'] += 1
  const bin = Math.floor(r.get('score') / 10) * 10
  mapq[bin] = (mapq[bin] ?? 0) + 1
}
return { n: reads.length, byStrand, mapq }
```

A track need not be shown to be read: `jb.getFeatures` takes any `trackId` in
the catalog. Reading a shown one shares the parsed index the display already
loaded.

## Show a value you computed as a track

A `FromConfigAdapter` carries the features in the track config, so the derived
track saves and reopens with the session and needs no file. Variant density per
kilobase across the visible region:

```js
const [region] = await jb.visibleRegions()
const BIN = 1000
const variants = await jb.getFeatures({
  trackId: 'volvox_test_vcf',
  regions: [region],
})
const first = Math.floor(region.start / BIN) * BIN
const counts = new Array(Math.ceil((region.end - first) / BIN)).fill(0)
for (const v of variants) {
  const i = Math.floor((v.get('start') - first) / BIN)
  if (i >= 0 && i < counts.length) {
    counts[i] += 1
  }
}
const trackId = `variant-density-${Date.now()}`
session.addSessionTrackConf({
  type: 'QuantitativeTrack',
  trackId,
  name: 'variants per kb',
  assemblyNames: [region.assemblyName],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: trackId,
    features: counts.map((score, i) => ({
      uniqueId: `bin${i}`,
      refName: region.refName,
      start: first + i * BIN,
      end: first + (i + 1) * BIN,
      score,
    })),
  },
})
await jb.view().launchTrack(trackId)
return {
  trackId,
  bins: counts.length,
  max: Math.max(...counts),
  ...(await jb.waitReady(30000)),
}
```

- A fresh `trackId` and `adapterId` per computation is deliberate. Re-adding a
  known `trackId` with different content is refused, and the adapter cache is
  keyed on `adapterId`, so a recomputed track under the old ids keeps showing
  the first values it saw.
- Plan for a few thousand features and no more; above that, write a real file
  and load it with `jb.addTrack`.

## Plot a field of a track you already have

A `LinearMarkDisplay` is a grammar of graphics over any feature, alignments or
variant track: each mark names its `mark` type, the fields feeding its channels
and the transforms run before it. Reuse a catalog track's adapter under a new
session track whose display declares the plot, and the axis, legend and hover
follow. The display has one y axis, so each pair's insert size is its own track
beside the coverage rather than a second axis on this one:

```js
const source = session.getTrackById('volvox_alignments')
const trackId = `insert-size-${Date.now()}`
session.addSessionTrackConf({
  type: 'AlignmentsTrack',
  trackId,
  name: 'insert size per pair',
  assemblyNames: jb.readConfObject(source, 'assemblyNames'),
  adapter: jb.readConfObject(source, 'adapter'),
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: `${trackId}-LinearMarkDisplay`,
      marks: [
        {
          mark: 'point',
          transform: [
            { type: 'filter', expr: 'jexl:feature.template_length > 0' },
          ],
          encoding: {
            y: 'template_length',
            color: {
              field: 'score',
              scale: 'linear',
              domainMin: 0,
              domainMax: 60,
              range: ['#bdbdbd', '#1f4e9a'],
            },
          },
        },
      ],
    },
  ],
})
await jb.view().launchTrack(trackId)
return { trackId, ...(await jb.waitReady(30000)) }
```

A BED column plots the same way over a `FeatureTrack`, with `y` naming the
column, and `bin` plus `aggregate` steps count features per bin zoomed out. The
[mark display guide](/docs/config_guides/mark_display) lists every mark type,
channel and step.

## Restyle, and read back what landed

Settings keys come from the display's own schema. A key it does not declare is
not an error, so read the report:

```js
const track = jb.trackModel('gff3tabix_genes')
const slots = jb.describeSlots(track.activeDisplay.configuration)
const result = track.applyDisplaySettings({
  displayMode: 'compact',
  colour: 'red',
})
return {
  knows: Object.keys(slots),
  displayMode: slots.displayMode.description,
  result,
}
```

```json
{
  "knows": [
    "height",
    "color",
    "displayMode",
    "heightMode",
    "showLabels",
    "..."
  ],
  "result": {
    "applied": ["displayMode"],
    "unapplied": [{ "key": "colour", "reason": "no-slot" }],
    "failed": []
  }
}
```

- `unapplied` is the misspelling; `failed` is a key the display knows and could
  not set. A `reason` of `setter-only` is neither: the display takes that
  setting through a `set<Key>` action rather than a slot.
- Anything a slot does not cover is an action on the display itself, listed by
  `docs topic:"model:<modelType>" section:"Actions"` with the type name from
  `jb.inspect(track.activeDisplay).modelType`.

## Reorder tracks with an action `inspect` found

MST attaches actions as non-enumerable properties, so `Object.keys(view)` shows
none of them and `jb.inspect` is how to see what a view can do. The move actions
take a shown track's `trackId` or its model's own `id`:

```js
const view = jb.view()
view.moveTrackToTop('volvox_test_vcf')
return {
  moves: jb.inspect(view).actions.filter(a => a.startsWith('moveTrack')),
  order: view.tracks.map(t => t.configuration.trackId),
}
```

## Prove a track drew

A display that refuses to draw replaces its own subtree and raises no toast, so
a screenshot of it looks fine. The settle report is where it shows:

```js
await jb.view().launchTrack('volvox_bigwig_nonexist')
return jb.waitReady(20000)
```

```json
{
  "settled": true,
  "notReady": [
    {
      "trackId": "volvox_bigwig_nonexist",
      "display": "LinearWiggleDisplay",
      "height": 100,
      "phase": "error",
      "error": "Error: ENOENT: no such file or directory, open '.../volvox.bw.nonexist'"
    }
  ]
}
```

- A track over its fetch-size gate reports `phase: "tooLarge"` with the reason
  the display painted. Zoom in, or raise the display's `fetchSizeLimit` slot
  through `applyDisplaySettings` if the size is meant.
- For a track that settled clean, pair the empty `notReady` with a feature count
  over the visible region rather than looking for pixels: the canvases are
  offscreen and measure 0 by 0.

## A figure per locus

The loop lives in the client, one navigate-and-settle call per locus and a
cropped screenshot after each. The settle call returns the view's element box so
`rect` or `selector` can crop to it:

```js
const view = jb.view()
await view.navToLocString('ctgA:5,000-15,000')
const settle = await jb.waitReady(30000)
const el = document.querySelector(`[data-testid="view-container-${view.id}"]`)
return {
  loc: view.visibleLocStrings,
  rect: el.getBoundingClientRect().toJSON(),
  ...settle,
}
```

- Then `screenshot` with `selector: '[data-testid="view-container-<view.id>"]'`,
  and read `notReady` in its text part before trusting the image.
- On JBrowse Web the capture is the browser agent's own, taken after
  `jb.waitReady` resolves.

## A publication figure, at a path you choose

A screenshot is the window; `view.exportSvg` is the figure — vector, no browser
chrome, the same output the Export SVG dialog writes. `save: false` returns the
markup instead of handing it to the browser's download path, so it lands where
you say rather than in the download folder under a name you did not choose:

```js
const view = jb.view()
await jb.waitReady(30000)
const svg = await view.exportSvg({ save: false })
const fs = window.require('fs')
const path = window.require('path')
const os = window.require('os')
const out = path.join(os.tmpdir(), 'figure.svg')
fs.writeFileSync(out, svg)
return { out, bytes: svg.length, loc: view.visibleLocStrings }
```

- Every view type that exports takes the same call: linear, circular, dotplot,
  linear synteny, breakpoint split.
- `{ format: 'png' }` rasterizes on the way to the file, and is the one case
  where the return value is still the SVG markup rather than the bytes written.
- Leave `save` alone to get the normal download instead.
- `rasterizeLayers: true` embeds each display's heavy layer as a PNG instead of
  vector elements, useful for a hundred-thousand-read pileup.
- A track that failed to load makes the export fail rather than come out with a
  gap: `exportSvg` rejects with `Cannot export:` and the errors behind it. Read
  `notReady` from `jb.waitReady` first, and hide the offending track if the
  figure is meant without it.
- Only Desktop can write a file. In JBrowse Web, take the markup and put it
  somewhere the page can reach.

## Add a file by URL, and check it lines up

`jb.addTrack` infers the track and adapter type from the extension, adds the
track to the session and shows it in a view on the right assembly. A GEO bigWig
on the open hg38 session:

```js
const added = await jb.addTrack({
  location:
    'https://ftp.ncbi.nlm.nih.gov/geo/samples/GSM6703nnn/GSM6703858/suppl/GSM6703858_ATAC-DMSO-Human-1.bigwig',
  name: 'ATAC-seq, DMSO rep 1',
})
const values = await jb.getFeatures({ trackId: added.trackId })
return { ...added, valuesInView: values.length }
```

- The result names the `trackId` it chose, the inferred types, the view it was
  shown in and the settle report.
- A count of zero over a region that should have signal is the refName-mismatch
  trap: read `getRefNames()` off the adapter (the
  [live model guide](/docs/agents_live_model) shows how) and compare against the
  assembly's names.
- In JBrowse Web the location must be a URL the host serves with CORS headers; a
  local path is refused before anything is added. JBrowse Desktop takes an
  absolute path wherever it takes a URL.

## Align two genomes before comparing them

minimap2 picks its seeds and penalties from a preset, and the preset has to
match how far apart the genomes are: `asm5`, `asm10` and `asm20` suit about
0.1%, 1% and 5% divergence. How closely related two species sound is not a
measurement. Align the largest chromosome of each with `asm20` first and read
the divergence off the `de:f` tag. The two genomes may name that chromosome
differently, so pick it from each `.fai`:

```bash
zcat query.fa.gz | bgzip > q.fa.gz && samtools faidx q.fa.gz
zcat target.fa.gz | bgzip > t.fa.gz && samtools faidx t.fa.gz
samtools faidx q.fa.gz "$(sort -k2,2nr q.fa.gz.fai | head -1 | cut -f1)" > q1.fa
samtools faidx t.fa.gz "$(sort -k2,2nr t.fa.gz.fai | head -1 | cut -f1)" > t1.fa
minimap2 -cx asm20 t1.fa q1.fa |
  awk '{for(i=13;i<=NF;i++) if($i~/^de:f:/){split($i,t,":"); d+=t[3]*($4-$3)}; n+=$4-$3} END {print d/n}'
```

- D. simulans against D. mauritiana, sister species, reads 0.024 on their
  largest chromosome. `asm5` splits it into 6,805 records and leaves more of it
  unaligned; `asm20` gives 278.
- Whole genomes take minutes, past a tool call's budget, so run the aligner in
  the background and poll it.
- `jbrowse make-pif` indexes the PAF for a `PairwiseIndexedPAFAdapter`, and the
  query is minimap2's second argument.

## Two genomes and the alignment between them, in one spec

Build the comparison as one session spec rather than a chain of actions. The
spec names both assemblies, the alignment track and every view that shows it,
and `jb.loadSessionSpec` reports what did not draw. Two GenArk flies, with the
PIF from the recipe above, as a synteny view over a whole-genome dotplot:

```js
const hub = acc =>
  `https://jbrowse.org/hubs/genark/GCF/${acc.slice(4, 7)}/${acc.slice(7, 10)}/${acc.slice(10, 13)}/${acc}/config.json`
const [sim, mau] = await Promise.all(
  ['GCF_016746395.2', 'GCF_004382145.1'].map(async acc =>
    (await fetch(hub(acc))).json(),
  ),
)
const target = sim.assemblies[0].name
const query = mau.assemblies[0].name
return jb.loadSessionSpec({
  sessionAssemblies: [sim.assemblies[0], mau.assemblies[0]],
  sessionTracks: [
    {
      type: 'SyntenyTrack',
      trackId: 'sim_vs_mau',
      name: 'D. simulans vs D. mauritiana',
      assemblyNames: [query, target],
      adapter: {
        type: 'PairwiseIndexedPAFAdapter',
        uri: '/data/sim_vs_mau.pif.gz',
        queryAssembly: query,
        targetAssembly: target,
      },
    },
  ],
  views: [
    {
      type: 'LinearSyntenyView',
      views: [
        { assembly: target, loc: 'chr2R' },
        { assembly: query, loc: 'chr2R' },
      ],
      tracks: ['sim_vs_mau'],
    },
    {
      type: 'DotplotView',
      views: [{ assembly: target }, { assembly: query }],
      tracks: ['sim_vs_mau'],
    },
  ],
})
```

- The hosted configs carry each assembly's sequence and chromAlias file, so
  `chr2R` answers for the `NC_` names the FASTA used.
- `sessionTracks` takes each config's gene track too; leave out any trackId the
  open session already has, which the notifications name.
- Take the GenArk gene track as `<assembly>-ncbiGene`, a bigGenePred whose
  labels are gene symbols. `-ncbiGff` labels a gene with its locus tag wherever
  RefSeq has no symbol for it, and its `uri` is relative to the hub — lifted out
  of a fetched config it resolves against whatever config is open instead, and
  the track 404s.
- A gene track at whole-chromosome zoom reports `tooLarge` in `notReady`. Add it
  to a row once the view is on a region.

## The same data under another display

`track.compatibleDisplays` is the set the containing view can draw, and
`await track.launchDisplay(id)` swaps to one of them. Read the ids off the track
rather than naming a type: an id the track does not carry throws, and a display
TYPE passed to `showTrack` does not — it synthesizes a dangling id that resolves
back to the default, so the track redraws unchanged and the call reports
success.

```js
const track = jb.trackModel('volvox_test_vcf')
const ids = track.compatibleDisplays.map(d => d.displayId)
const drawn = track.activeDisplay.configuration.displayId
const next = ids.find(id => id !== drawn)
await track.launchDisplay(next)
return { ids, from: drawn, to: next, ...(await jb.waitReady(30000)) }
```

`launchDisplay`, not the `replaceDisplay` beneath it: a display type's state
model is a dynamic import until something shows it, and `replaceDisplay` is sync
and asserts it is loaded. This is `launchTrack` against `showTrack` one level
down.

Against volvox this answers with the three linear displays a `VariantTrack`
carries — `LinearVariantDisplay`, `LinearMultiSampleVariantDisplay`,
`LinearMultiSampleVariantMatrixDisplay`. Do not read `configuration.displays`
for this: it also holds the `ChordVariantDisplay` a circular view would draw,
and handing that id to a linear view's track is the one way to make
`replaceDisplay` fail.

**Read arcs, the read cloud and coverage are settings on the alignments
display.** An alignments track has one `LinearAlignmentsDisplay`, so arcs are
`track.applyDisplaySettings({ readConnections: 'arc' })`, and
`jb.describeSlots(track.activeDisplay.configuration)` lists the rest. A session
saved before v5 still loads, because `LinearPileupDisplay`,
`LinearSNPCoverageDisplay`, `LinearReadArcsDisplay` and `LinearReadCloudDisplay`
remain as aliases of it.

To show the same data twice at once, add the file a second time with
`jb.addTrack` under another name; a trackId is shown once per view.

## Adding a view beside the open one

`jb.loadSessionSpec` replaces the whole session. `jb.addView` takes one entry of
a spec's `views` array and opens it beside what is open, through the same
launcher a spec uses:

```js
const { viewId } = await jb.addView({
  type: 'LinearGenomeView',
  assembly: 'volvox',
  loc: 'ctgA:40,000-50,000',
  tracks: ['gff3tabix_genes'],
  displayName: 'second locus',
})
return {
  viewId,
  views: session.views.map(v => `${v.id}: ${v.displayName ?? v.type}`),
}
```

`jb.sessionSummary()` then lists both views with their ids, and every helper
that takes a `viewId` can be pointed at either. A key the view does not take
throws before anything opens, naming it.

## Edit the session as a document

What is open is one JSON document, and `jb.setSession` takes it back edited. A
view keeping its `id` is patched in place: `loc` on it navigates, a
`{ trackId }` entry in its `tracks` opens that track with any inline setting, a
track removed from the array is closed, and a display's own props are written as
they stand. Copy the snapshot first, since it is frozen:

```js
const doc = structuredClone(jb.mst.getSnapshot(session))
const [view] = doc.views
view.loc = 'ctgA:20,000-30,000'
view.tracks = view.tracks.filter(t => t.type !== 'VariantTrack')
view.tracks.push({ trackId: 'volvox_alignments', height: 150 })
return jb.setSession(doc)
```

- The answer is the settle plus `session`, the summary after the rewrite.
- Top-level keys the document leaves out keep their value, so `{ views }` is a
  whole instruction. Views the document does not list are closed.
- A document the model refuses throws naming the path and the value, and nothing
  is applied.
- Config slots (`displayMode`, `color`) live in the config, not the session's
  built track, so put the setting on a `{ trackId }` entry: it restyles a track
  already shown and opens one that is not.

## Fit everything in the window

The settle reports `offscreen` when the session is taller than the window.
`jb.fitToWindow` spends that overflow across every display, synteny band and
dotplot in proportion to the headroom each has above its floor:

```js
for (const t of jb.view().tracks) {
  t.applyDisplaySettings({ height: 600 })
}
return jb.fitToWindow()
```

It answers `fits`, the overflow before and after, each cut as
`{ what, from, to }`, and a note when every shrinkable thing is at its floor,
which is when hiding a track or a `fullPage` screenshot is the answer.

## Side by side

Views stack down the page until the session is arranged into panels.
`session.layoutViews` takes the same tree a session spec's `layout` does, with
view ids (or indexes into `session.views`) in its leaves, turns workspaces mode
on, and applies the order the leaves state. One panel per open view, left to
right:

```js
const seated = session.layoutViews({
  direction: 'horizontal',
  children: session.views.map(v => ({ views: [v.id] })),
})
return { seated, ...(await jb.waitReady(30000)) }
```

- A `size` on each child divides the space (`{ views: [id], size: 70 }`).
  `direction: "vertical"` stacks the panels; `"tabs"` puts the children in one
  cell as tabs; a leaf with several ids stacks those views in one tab.
- A leaf spelled with any other key throws naming it, and a layout that seats no
  view throws rather than leaving a blank tab.
- Calling `session.applyLayoutSpec` directly does neither of the two things
  `session.layoutViews` adds, and the views stay stacked with no error.

## See also

- [](/docs/agents)
- [](/docs/agents_live_model)
- [](/docs/agents_hosted_data)
