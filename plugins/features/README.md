# @jbrowse/plugin-features

JBrowse 2 plugin for feature tracks

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### featureAttributeTables

The fields the file states for the features and transcripts a feature table
lists, by its `features.id` and `subfeatures.id`: `attributes` and
`subfeatureAttributes`, each key a column aligned to them, null where a record
lacks it, and `attributeFields`, each key's `type`, `number` and `description`.
A GFF3 keeps its column-9 keys as written (`ID`, `Name`, `Parent`), each a
`String`, beside `source`, `score` and `phase`; a BED or BigBed declares its
columns' types in its autoSql, where the parser reads them so. A key the file
does not declare (a GFF3 has no header) is typed off its values, and its columns
are the keys the region's records use. A key takes a list a record (`number`
`.`) where the spec lets it list several (a GFF3's `Parent`, `Alias`, `Note`,
`Dbxref` and `Ontology_term`, an autoSql array) or a record lists several. The
keys JBrowse gives a feature (`start`, `type`, ...) or decodes into its glyph
(`blockSizes`, ...) stay out.

```ts
import { featureAttributeTables } from '@jbrowse/plugin-features/tables'

function featureAttributeTables(
  pluginManager: PluginManager,
  opts: {
    adapterConfig: Record<string, unknown>
    sequenceAdapter?: Record<string, unknown>
    regions: TablesRegion[]
    ids: readonly string[]
    subfeatureIds: readonly string[]
  },
): Promise<{
  attributes: Record<string, unknown[]>
  subfeatureAttributes: Record<string, unknown[]>
  attributeFields: {
    key: string[]
    type: string[]
    number: string[]
    description: string[]
  }
}>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/tables.ts)

### featureTables

A region's features, or several regions', as the feature display
(`LinearBasicDisplay`) fetches, shapes, lays out and colors them, as tables:
each top-level feature on the row the display's layout gives it, the boxes,
intron lines, chevrons and strand arrows its glyph draws, its transcripts, the
labels the display shows beside it at this zoom, the residues it writes over a
zoomed-in CDS, and the color key, a ramp's as `ramps` (`rampKeyOf`). For a host
that draws them itself, such as R through V8. The adapters must be registered on
`pluginManager`.

Coordinates are 0-based genomic; every `y`, `top` and height is in the display's
px, down from the track's top, `feature` is a 0-based index into `features`, and
`region` the index of the row's region. Regions of one contig share one layout,
as the display packs them, so a feature crossing them is listed in each on the
same row. The layout is the display's under its `heightMode` and `height`: `fit`
(the default) runs the display's fit ladder, so the labels, isoforms and row
heights the browser gives up to fit the track are given up here too, and `grow`
places every feature at full size. The layout packs what was fetched over
`fetchRegions`, each of `regions` and the view's margin around it, a region
apiece, and the tables list the features touching `regions`, or a margin feature
whose label reaches into one, each with every mark of its glyph, as the view
draws them before its edges clip them. A read of the file's own fields for the
features listed reads over `fetchRegions`. A feature in view the packer could
not place within its 10000 px row ceiling is left out of every table and counted
in `truncated`; the legend keys the boxes the layout kept of the features in
view, such a feature included, as the browser's key does.

Under a `facet` the display packs a section per value, each under its
`sectionLabelHeight` chip row, and `sections` lists them in stacking order:
`key`, `label`, and `top` and `height` in px, the chip row included. Ungrouped,
there is one section, labelled `''`, from 0 to `height`. Each feature names its
section's `label`. A section `facet.hidden` lists leaves every table.

```ts
import { featureTables } from '@jbrowse/plugin-features/tables'

function featureTables(
  pluginManager: PluginManager,
  opts: FeatureTablesArgs,
): Promise<{
  truncated: number
  sections: { key: string[]; label: string[]; top: number[]; height: number[] }
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
  glyph: {
    fontSize: number
    arrowLength: number
    arrowStemHalfHeight: number
    chevronWidth: number
    chevronHeight: number
    aminoAcidHalo: string
    sectionLabelHeight: number
  }
  bpPerPx: number
  config: Record<string, unknown>
  fetchRegions: {
    refName: string
    start: number
    end: number
    originalRefName?: string
    assemblyName: string
  }[]
  height: number
  features: {
    id: string[]
    name: string[]
    type: string[]
    start: number[]
    end: number[]
    strand: number[]
    top: number[]
    bottom: number[]
    gene: boolean[]
    section: string[]
  } & { region: number[] }
  subfeatures: {
    id: string[]
    name: string[]
    type: string[]
    start: number[]
    end: number[]
    top: number[]
    bottom: number[]
    feature: number[]
  } & { region: number[] }
  rects: {
    start: number[]
    end: number[]
    top: number[]
    height: number[]
    color: string[]
    feature: number[]
    subfeature: number[]
  } & { region: number[] }
  lines: {
    start: number[]
    end: number[]
    y: number[]
    color: string[]
    feature: number[]
    subfeature: number[]
  } & { region: number[] }
  chevrons: {
    position: number[]
    y: number[]
    halfHeight: number[]
    direction: number[]
    color: string[]
    feature: number[]
    subfeature: number[]
  } & { region: number[] }
  arrows: {
    position: number[]
    y: number[]
    direction: number[]
    headHalfHeight: number[]
    color: string[]
    feature: number[]
    subfeature: number[]
  } & { region: number[] }
  aminoAcids: {
    start: number[]
    end: number[]
    aminoAcid: string[]
    proteinIndex: number[]
    top: number[]
    height: number[]
    stopOrNonTriplet: boolean[]
    translExcept: boolean[]
    text: string[]
    fontSize: number[]
    y: number[]
    color: string[]
    feature: number[]
    subfeature: number[]
  } & { region: number[] }
  labels: {
    text: string[]
    kind: string[]
    position: number[]
    y: number[]
    fontSize: number[]
    color: string[]
    feature: number[]
    subfeature: number[]
  } & { region: number[] }
}>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/tables.ts)

### isLinearBasicDisplay

Whether a track's display is the feature display, for a host that reaches it
through `view.getTrack(id)?.activeDisplay` to drive its own controls.

```ts
import { isLinearBasicDisplay } from '@jbrowse/plugin-features'

function isLinearBasicDisplay(display: unknown): display is LinearBasicDisplay
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/LinearBasicDisplay/isLinearBasicDisplay.ts)

<!-- API_DOCS_END -->
