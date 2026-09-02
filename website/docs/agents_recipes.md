---
title: Recipes for driving JBrowse from an agent
sidebar_label: Recipes
description:
  Worked snippets against the live session, each run against the app before it
  was written down. Finding tracks, opening a hosted genome at a gene,
  tabulating and joining what is on screen, derived tracks, restyling, a figure
  per locus, and adding a remote file
---

Each recipe is a `run_javascript` body for JBrowse Desktop over
[MCP](/docs/agents_mcp). In JBrowse Web the same code runs in the page (see
[](/docs/agents_web)), where the value is the last expression rather than a
`return`, so wrap a body in `(async () => { ... })()` there. What differs
between the two is said where it matters.

Every snippet was run against the `volvox` test config or the hosted hg38 config
before it was written down, and the values quoted are what came back. Inside the
app the same page is `docs topic:"recipes"`, so an agent can read one section at
a time.

## Find the tracks you can use

`jb.listTracks` answers `{ total, tracks }`, not an array. Each entry carries
`trackId`, `name`, `type`, `adapterType` and `assemblyNames`, so a config with
several assemblies is filtered in code:

```js
const { total, tracks } = jb.listTracks('vcf')
return {
  total,
  onVolvox: tracks
    .filter(t => t.assemblyNames.includes('volvox'))
    .map(t => `${t.trackId} (${t.type} / ${t.adapterType})`),
}
```

The search matches `trackId` and `name`, case-insensitively. Connection and hub
tracks are included, which is why this and not `session.tracks` is the catalog.

## Open a hosted genome at a gene

With nothing open, Desktop's `open` tool takes the hosted config URL directly,
`https://jbrowse.org/ucsc/hg38/config.json`. JBrowse Web takes the same URL as
`?config=`. [](/docs/agents_hosted_data) has the URL for every UCSC database and
GenArk accession. Then a spec builds the view, and a `loc` that is a gene name
goes through the config's text index:

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
visible region and each track's display and height. A spec's own tracks win over
the track the gene search would otherwise add. Here the report also says that
ClinVar is over its fetch-size gate at a whole-gene zoom:

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

That track draws once the view is zoomed in, and a read over the same span is
refused the same way, which is what the next recipe narrows.

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

`f.get('start')` is zero-based and `f.get('end')` exclusive. A VCF feature also
answers `REF`, `ALT` (an array), `QUAL`, `FILTER`, `INFO` and `samples`; a GFF
feature its column-nine attributes by name. `Object.keys(f.toJSON())` lists what
one feature has, and is worth a look before filtering on `name`: the hosted
RefSeq GFF names a gene by `ID` and `gene_id` with no `Name`, so `name` is
`null` on every gene there and `id` is the symbol.

The same shape over ClinVar on the hosted hg38 config, where the field is the
clinical significance. The whole BRCA1 view is over the read's byte gate, so
`loc` narrows it to the gene's last exons:

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

## GC content of the visible sequence

The assembly's own sequence is a track like any other. Its `trackId` is on the
assembly config, and `jb.getFeatures` answers one feature per region carrying
the bases as `seq`:

```js
const [{ assemblyName, refName, start, end }] = await jb.visibleRegions()
const seqTrackId =
  session.assemblyManager.get(assemblyName).configuration.sequence.trackId
const [f] = await jb.getFeatures({ trackId: seqTrackId })
const seq = f.get('seq').toUpperCase()
let gc = 0
for (const base of seq) {
  if (base === 'G' || base === 'C') {
    gc += 1
  }
}
return {
  refName,
  start,
  end,
  length: seq.length,
  gc: +(gc / seq.length).toFixed(3),
}
```

Mind the size: this pulls every base on screen. The same read over a whole
chromosome is what the byte gate refuses.

## Find the highest value in a quantitative track and go there

A bigWig answers one feature per interval with a `score`. Reduce with a loop
rather than `Math.max(...scores)`, which overflows the call stack on a
base-resolution track, then navigate to what you found:

```js
const view = session.views[0]
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
session.views[0].showTrack(trackId)
return {
  trackId,
  bins: counts.length,
  max: Math.max(...counts),
  ...(await jb.waitReady(30000)),
}
```

