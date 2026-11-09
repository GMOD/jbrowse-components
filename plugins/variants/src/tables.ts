import { fullConfSnapshot } from '@jbrowse/core/configuration'
import { tablesFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  DEFAULT_BYTE_LIMIT,
  overByteLimitError,
} from '@jbrowse/core/data_adapters/tables'
import { overByteBudget, totalRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import { isObject } from '@jbrowse/core/util'
import { abgrToHex } from '@jbrowse/core/util/colorBits'
import ParkedColorMixin from '@jbrowse/display-kit/ParkedColorMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { windowFetchRegions } from '@jbrowse/display-kit/regionHost'
import { types } from '@jbrowse/mobx-state-tree'
import { RowHeightMixin } from '@jbrowse/tree-sidebar/RowHeightMixin'
import { ROW_COLOR_SCALE_ID } from '@jbrowse/tree-sidebar/rowColorScale'
import {
  treeSidebarRowsConfigViews,
  treeSidebarRowStages,
} from '@jbrowse/tree-sidebar/treeSidebarRowViews'
import { runInAction } from 'mobx'

import {
  cellHueInputViews,
  cellHueValuesReadViews,
  cellHueViews,
  cellKeyViews,
  regionCellColorViews,
  variantDataKeyViews,
} from './LinearVariantDisplay/cellColorViews.ts'
import configSchemaFactory from './LinearVariantDisplay/configSchema.ts'
import {
  densityRung,
  recordDensityAlpha,
} from './LinearVariantDisplay/densityFade.ts'
import { keyedVariantViews } from './LinearVariantDisplay/keyedVariants.ts'
import {
  recordColorViews,
  recordsColorScaleViews,
  recordsKeyViews,
} from './LinearVariantDisplay/recordsBandViews.ts'
import {
  variantColorSettingViews,
  variantDrawnRowViews,
  variantFetchViews,
  variantGenotypeRowViews,
  variantGenotypesShowViews,
  variantHeightViews,
  variantRowConfigViews,
  variantRowHookViews,
  variantRowsHeightViews,
} from './LinearVariantDisplay/variantRowViews.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import { sourcesAndWarnings } from './VariantRPC/MultiSampleVariantGetSources.ts'
import { genotypeMatrixOf } from './VariantRPC/buildGenotypeMatrix.ts'
import { variantCellData } from './VariantRPC/executeVariantCellData.ts'
import { fetchVariantFeatures } from './VariantRPC/fetchVariantFeatures.ts'
import {
  readAltDosages,
  readPhasedAlleleIndicators,
} from './VariantRPC/genotypeMatrixEncoding.ts'
import { altColumnCount } from './VariantRPC/getGenotypeMatrix.ts'
import { matrixWalkOf } from './VariantRPC/matrixWalk.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'
import { buildSampleIndex, decodeGenotype } from './shared/genotypeCodec.ts'

import type { CellDataResult } from './VariantRPC/executeVariantCellData.ts'
import type { ProcessedSource, Source } from './shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature } from '@jbrowse/core/util'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

const base = types
  .compose(
    'VariantTablesHost',
    TrackHeightMixin(),
    ParkedColorMixin(),
    RowHeightMixin(),
    types.model({ configuration: configSchemaFactory() }),
  )
  .volatile(
    (): {
      adapterSamples: Source[] | undefined
      keyWindows: readonly KeyWindow[]
      cellData: CellDataResult | undefined
    } => ({
      adapterSamples: undefined,
      keyWindows: [],
      cellData: undefined,
    }),
  )
  .actions(self => ({
    setAdapterSamples(samples: Source[]) {
      self.adapterSamples = samples
    },
    setKeyWindows(windows: readonly KeyWindow[]) {
      self.keyWindows = windows
    },
    setCellData(cellData: CellDataResult) {
      self.cellData = cellData
    },
  }))
  .views(self => ({
    get samplePloidy(): Readonly<Record<string, number>> | undefined {
      return self.cellData?.samplePloidy
    },
    /**
     * No fade: the tables give each record's alpha apart
     * (`variantDensityAlpha`), for a host drawing at its own scale.
     */
    get regionRecordAlpha(): ReadonlyMap<number, Float32Array | undefined> {
      return new Map()
    },
  }))
  .views(self => variantRowConfigViews(self))
  .views(self => variantGenotypesShowViews(self))
  .views(self => variantColorSettingViews(self))
  .views(self => cellHueInputViews(self))
  .views(self => cellHueValuesReadViews(self))
  .views(self => cellHueViews(self))
  .views(self => variantGenotypeRowViews(self))
  .views(self => keyedVariantViews(self))
  .views(self => treeSidebarRowsConfigViews(self))

/**
 * The variant display reduced to what its tables read: the display's config,
 * the samples the adapter lists, the windows the regions show and the
 * payload the fetch reports, under the row views the display installs, its
 * row hooks, what it fetches, its cell coloring, whether it draws its
 * genotype rows, the height its rows divide and what it keys. No session, no
 * view and no records band, so its `height` is the rows' slot; its env holds
 * the `pluginManager` the jexl filters evaluate through.
 */
const VariantTablesHost = treeSidebarRowStages<ProcessedSource>()(base)
  .views(self => variantDrawnRowViews(self))
  .views(self => variantFetchViews(self))
  .views(self => variantRowHookViews(self))
  .views(self => variantHeightViews(self))
  .views(self => variantRowsHeightViews(self))
  .views(self => recordsKeyViews(self))
  .views(self => cellKeyViews(self))
  .views(self => recordColorViews(self))
  .views(self => recordsColorScaleViews(self))
  .views(self => regionCellColorViews(self))
  .views(self => variantDataKeyViews(self))

/** Registers the adapters `variantTables` reads through: VCF, tabixed or not. */
export function registerVariantAdapters(pluginManager: PluginManager) {
  VcfAdapterF(pluginManager)
  VcfTabixAdapterF(pluginManager)
  SplitVcfTabixAdapterF(pluginManager)
}

export interface VariantTablesArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, which a reference-reading file is keyed on. */
  sequenceAdapter?: Record<string, unknown>
  /**
   * The regions read as a view lays them side by side: one set of rows
   * and one key across them. A record crossing regions is listed in each.
   */
  regions: TablesRegion[]
  /**
   * The regions the view displays, which `regions` are windows into: one
   * locus's whole contig, as the browser shows a locus. The display fetches
   * over each window and the view's margin around it, clamped to the region
   * displayed, which the rows and the key are drawn from, and the tables list the records the windows show. Unset, `regions` themselves.
   */
  displayedRegions?: TablesRegion[]
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearVariantDisplay`: `encoding`, `rows.field` (`'sample'` or
   * `'haplotype'`), `filter` (a predicate list, `minorAlleleFrequency` and
   * `missingness` among its fields), `genotypes.reference.show`, the
   * arrangement `rows` and `facet` and the rest of its slots. Unset reads the
   * default display.
   */
  display?: Record<string, unknown>
  /**
   * The most compressed bytes the regions may need together, refused off the
   * index before any record is fetched.
   */
  byteLimit?: number
}

/**
 * The variant display's host over what it fetched for `regions`: each
 * region's records its window shows (`perRegion`, their features in
 * `records`), and the rows it draws (`drawn`), top to bottom.
 */
async function fetchedVariantHost(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    regions,
    displayedRegions,
    display = {},
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: VariantTablesArgs,
) {
  if (regions.length === 0) {
    throw new Error('variantTables reads a region, or regions')
  }
  const host = VariantTablesHost.create(
    {
      configuration: {
        ...display,
        variantLayout: 'genomic',
        type: 'LinearVariantDisplay',
        displayId: 'tables',
      },
    },
    { pluginManager },
  )
  const adapter = await tablesFeatureAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  const fetchedRegions = windowFetchRegions(regions, displayedRegions)
  const fetchRegions = fetchedRegions.map(r => ({ assemblyName: '', ...r }))
  const tooLarge = (bytes: number | undefined) =>
    overByteLimitError(regions, bytes, byteLimit, 'variants')
  const bytes = await totalRegionBytes(adapter, fetchRegions)
  if (overByteBudget(bytes, byteLimit)) {
    throw tooLarge(bytes)
  }
  const listing = await sourcesAndWarnings(adapter, fetchRegions, {})
  host.setAdapterSamples(listing.sources)
  host.setKeyWindows(
    regions.map(({ refName, start, end }, i) => ({
      regionIndex: i,
      refName,
      start,
      end,
    })),
  )
  const args: RpcExecuteArgs<'MultiSampleVariantGetCellData'> = runInAction(
    () => ({
      sessionId: 'tables',
      adapterConfig,
      regions: fetchRegions,
      layout: host.variantLayout,
      rowsField: host.rowsField,
      color: host.cellHueRead,
      sampleFilter: host.sampleFilter,
      showReference: host.showReference,
      siteFilter: host.siteFilter,
      filters: host.filters,
      statusCallback: () => {},
    }),
  )
  const result = await variantCellData({ pluginManager, args })
  if ('regionTooLarge' in result) {
    throw tooLarge(result.bytes)
  }
  const value = result.value
  const perRegion = regions.flatMap(({ start, end }, i) => {
    const data = value.perRegionCellData[i]
    return data
      ? [
          {
            region: i,
            data,
            shown: data.featureInfo.flatMap((_, f) =>
              data.featurePositions[f * 2 + 1]! > start &&
              data.featurePositions[f * 2]! < end
                ? [f]
                : [],
            ),
          },
        ]
      : []
  })
  const recordOf = new Map(result.records.map(r => [r.id(), r]))
  const records = perRegion.flatMap(({ data, shown }) =>
    shown.map(f => recordOf.get(data.featureInfo[f]!.featureId)!),
  )

  host.setCellData(value)
  const fetched = new Set(value.rowNames)
  const drawn = runInAction(() =>
    host.sources.filter(row => fetched.has(row.name)),
  )
  return {
    host,
    adapter,
    listing,
    args,
    value,
    perRegion,
    recordOf,
    records,
    drawn,
  }
}

/**
 * #api
 * A region of a multi-sample VCF as the variant display fetches,
 * filters and paints it, as tables: `variants`, each record the display
 * keeps, with its `color` as the records band paints it (its SV class's,
 * else `featureDefaultColor`, under no picked `encoding.color` and under
 * `phaseSet`; else the alt cells' hue at full dose) and its `filter`;
 * `info`, each INFO key's
 * values aligned to `variants`, and `infoFields`, the header's declaration
 * of each key; `annotations`, each record's SnpEff `ANN` or VEP `CSQ`
 * consequences, a row per record and consequence, which then leave `info`
 * (`consequenceTables`); `cells`, each sample's (or under
 * `rows.field: 'haplotype'` each haplotype's) cell at each record, with its
 * genotype, its `dosage` and the fill the display paints it; `rows`, the
 * rows the cells name, top to bottom as the display arranges them by `rows`
 * and stacks them in `facet`'s bands, each with its label and band; `bands`,
 * each band's value and label, in stacking order; `legend`, `legendTitle`
 * and `ramps`, the key the display shows; `rowBackground`, the fill the
 * display paints behind its rows; `height`, the px the rows' slot takes
 * (`height` as written, else the display's default), the records band above
 * it apart; `rowHeight`, the px each row draws at, `rows.step` or the slot
 * divided between the rows, as the display resolves it; and `warnings`, the
 * samples file's. With `genotypes.reference.show` off, the default, a
 * reference call draws no cell, and `rowBackground` is the reference call's
 * color, standing in for every one; on, `rowBackground` is `''`. With
 * `genotypes.show` off, and unset on a one-sample VCF, no row draws, so
 * `rows` and `cells` are empty, the key is the records', and no genotype is
 * read, so `minorAlleleFrequency` and `missingness` filter nothing, as on a
 * sites-only VCF. The records sit at their genomic positions whatever
 * `variantLayout` says. Several regions share the rows and the key, as the
 * display's regions do: a record crossing regions is listed in each, under
 * one `key`, with its `annotations` once, under its first listing; every
 * `variants` and `cells` row names its `region`'s index, and `cells.variant`
 * indexes the joined `variants`. For a host that draws them itself, such as
 * R through V8. The adapters must be registered on `pluginManager`
 * (`registerVariantAdapters`).
 */
export async function variantTables(
  pluginManager: PluginManager,
  variantArgs: VariantTablesArgs,
) {
  const { host, adapter, listing, args, value, perRegion, records, drawn } =
    await fetchedVariantHost(pluginManager, variantArgs)
  const sampleIndex = buildSampleIndex(value.sampleNames)
  const {
    band,
    color,
    rowKey,
    rowBands,
    recordColors,
    cellColors,
    scales,
    rowBackground,
    height,
    rowHeight,
  } = runInAction(() => {
    const rowColors = host.resolvedRowColors
    return {
      band: drawn.map(row => host.rowBand(row)),
      color: drawn.map(row => rowColors.get(row.name) ?? ''),
      rowKey: host.rowColorScales.find(
        scale => scale.id === ROW_COLOR_SCALE_ID,
      ),
      rowBands: host.rowBands,
      recordColors: host.regionRecordColors,
      cellColors: host.regionCellColors,
      scales: host.dataColorScales,
      rowBackground: host.rowBackground,
      height: host.height,
      rowHeight: host.effectiveRowHeight,
    }
  })
  const rows = {
    name: drawn.map(row => row.name),
    label: drawn.map(row => row.label ?? row.name),
    sample: drawn.map(row => row.sampleName),
    haplotype: drawn.map(row => (row.HP === undefined ? 0 : row.HP + 1)),
    ploidy: drawn.map(row => value.samplePloidy[row.sampleName] ?? 0),
    band,
    color,
  }
  const rowIndex = new Map(rows.name.map((name, i) => [name, i]))

  const variants = {
    start: [] as number[],
    end: [] as number[],
    id: [] as string[],
    name: [] as string[],
    ref: [] as string[],
    alt: [] as string[],
    type: [] as string[],
    color: [] as string[],
    filter: records.map(filterOf),
    region: [] as number[],
    key: [] as number[],
  }
  const cells = {
    variant: [] as number[],
    row: [] as string[],
    genotype: [] as string[],
    dosage: [] as (number | null)[],
    color: [] as string[],
    region: [] as number[],
  }
  const keys = new Map<string, number>()
  for (const { region: regionIndex, data, shown } of perRegion) {
    const offset = variants.start.length
    const featureColors = recordColors.get(regionIndex)!
    const variantOf = new Map(shown.map((f, i) => [f, offset + i]))
    for (const f of shown) {
      const info = data.featureInfo[f]!
      if (!keys.has(info.featureId)) {
        keys.set(info.featureId, keys.size)
      }
      variants.start.push(data.featurePositions[f * 2]!)
      variants.end.push(data.featurePositions[f * 2 + 1]!)
      variants.id.push(info.featureId)
      variants.name.push(info.name)
      variants.ref.push(info.ref)
      variants.alt.push(info.alt.join(','))
      variants.type.push(info.type)
      variants.color.push(abgrToHex(featureColors[f]!))
      variants.region.push(regionIndex)
      variants.key.push(keys.get(info.featureId)!)
    }
    const colors = cellColors.get(regionIndex)!
    for (let i = 0; i < data.numCells; i++) {
      const f = data.cellFeatureIndices[i]!
      const name = value.rowNames[data.cellRowIndices[i]!]!
      const row = rowIndex.get(name)
      const variant = variantOf.get(f)
      if (row === undefined || variant === undefined) {
        continue
      }
      cells.variant.push(variant)
      cells.row.push(name)
      cells.genotype.push(
        decodeGenotype(
          value.genotypeDict,
          sampleIndex,
          data.featureInfo[f]!.genotypeCodes,
          rows.sample[row]!,
        ) ?? '',
      )
      cells.dosage.push(
        cellDosage(
          cells.genotype[cells.genotype.length - 1]!,
          data.featureInfo[f]!.alt.length,
          args.rowsField === 'haplotype' ? rows.haplotype[row]! - 1 : undefined,
          rows.ploidy[row]!,
        ),
      )
      cells.color.push(abgrToHex(colors[i]!))
      cells.region.push(regionIndex)
    }
  }

  return {
    variants,
    ...infoColumns(records, (await vcfDeclarationsOf(adapter)).info, 'variant'),
    cells,
    rows,
    ...colorKeyTables(scales),
    rowLegend: {
      label: rowKey?.entries.map(e => e.label) ?? [],
      color: rowKey?.entries.map(e => e.color ?? '') ?? [],
    },
    rowLegendTitle: rowKey?.title ?? '',
    bands: {
      key: rowBands.map(b => b.key),
      label: rowBands.map(b => b.label),
    },
    rowBackground,
    height,
    rowHeight,
    config: fullConfSnapshot(host.configuration),
    warnings: listing.warnings,
  }
}

/**
 * A record's FILTER as the file writes it, the failed filters joined by `;`,
 * and null for `.`, a record no filter was applied to.
 */
function filterOf(record: Feature) {
  const filter = record.get('FILTER') as string | string[] | undefined
  return Array.isArray(filter) ? filter.join(';') : (filter ?? null)
}

/**
 * A section's keys the header declares, in its order, and the parser's
 * declaration of each, which holds the VCF spec's reserved keys too.
 */
interface Declarations {
  declared: string[]
  meta: Record<string, unknown>
}

function declarationOf(
  meta: Record<string, unknown>,
  key: string,
  field: 'Number' | 'Type' | 'Description',
) {
  const declaration = meta[key]
  return isObject(declaration) ? declaration[field] : undefined
}

async function vcfDeclarationsOf(adapter: BaseFeatureDataAdapter) {
  const header = await adapter.getHeader()
  const metadata = await adapter.getMetadata()
  const section = (field: 'INFO' | 'FORMAT'): Declarations => {
    const meta = isObject(metadata) ? metadata[field] : undefined
    return {
      declared:
        typeof header === 'string'
          ? [
              ...header.matchAll(new RegExp(`^##${field}=<ID=([^,>]+)`, 'gm')),
            ].map(m => m[1]!)
          : [],
      meta: isObject(meta) ? meta : {},
    }
  }
  return { info: section('INFO'), format: section('FORMAT') }
}

