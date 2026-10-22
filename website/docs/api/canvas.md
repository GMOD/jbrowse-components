---
id: canvas
title: "@jbrowse/plugin-canvas"
description: "JBrowse 2 plugin for canvas features"
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## featureAttributeTables

The fields the file states for the features and transcripts a feature
table lists, by its `features.id` and `subfeatures.id`: `attributes` and
`subfeatureAttributes`, each key a column aligned to them, null where a
record lacks it, and `attributeFields`, each key's `type`, `number` and
`description`. A GFF3 keeps its column-9 keys as written (`ID`, `Name`,
`Parent`), each a `String`, beside `source`, `score` and `phase`; a BED or
BigBed declares its columns' types in its autoSql, where the parser reads
them so. A key the file does not
declare (a GFF3 has no header) is typed off its values, and its columns are
the keys the region's records use. A key takes a list a record (`number`
`.`) where the spec lets it list several (a GFF3's `Parent`, `Alias`,
`Note`, `Dbxref` and `Ontology_term`, an autoSql array) or a record lists
several. The keys JBrowse gives a feature (`start`, `type`, ...) or decodes
into its glyph (`blockSizes`, ...) stay out.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, regions, ids, subfeatureIds, }: { adapterConfig: Record<string, unknown>; sequenceAdapter?: Record<string, unknown> | undefined; regions: TablesRegion[]; ids: readonly string[]; subfeatureIds: readonly string[]; }) => Promise<{ attributes: Record<string, unknown[]>; subfeatureAttributes: Record<string, unknown[]>; attributeFields: { key: string[]; type: string[]; number: string[]; description: string[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/tables.ts)

## featureTables

A region's features, or several regions', as the feature display
(`LinearBasicDisplay`) fetches, shapes, lays out and colors them, as
tables: each top-level feature on the
row the display's layout gives it, the boxes, intron lines, chevrons and
strand arrows its glyph draws, its transcripts, the labels the display
shows beside it at this zoom, the residues it writes over a zoomed-in CDS,
and the color key, a ramp's as `ramps`
(`rampKeyOf`). For a host that draws them itself, such as R through V8. The
adapters must be registered on `pluginManager`.

Coordinates are 0-based genomic; every `y`, `top` and height is in the
display's px, down from the track's top, `feature` is a 0-based index into
`features`, and `region` the index of the row's region. Regions of one
contig share one layout, as the display packs them, so a feature crossing
them is listed in each on the same row. The layout is the display's under
its `heightMode` and `height`: `fit` (the default) runs the display's fit
ladder, so the labels, isoforms and row heights the browser gives up to fit
the track are given up here too, and `grow` places every feature at full
size. A feature the packer could not place within its 10000 px row ceiling
is left out of every table and counted in `truncated`; the legend keys what
the worker painted, such a feature included, as the browser's key does.

Under a `facet` the display packs a section per value, each under its
`sectionLabelHeight` chip row, and `sections` lists them in stacking order:
`key`, `label`, and `top` and `height` in px, the chip row included.
Ungrouped, there is one section, labelled `''`, from 0 to `height`. Each
feature names its section's `label`. A section `facet.hidden` lists leaves
every table.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, regions, display, bpPerPx, colorByFrame, aminoAcids, geneticCodeId, byteLimit, }: FeatureTablesArgs) => Promise<{ sections: {…}; legend: {…}; legendTitle: string; ramps: {…}[]; glyph: {…}; bpPerPx: number; config: Record<…>; height: number; truncated: number; subfeatures: {…} & {…}; labels: {…} & {…}; features: {…} & {…}; rects: {…} & {…}; lines: {…} & {…}; chevrons: {…} & {…}; arrows: {…} & {…}; aminoAcids: {…} & { region: number[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/tables.ts)