A fresh `trackId` and `adapterId` per computation is deliberate. Re-adding a
known `trackId` with different content is refused, and the adapter cache is
keyed on `adapterId`, so a recomputed track under the old ids keeps showing the
first values it saw. Plan for a few thousand features and no more; above that,
write a real file and load it with `jb.addTrack`.

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
    "unapplied": ["colour"],
    "failed": []
  }
}
```

`unapplied` is the misspelling; `failed` is a key the display knows and could
not set. Anything a slot does not cover is an action on the display itself,
listed by `docs topic:"model:<modelType>" section:"Actions"` with the type name
from `jb.inspect('views.0.tracks.0.displays.0').modelType`.

## Reorder tracks with an action `inspect` found

MST attaches actions as non-enumerable properties, so `Object.keys(view)` shows
none of them and `jb.inspect` is how to see what a view can do. The move actions
take the track model's own `id`, not its `trackId`:

```js
const view = session.views[0]
const track = view.tracks.find(
  t => t.configuration.trackId === 'volvox_test_vcf',
)
view.moveTrackToTop(track.id)
return {
  moves: jb.inspect('views.0').actions.filter(a => a.startsWith('moveTrack')),
  order: view.tracks.map(t => t.configuration.trackId),
}
```

## Prove a track drew

A display that refuses to draw replaces its own subtree and raises no toast, so
a screenshot of it looks fine. The settle report is where it shows:

```js
session.views[0].showTrack('volvox_bigwig_nonexist')
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

A track over its fetch-size gate reports `phase: "tooLarge"` with the reason the
display painted; zoom in, or raise the display's `fetchSizeLimit` slot through
`applyDisplaySettings` if the size is meant. For a track that settled clean,
pair the empty `notReady` with a feature count over the visible region rather
than looking for pixels: the canvases are offscreen and measure 0 by 0.

## A figure per locus

The loop lives in the client, one navigate-and-settle call per locus and a
cropped screenshot after each. The settle call returns the view's element box so
`rect` or `selector` can crop to it:

```js
const view = session.views[0]
await view.navToLocString('ctgA:5,000-15,000')
const settle = await jb.waitReady(30000)
const el = document.querySelector(`[data-testid="view-container-${view.id}"]`)
return {
  loc: view.visibleLocStrings,
  rect: el.getBoundingClientRect().toJSON(),
  ...settle,
}
```

Then `screenshot` with `selector: '[data-testid="view-container-<view.id>"]'`,
and read `notReady` in its text part before trusting the image. On JBrowse Web
the capture is the browser agent's own, taken after `jb.waitReady` resolves.

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

The result names the `trackId` it chose, the inferred types, the view it was
shown in and the settle report. A count of zero over a region that should have
signal is the refName-mismatch trap: read `getRefNames()` off the adapter (the
[live model guide](/docs/agents_live_model) shows how) and compare against the
assembly's names. In JBrowse Web the location must be a URL the host serves with
CORS headers; a local path is refused before anything is added.

## Export what is on screen

In Desktop the renderer has Node, so a file is one `window.require` away. In
Web, return the text instead:

```js
const variants = await jb.getFeatures({ trackId: 'volvox_test_vcf' })
const rows = variants.map(v =>
  [
    v.get('refName'),
    v.get('start') + 1,
    v.get('end'),
    v.get('name'),
    v.get('REF'),
    v.get('ALT').join(','),
  ].join('\t'),
)
const tsv = ['refName\tstart\tend\tname\tref\talt', ...rows].join('\n')
const fs = window.require('fs')
fs.writeFileSync('/tmp/visible-variants.tsv', tsv)
return { rows: rows.length, file: '/tmp/visible-variants.tsv' }
```

## A second view without replacing the session

`jb.loadSessionSpec` replaces the whole session. To keep what is open and add a
view beside it, add one to the session and navigate it, naming the assembly
since a fresh view has none:

```js
const second = session.addView('LinearGenomeView', {
  displayName: 'second locus',
})
await second.navToLocString('ctgA:40,000-50,000', 'volvox')
second.showTrack('gff3tabix_genes')
return {
  views: session.views.map(v => `${v.id}: ${v.displayName ?? v.type}`),
  ...(await jb.waitReady(30000)),
}
```

`jb.sessionSummary()` then lists both views with their ids, and every helper
that takes a `viewId` can be pointed at either.

## See also

- [](/docs/agents_mcp)
- [](/docs/agents_web)
- [](/docs/agents_live_model)
- [](/docs/agents_hosted_data)