type FieldValue = true | (string | number | undefined)[] | undefined

/**
 * Each key's values, one per row, typed by the key's header line: a flag as
 * a boolean, false where the row lacks it; a `Number=1` key as its value; any
 * other `Number` (`A`, `R`, `G`, `.`, 2) as an array, an entry per value. A
 * row lacking a non-flag key, or giving `.`, has null. The keys are the
 * header's, in its order, then any other a row uses, typed as the VCF spec
 * reserves it, else read as a flag where every use is bare and as a
 * `Number=.` string otherwise, as is a key every row gives as `.`. `fields`
 * lists each key's declaration.
 */
function typedColumns(
  rows: readonly (Record<string, FieldValue> | undefined)[],
  { declared, meta }: Declarations,
) {
  const keys = new Set(declared)
  for (const row of rows) {
    for (const key of Object.keys(row ?? {})) {
      keys.add(key)
    }
  }
  const fields = {
    key: [] as string[],
    number: [] as string[],
    type: [] as string[],
    description: [] as string[],
  }
  const columns: Record<string, unknown[]> = {}
  for (const key of keys) {
    const values = rows.map(row => row?.[key])
    const bare =
      values.includes(true) && values.every(v => v === undefined || v === true)
    const type = String(
      declarationOf(meta, key, 'Type') ?? (bare ? 'Flag' : 'String'),
    )
    const number = String(
      declarationOf(meta, key, 'Number') ?? (type === 'Flag' ? 0 : '.'),
    )
    const numeric = type === 'Integer' || type === 'Float'
    fields.key.push(key)
    fields.number.push(number)
    fields.type.push(type)
    fields.description.push(
      String(declarationOf(meta, key, 'Description') ?? ''),
    )
    columns[key] = values.map(v =>
      type === 'Flag' || number === '0'
        ? v !== undefined
        : v === undefined || v === true
          ? null
          : number !== '1'
            ? v.map(x => x ?? null)
            : numeric || v.length === 1
              ? (v[0] ?? null)
              : v.map(x => x ?? '.').join(','),
    )
  }
  return { columns, fields }
}

