# @jbrowse/plugin-alignments

JBrowse 2 alignments adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### alignmentConnectorCurves

Each connector of a `connectors` table as the pileup places its cubic at
`pxPerBp`, through the connector mark's own placement, for a host drawing the
table at its figure's scale. Both ends lie in one region, `reversed` where it is
flipped; `featureHeight` and `featureSpacing` are `readPitch`'s. Returns each
curve's two control points, `handle` and `endHandle` in bp with `handleRow` and
`endHandleRow` in rows as `row` counts them, a straight connector's at its ends;
and, where an arrowhead fits at this scale, `arrow` true and `arrowBack`, the bp
its arms reach back to, which stand `arrowRows` rows off the row.

```ts
import { alignmentConnectorCurves } from '@jbrowse/plugin-alignments/tables'

function alignmentConnectorCurves(opts: {
  pxPerBp: number
  reversed?: boolean
  featureHeight: number
  featureSpacing: number
  connectors: {
    start: readonly number[]
    end: readonly number[]
    row: readonly number[]
    endRow: readonly number[]
    kind: readonly ('straight' | 'curve' | 'bow' | 'loop')[]
    dip: readonly number[]
    strand: readonly number[]
    endStrand: readonly number[]
    leading: readonly boolean[]
    arrow: readonly boolean[]
  }
}): {
  handle: number[]
  handleRow: number[]
  endHandle: number[]
  endHandleRow: number[]
  arrow: boolean[]
  arrowBack: number[]
  arrowRows: number
}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

### alignmentMarkAlpha

Each insertion's width in px and each insertion's, deletion's, mismatch's and
clip's alpha as the pileup draws them at `pxPerBp`, through the shaders'
generated twins, for a host that draws the marks at its figure's scale. `fade`
is a mark's `fade` column, `length` its length in bp (a deletion's
`end - start`) and `quality` a mismatch's, 255 where the read has none. A column
may be a number, for one mark. `featureHeight` is `readPitch.featureHeight`,
`fadeLowFrequency` the display's `pileup.fadeLowFrequency`, and
`mismatchOpacity` its `pileup.mismatches.encoding.opacity` as a config writes
it; each of the three takes the pileup config's default when left out.

- An insertion's `widthPx` is `insertionBarWidthPx`, and its `alpha`
  `insertionSizeAlpha` times, under `LONG_INSERTION_MIN_LENGTH`,
  `frequencyFadeGate` over `pxPerBp` squared.
- A deletion's `alpha` is `sizeAlpha` of its width in px times
  `frequencyFadeGate` over that width squared. Its `labelAlpha`, its length
  label's, is `labelFadeOpacity` of `visibleLength`, the bp of it inside its
  region (`length` when left out), in px against the width its digits need, and
  0 on a read under `MIN_HEIGHT_FOR_TEXT`.
- A mismatch's `alpha` is `qualityFade` times `frequencyFadeGate` over
  `pxPerBp`, and a clip's that gate alone. `quality` may be left out while
  `mismatchOpacity` is a constant. Its `letterAlpha`, its base letter's, is
  `qualityFade` alone, 0 under `MIN_QUALITY_LETTER_OPACITY`, where the display
  writes no letter.

```ts
import { alignmentMarkAlpha } from '@jbrowse/plugin-alignments/tables'

function alignmentMarkAlpha(opts: {
  pxPerBp: number
  featureHeight?: number
  fadeLowFrequency?: boolean
  mismatchOpacity?: PileupMismatchesOpacitySnapshot
  insertions?: { length: MarkColumn; fade: MarkColumn }
  deletions?: {
    length: MarkColumn
    fade: MarkColumn
    visibleLength?: MarkColumn | null
  }
  mismatches?: { fade: MarkColumn; quality?: MarkColumn }
  clips?: { fade: MarkColumn }
}): {
  insertions: { widthPx: number[]; alpha: number[] }
  deletions: { alpha: number[]; labelAlpha: number[] }
  mismatches: { alpha: number[]; letterAlpha: number[] }
  clips: { alpha: number[] }
}
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

### alignmentTables

A region's reads, or several regions', as the alignments display fetches,
filters, lays out and colors them, as tables: the worker's reads, mismatches,
gaps, insertions, clips, modifications, per-base qualities, coverage and splice
junctions, each read on the row the display's pileup layout gives it and in the
color the display's `encoding.color` paints it, with the key the display shows:
`legend`, and `ramps`, its color bars (`rampKeyOf`). Under a `facet` each
section lays out separately, every row has a `section`, and `sections` lists
them in stacking order; ungrouped, there is one section, labelled `''`. Several
regions lay out as the display lays out a view's regions, on one set of rows: a
read crossing regions is listed in each, under one `key` and on one `row`, and
every row names its `region`'s index. `arcScale` is the read-connection band's y
scale (`arcBandScale`): the read cloud's log `domain`, or for arcs none, as
their linear domain is `[0, reachPx / pxPerBp]` at the host's own scale, and the
band they draw in. `warnings` names what the config asked for that the tables
dropped. For a host that draws them itself, such as R through V8. The adapters
must be registered on `pluginManager` (`registerAlignmentsAdapters`).

