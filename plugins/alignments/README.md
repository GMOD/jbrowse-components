# @jbrowse/plugin-alignments

JBrowse 2 alignments adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### alignmentMarkAlpha

Each insertion's width in px and each insertion's, deletion's, mismatch's and
clip's alpha as the pileup draws them at `pxPerBp`, through the shaders'
generated twins, for a host that draws the marks at its figure's scale. `fade`
is a mark's `fade` column, `length` its length in bp (a deletion's
`end - start`) and `quality` a mismatch's, 255 where the read has none. A column
may be a number, for one mark. `featureHeight` is `readPitch.featureHeight`, and
the two switches are the display's `pileup.fadeLowFrequency` and
`pileup.fadeLowBaseQuality`; each of the three takes the pileup config's default
when left out.

- An insertion's `widthPx` is `insertionBarWidthPx`, and its `alpha`
  `insertionSizeAlpha` times, under `LONG_INSERTION_MIN_LENGTH`,
  `frequencyFadeGate` over `pxPerBp` squared.
- A deletion's `alpha` is `sizeAlpha` of its width in px times
  `frequencyFadeGate` over that width squared.
- A mismatch's `alpha` is `qualityFade` times `frequencyFadeGate` over
  `pxPerBp`, and a clip's that gate alone. `quality` may be left out while
  `fadeLowBaseQuality` is false.

```js
// type signature
({…}: { pxPerBp: number; featureHeight?: number | undefined; fadeLowFrequency?: boolean | undefined; fadeLowBaseQuality?: boolean | undefined; insertions?: { length: MarkColumn; fade: MarkColumn; } | undefined; deletions?: { length: MarkColumn; fade: MarkColumn; } | undefined; mismatches?: { fade: MarkColumn; quality?: MarkColumn | undefined; } | undefined; clips?: { fade: MarkColumn; } | undefined; }) => { insertions: { widthPx: number[]; alpha: number[]; }; deletions: { alpha: number[]; }; mismatches: { alpha: number[]; }; clips: { alpha: number[]; }; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

### alignmentTables

A region's reads, or several regions', as the alignments display fetches,
filters, lays out and colors them, as tables: the worker's reads, mismatches,
gaps, insertions, clips, modifications, per-base qualities, coverage and splice
junctions, each read on the row the display's pileup layout gives it and in the
color the display's `color` object paints it, with the key the display shows:
`legend`, and `ramps`, its color bars (`rampKeyOf`). Under a `facet` each
section lays out separately, every row has a `section`, and `sections` lists
them in stacking order; ungrouped, there is one section, labelled `''`. Several
regions lay out as the display lays out a view's regions, on one set of rows: a
read crossing regions is listed in each, under one `key` and on one `row`, and
every row names its `region`'s index. `warnings` names what the config asked for
that the tables dropped. For a host that draws them itself, such as R through
V8. The adapters must be registered on `pluginManager`
(`registerAlignmentsAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, regions, display, refNames, byteLimit, spanLimit, }: AlignmentTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

### referenceSequence

A region of the reference, as the sequence adapter a track's assembly names
reads it: the bases as one string, for a host drawing them under a pileup.

```js
// type signature
(pluginManager: PluginManager, { sequenceAdapter, region, }: { sequenceAdapter: Record<string, unknown>; region: { refName: string; start: number; end: number; }; }) => Promise<string>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

<!-- API_DOCS_END -->