/**
 * Each record's INFO as `typedColumns` types it, `info` and `infoFields`, less
 * the consequence keys `consequenceTables` parses into `annotations`, each row
 * naming its record's index under `index`.
 */
function infoColumns(
  records: readonly Feature[],
  declarations: Declarations,
  index: 'variant' | 'feature',
) {
  const consequences = consequenceTables(records, declarations, index)
  const parsed = new Set(consequences.annotationFields.key)
  const { columns, fields } = typedColumns(
    records.map(r => {
      const info = r.get('INFO') as Record<string, FieldValue> | undefined
      return info && parsed.size
        ? Object.fromEntries(
            Object.entries(info).filter(([key]) => !parsed.has(key)),
          )
        : info
    }),
    {
      declared: declarations.declared.filter(key => !parsed.has(key)),
      meta: declarations.meta,
    },
  )
  return { info: columns, infoFields: fields, ...consequences }
}

/** The INFO keys SnpEff (ANN) and VEP (CSQ) write a record's consequences under. */
const CONSEQUENCE_KEYS = ['ANN', 'CSQ']

/**
 * The fields a consequence key's header line names: VEP's after `Format:`,
 * SnpEff's after the description's colon, each `|`-separated.
 */
function consequenceFieldNames(description: string) {
  const at = description.indexOf('Format:')
  return description
    .slice(at >= 0 ? at + 'Format:'.length : description.indexOf(':') + 1)
    .replaceAll(/^[\s"']+|[\s"']+$/g, '')
    .split('|')
    .map(name => name.trim())
}

/**
 * Each record's index at its first listing in `records`, which list a record
 * crossing regions once per region.
 */
function firstListings(records: readonly Feature[]) {
  const first = new Map<string, number>()
  records.forEach((record, r) => {
    if (!first.has(record.id())) {
      first.set(record.id(), r)
    }
  })
  return [...first.values()]
}

/**
 * Each record's ANN or CSQ consequences as a table, a row per record and
 * consequence, once per record however many regions list it: `index` names
 * the record's first listing, `key` the INFO key, then a column per
 * field the key's header line names, in its order, each value as the record
 * writes it and null where empty. The header names the fields and types none,
 * so every one is text. `annotationFields` lists each key's fields. A key whose
 * header line names no fields stays in INFO.
 */
function consequenceTables(
  records: readonly Feature[],
  { meta }: Declarations,
  index: 'variant' | 'feature',
) {
  const rows: number[] = []
  const keys: string[] = []
  const columns: Record<string, (string | null)[]> = {}
  const annotationFields = { key: [] as string[], field: [] as string[] }
  const listed = firstListings(records)
  for (const key of CONSEQUENCE_KEYS) {
    const names = consequenceFieldNames(
      String(declarationOf(meta, key, 'Description') ?? ''),
    )
    if (names.length < 2) {
      continue
    }
    for (const name of names) {
      columns[name] ??= rows.map(() => null)
      annotationFields.key.push(key)
      annotationFields.field.push(name)
    }
    for (const r of listed) {
      const info = records[r]!.get('INFO') as
        | Record<string, unknown>
        | undefined
      const entries = info?.[key]
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (typeof entry === 'string' && entry !== '') {
          const parts = entry.split('|')
          rows.push(r)
          keys.push(key)
          for (const column of Object.values(columns)) {
            column.push(null)
          }
          names.forEach((name, i) => {
            const value = parts[i]?.trim()
            columns[name]![rows.length - 1] = value ? value : null
          })
        }
      }
    }
  }
  return {
    annotations: { [index]: rows, key: keys, ...columns },
    annotationFields,
  }
}

/** The adapters a VCF reads through, whose records `variantRecordTables` serves. */
export const VCF_ADAPTER_TYPES = [
  'VcfAdapter',
  'VcfTabixAdapter',
  'SplitVcfTabixAdapter',
]

/**
 * #api
 * The VCF columns of the records a feature table lists, by its `features.id`,
 * for a host drawing a VCF as the plain variant display does, which draws
 * every record, a record calling no genotype included:
 * - `records`: each one's `ref`, `alt` (its alleles joined by `,`) and
 *   `filter`, aligned to `ids`.
 * - `info` and `infoFields`: its INFO, as `variantTables` gives them.
 * - `samples`: a row per record and each sample its own file lists, in that
 *   file's header order (a split VCF's per-contig files may differ), `feature` (an
 *   index into `ids`) and `sample`; `format`, a column per FORMAT key aligned
 *   to it, typed as INFO is; and `formatFields`, each key's declaration.
 * - `annotations` and `annotationFields`: its ANN or CSQ consequences, as
 *   `variantTables` gives them, `feature` an index into `ids`.
 *
 * A record `ids` lists more than once, as a feature table lists one crossing
 * regions in each, has its `samples` and `annotations` rows once, `feature`
 * its first index.
 */
export async function variantRecordTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    regions,
    ids,
  }: {
    adapterConfig: Record<string, unknown>
    sequenceAdapter?: Record<string, unknown>
    regions: { refName: string; start: number; end: number }[]
    ids: readonly string[]
  },
) {
  const adapter = await tablesFeatureAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  const fetched = await fetchVariantFeatures(
    adapter,
    regions.map(r => ({ assemblyName: '', ...r })),
    {},
  )
  const byId = new Map(fetched.map(f => [f.id(), f]))
  const records = ids.map(id => {
    const record = byId.get(id)
    if (!record) {
      throw new Error(`no VCF record ${id} in the regions read`)
    }
    return record
  })
  const declarations = await vcfDeclarationsOf(adapter)
  const samples = { feature: [] as number[], sample: [] as string[] }
  const sampleValues: Record<string, FieldValue>[] = []
  for (const f of firstListings(records)) {
    const values = records[f]!.get('samples') as
      | Record<string, Record<string, FieldValue>>
      | undefined
    for (const [sample, value] of Object.entries(values ?? {})) {
      samples.feature.push(f)
      samples.sample.push(sample)
      sampleValues.push(value)
    }
  }
  const format = typedColumns(sampleValues, declarations.format)
  return {
    records: {
      ref: records.map(r => String(r.get('REF') ?? '')),
      alt: records.map(r =>
        ((r.get('ALT') as string[] | undefined) ?? []).join(','),
      ),
      filter: records.map(filterOf),
    },
    ...infoColumns(records, declarations.info, 'feature'),
    samples,
    format: format.columns,
    formatFields: format.fields,
  }
}