```ts
import { alignmentTables } from '@jbrowse/plugin-alignments/tables'

function alignmentTables(
  pluginManager: PluginManager,
  opts: AlignmentTablesArgs,
): Promise<{
  sections: { key: string[]; label: string[] }
  legend: { label: string[]; color: string[] }
  legendTitle: string
  ramps: {
    offset: number[]
    color: string[]
    opacity: number[]
    minLabel: string
    maxLabel: string
    id: string
    title: string
  }[]
  arcLegend: { label: string[]; color: string[] }
  arcLegendTitle: string
  arcSpanMax: number
  arcScale:
    | {
        type: 'linear'
        reverse: boolean
        marginPx: number
        reachPx: number
        insetPx: number
        domain: null
        band: string
        heightPx: number
      }
    | {
        type: 'log'
        reverse: boolean
        marginPx: number
        reachPx: number
        insetPx: number
        domain: [number, number]
        band: string
        heightPx: number
      }
    | null
  coverageScale: {
    domain: [number, number]
    type: 'linear' | 'log' | 'symlog'
    heightPx: number
    symlogConstant: number
    ticks: number[]
  }
  glyph: {
    intronAlpha: number
    label: {
      minHeight: number
      minPxPerBp: number
      digitPx: number
      fadeLo: number
      fadeHi: number
      fadeFloor: number
    }
    indicatorWidth: number
    indicatorHeight: number
    coverageInset: number
    interbaseTop: number
  }
  readPitch: { featureHeight: number; featureSpacing: number }
  config: Record<string, unknown>
  warnings: string[]
  baseLegend: { label: ('A' | 'C' | 'G' | 'N' | 'T')[]; color: string[] }
  baseLegendTitle: string
  junctionLegend: { label: string[]; color: string[] }
  junctionLegendTitle: string
  interbaseLegend: { label: string[]; color: string[] }
  interbaseLegendTitle: string
  junctions: {
    start: number[]
    end: number[]
    count: number[]
    class: ('deletion' | 'duplication' | 'inversion' | 'splice')[]
    level: string[]
    source: ('gap' | 'split')[]
    strand: number[]
    motif: string[]
    color: string[]
    shown: boolean[]
    arcHeight: number[]
    strokeWidth: number[]
    refName: string[]
    startRegion: number[]
    endRegion: number[]
  } & { section: string[] }
  arcs: {
    start: number[]
    end: number[]
    shape: ('arc' | 'flat' | 'flatSplit' | 'unplaced')[]
    level: string[]
    class: string[]
    color: string[]
    opacity: (1 | 0.7)[]
    y: number[]
    span: number[]
    support: number[]
    width: number[]
    startRegion: number[]
    endRegion: number[]
  } & { section: string[]; region: number[] }
  arcTicks: {
    position: number[]
    support: number[]
    partners: string[]
    color: string[]
    width: number[]
  } & { section: string[]; region: number[] }
  coverage: {
    start: number[]
    end: number[]
    depth: number[]
    forward: number[]
    reverse: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  alleleCoverage: {
    position: number[]
    base: string[]
    from: number[]
    to: number[]
    depth: number[]
    color: string[]
    shown: boolean[]
  } & { section: string[]; region: number[] }
  modificationCoverage: {
    position: number[]
    from: number[]
    to: number[]
    depth: number[]
    color: string[]
    opacity: number[]
  } & { section: string[]; region: number[] }
  interbaseCoverage: {
    position: number[]
    type: ('hardclip' | 'insertion' | 'softclip')[]
    from: number[]
    to: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  indicators: {
    position: number[]
    type: ('hardclip' | 'insertion' | 'softclip')[]
    color: string[]
  } & { section: string[]; region: number[] }
  modifications: {
    position: number[]
    read: number[]
    type: string[]
    name: string[]
    probability: number[]
    unmodified: boolean[]
    color: string[]
    opacity: number[]
  } & { section: string[]; region: number[] }
  qualities: {
    position: number[]
    read: number[]
    score: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  insertions: {
    position: number[]
    length: number[]
    sequence: string[]
    read: number[]
    fade: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  clips: {
    position: number[]
    length: number[]
    type: string[]
    read: number[]
    fade: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  reads: {
    id: string[]
    start: number[]
    end: number[]
    row: number[]
    strand: number[]
    mapq: number[]
    flags: number[]
    name: string[]
    insertSize: number[]
    pairOrientation: ('' | PairDirection)[]
    color: string[]
    level: string[]
    key: number[]
  } & { section: string[]; region: number[] } & { key: number[] }
  mismatches: {
    position: number[]
    base: string[]
    read: number[]
    frequency: number[]
    fade: number[]
    quality: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  gaps: {
    start: number[]
    end: number[]
    type: ('deletion' | 'skip')[]
    read: number[]
    fade: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  overlaps: {
    start: number[]
    end: number[]
    row: number[]
    color: string[]
  } & { section: string[]; region: number[] }
  connectors: {
    start: number[]
    end: number[]
    endRegion: number[]
    row: number[]
    endRow: number[]
    color: string[]
    opacity: number[]
    width: number[]
    kind: ('bow' | 'curve' | 'loop' | 'straight')[]
    dip: number[]
    strand: (1 | -1)[]
    endStrand: (1 | -1)[]
    leading: boolean[]
    arrow: boolean[]
    key: number[]
    mateKey: number[]
  } & { section: string[]; region: number[] } & {
    key: number[]
    mateKey: number[]
  }
}>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

### isLinearAlignmentsDisplay

Whether a track's display is the reads display, for a host that reaches it
through `view.getTrack(id)?.activeDisplay` to drive its own controls.

```ts
import { isLinearAlignmentsDisplay } from '@jbrowse/plugin-alignments'

function isLinearAlignmentsDisplay(
  display: unknown,
): display is LinearAlignmentsDisplayModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/isLinearAlignmentsDisplay.ts)

### referenceSequence

A region of the reference, as the sequence adapter a track's assembly names
reads it: the bases as one string, for a host drawing them under a pileup.

```ts
import { referenceSequence } from '@jbrowse/plugin-alignments/tables'

function referenceSequence(
  pluginManager: PluginManager,
  opts: {
    sequenceAdapter: Record<string, unknown>
    region: { refName: string; start: number; end: number }
  },
): Promise<string>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

<!-- API_DOCS_END -->