/**
 * A cell's dosage as the display's clustering reads its genotype: a
 * sample's share of its called alleles that are any ALT, or under
 * `haplotype` that haplotype's allele, 1 for an ALT and 0 for the reference.
 * null where nothing was called, and for a haplotype of an unphased call,
 * which says a sample carries an ALT but not on which haplotype: null, not
 * NaN, so a JSON host reads what the engine answers.
 */
function cellDosage(
  genotype: string,
  numAlts: number,
  haplotype: number | undefined,
  ploidy: number,
) {
  let dosage = 0
  if (haplotype !== undefined) {
    const out = new Float32Array(Math.max(ploidy, haplotype + 1))
    readPhasedAlleleIndicators(genotype, 0, genotype.length, out, 0, ploidy)
    dosage = out[haplotype]!
  } else if (numAlts > 0) {
    const out = new Float32Array(numAlts)
    readAltDosages(genotype, 0, genotype.length, out, 0, numAlts)
    dosage = out.reduce((sum, d) => sum + d, 0) / 2
  } else if (!/\d/.test(genotype)) {
    return null
  }
  return Number.isNaN(dosage) ? null : dosage
}

/**
 * #api
 * Each record's alpha factor where records too short to see share pixels at
 * `bpPerPx`, as the variant display fades a zoomed-out row
 * (`recordDensityAlpha`) at the power of two `bpPerPx` rounds to: 1 where a
 * record covers its pixels alone. For a host that draws the cells at its own
 * scale.
 */
export function variantDensityAlpha({
  start,
  end,
  bpPerPx,
}: {
  start: readonly number[]
  end: readonly number[]
  bpPerPx: number
}) {
  const positions = new Uint32Array(start.length * 2)
  for (let f = 0; f < start.length; f++) {
    positions[2 * f] = start[f]!
    positions[2 * f + 1] = end[f]!
  }
  const alpha = recordDensityAlpha(positions, densityRung(bpPerPx))
  return alpha ? Array.from(alpha) : start.map(() => 1)
}

export type VariantTables = Awaited<ReturnType<typeof variantTables>>

/**
 * #api
 * The matrix the variant display's "Cluster rows by genotype" clusters, over
 * the records and rows `variantTables` gives for the same args
 * (`genotypeMatrixOf`): `rows`, named and ordered as its `rows`; `columns`,
 * each record in `variants.key` order, its key as `variant`, and its `name`,
 * that key 1-based. With a row per sample, a record takes a column per ALT,
 * `allele` its 1-based index and named `<key>.<allele>` where it has several,
 * scored 0 to 2 as twice that allele's share of the called alleles
 * (`readAltDosages`); with a row per haplotype, one column, `allele` 0, 1
 * where the haplotype carries any ALT. `values` holds them row-major, NaN for
 * a no-call, an unphased call's haplotype, and a sample the record's file
 * does not list.
 */
export async function variantGenotypeMatrix(
  pluginManager: PluginManager,
  variantArgs: VariantTablesArgs,
) {
  const { args, value, perRegion, recordOf, drawn } = await fetchedVariantHost(
    pluginManager,
    variantArgs,
  )
  const keyed = new Map<string, Feature>()
  for (const { data, shown } of perRegion) {
    for (const f of shown) {
      const id = data.featureInfo[f]!.featureId
      if (!keyed.has(id)) {
        keyed.set(id, recordOf.get(id)!)
      }
    }
  }
  const records = [...keyed.values()]
  const phased = args.rowsField === 'haplotype'
  const matrix = await genotypeMatrixOf(matrixWalkOf(records, {}), {
    sources: drawn,
    rowsField: args.rowsField,
    samplePloidy: value.samplePloidy,
  })
  const columns = {
    name: [] as string[],
    variant: [] as number[],
    allele: [] as number[],
  }
  records.forEach((record, key) => {
    const alleles = phased ? 0 : altColumnCount(record)
    if (alleles < 2) {
      columns.name.push(String(key + 1))
      columns.variant.push(key)
      columns.allele.push(alleles)
    } else {
      for (let allele = 1; allele <= alleles; allele++) {
        columns.name.push(`${key + 1}.${allele}`)
        columns.variant.push(key)
        columns.allele.push(allele)
      }
    }
  })
  const width = columns.name.length
  const values = new Float32Array(drawn.length * width)
  drawn.forEach(({ name }, row) => {
    values.set(matrix.get(name)!, row * width)
  })
  return { rows: drawn.map(row => row.name), columns, values }
}

export type VariantGenotypeMatrix = Awaited<
  ReturnType<typeof variantGenotypeMatrix>
>
