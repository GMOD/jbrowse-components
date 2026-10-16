import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { tablesFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { overByteBudget, totalRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { capitalizeFirst } from '@jbrowse/core/util'
import { abgrToHex, cssColorToHex } from '@jbrowse/core/util/colorBits'
import {
  CATEGORICAL_FIELD_PRESETS,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import {
  colorEncodingOf,
  paintedColorEncoding,
  pairedColorsOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import {
  arrangeRows,
  bandRows,
  orderRowsByDomain,
} from '@jbrowse/tree-sidebar/arrangeRows'
import { keptRows } from '@jbrowse/tree-sidebar/clusterUtils'
import { liftRowColor } from '@jbrowse/tree-sidebar/rowColorChoice'
import {
  dealtValueColors,
  resolveRowColors,
  rowColorKeyEntries,
  rowFieldValue,
} from '@jbrowse/tree-sidebar/rowColorScale'

import configSchemaFactory from './LinearMultiSampleVariantDisplay/configSchema.ts'
import {
  densityRung,
  recordDensityAlpha,
} from './LinearMultiSampleVariantDisplay/densityFade.ts'
import {
  paintCellColors,
  paintFeatureColors,
  paintedColorKeys,
} from './LinearMultiSampleVariantDisplay/paintCells.ts'
import { getVariantColorScales } from './LinearMultiSampleVariantDisplay/variantLegend.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import { variantCellData } from './VariantRPC/executeVariantCellData.ts'
import { fetchVariantFeatures } from './VariantRPC/fetchVariantFeatures.ts'
import {
  readAltDosages,
  readPhasedAlleleIndicators,
} from './VariantRPC/genotypeMatrixEncoding.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'
import { cellHueOf } from './shared/cellHue.ts'
import { buildSampleIndex, decodeGenotype } from './shared/genotypeCodec.ts'
import {
  expandPhasedRows,
  resolveSampleName,
  rowAliasOf,
} from './shared/getSources.ts'

import type { VariantUnit } from './shared/constants.ts'
import type { ProcessedSource } from './shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type { Feature } from '@jbrowse/core/util'
import type { RowAlias } from '@jbrowse/tree-sidebar/arrangeRows'

type DisplayConf = ReturnType<ReturnType<typeof configSchemaFactory>['create']>

/** Registers the adapters `variantTables` reads through: VCF, tabixed or not. */
export function registerVariantAdapters(pluginManager: PluginManager) {
  VcfAdapterF(pluginManager)
  VcfTabixAdapterF(pluginManager)
  SplitVcfTabixAdapterF(pluginManager)
}

interface VariantRegion {
  refName: string
  start: number
  end: number
}

export interface VariantTablesArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, which a reference-reading file is keyed on. */
  sequenceAdapter?: Record<string, unknown>
  /** One region, read as `regions: [region]`. */
  region?: VariantRegion
  /**
   * Several regions read as a view lays them side by side: one set of rows
   * and one key across them. A record crossing regions is listed in each.
   */
  regions?: VariantRegion[]
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearMultiSampleVariantDisplay`: `color`, `unit` (`'allele'` or
   * `'haplotype'`), `filter`, `minorAlleleFrequencyFilter`,
   * `maxMissingnessFilter`, `referenceDrawingMode`, `shadeByDosage`, the
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

const DEFAULT_BYTE_LIMIT = 200_000_000

/** A categorical key's swatches; a ramp keys through `rampKeyOf`. */
function legendOf(scales: ColorScale[]) {
  const label: string[] = []
  const color: string[] = []
  const section: string[] = []
  for (const scale of scales) {
    if (scale.kind === 'categorical') {
      for (const entry of scale.entries) {
        if (entry.color !== undefined && !entry.hidden) {
          label.push(entry.label)
          color.push(cssColorToHex(entry.color))
          section.push(scale.title ?? '')
        }
      }
    }
  }
  return { label, color, section }
}

/**
 * #api
 * A region of a multi-sample VCF as the multi-sample variant display fetches,
 * filters and paints it, as tables: `variants`, each record the display
 * keeps, with its lane color and its `filter`; `info`, each INFO key's
 * values aligned to `variants`, and `infoFields`, the header's declaration
 * of each key; `annotations`, each record's SnpEff `ANN` or VEP `CSQ`
 * consequences, a row per record and consequence, which then leave `info`
 * (`consequenceTables`); `cells`, each sample's (or under
 * `unit: 'haplotype'` each haplotype's) cell at each record, with its
 * genotype, its `dosage` and the fill the display paints it; `rows`, the
 * rows the cells name, top to bottom as the display arranges them by `rows`
 * and stacks them in `facet`'s bands, each with its label and band; `bands`,
 * each band's value, label and the rows it spans; and `legend` and `ramps`,
 * the key the display shows. Under `referenceDrawingMode: 'skip'`, the default,
 * a reference call draws no cell. Several regions share the rows and the key,
 * as the display's regions do: a record crossing regions is listed in each,
 * under one `key`, every `variants` and `cells` row names its `region`'s
 * index, and `cells.variant` indexes the joined `variants`. For a host that
 * draws them itself, such as R through V8. The adapters must be registered on
 * `pluginManager` (`registerVariantAdapters`).
 */
export async function variantTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    region,
    regions = region ? [region] : [],
    display = {},
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: VariantTablesArgs,
) {
  if (regions.length === 0) {
    throw new Error('variantTables reads a region, or regions')
  }
  const conf = configSchemaFactory().create({
    ...display,
    type: 'LinearMultiSampleVariantDisplay',
    displayId: 'tables',
  })
  const colorSetting = {
    value: readConfObject(conf.color, 'value'),
    field: readConfObject(conf.color, 'field'),
    scale: readConfObject(conf.color, 'scale'),
    domain: readConfObject(conf.color, 'domain'),
    range: readConfObject(conf.color, 'range'),
    labels: readConfObject(conf.color, 'labels'),
    title: readConfObject(conf.color, 'title'),
  }
  const encoding = colorEncodingOf(colorSetting)
  const slots: HeldSlots | undefined =
    typeof encoding === 'object' && encoding.scale === 'categorical'
      ? new Map()
      : undefined
  const cellHue = cellHueOf(
    paintedColorEncoding(encoding),
    colorSetting.field,
    slots,
  )
  const unit: VariantUnit = readConfObject(conf, 'unit')
  const shade: boolean = readConfObject(conf, 'shadeByDosage')
  const filters: string[] = readConfObject(conf, 'filter')
  const arrangement = {
    domain: readConfObject(conf.rows, 'domain'),
    labels: readConfObject(conf.rows, 'labels'),
    kept: readConfObject(conf.rows, 'kept'),
  }
  const adapter = await tablesFeatureAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  const fetchRegions = regions.map(r => ({ assemblyName: '', ...r }))
  const several = regions.length > 1
  const tooLarge = (bytes: number | undefined) =>
    new Error(
      `${regions.map(r => `${r.refName}:${r.start}-${r.end}`).join(', ')} ${several ? 'need' : 'needs'} ${bytes} bytes of variants${several ? ' in total' : ''}, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
    )
  const bytes = await totalRegionBytes(adapter, fetchRegions)
  if (overByteBudget(bytes, byteLimit)) {
    throw tooLarge(bytes)
  }
  const sources: ProcessedSource[] = (await adapter.getSources([])).map(
    source => ({ ...source, sampleName: resolveSampleName(source) }),
  )
  const rowAlias = rowAliasOf(sources)
  const args: RpcExecuteArgs<'MultiSampleVariantGetCellData'> = {
    sessionId: 'tables',
    adapterConfig,
    regions: fetchRegions,
    layout: 'genomic',
    unit,
    color: cellHue.read,
    sampleFilter: arrangement.kept.length
      ? keptRows(sources, arrangement.kept, rowAlias)
          .map(resolveSampleName)
          .sort()
      : undefined,
    referenceDrawingMode: readConfObject(conf, 'referenceDrawingMode'),
    minorAlleleFrequencyFilter: readConfObject(
      conf,
      'minorAlleleFrequencyFilter',
    ),
    maxMissingnessFilter: readConfObject(conf, 'maxMissingnessFilter'),
    filters: filters.length
      ? new SerializableFilterChain({ filters, jexl: pluginManager.jexl })
      : undefined,
    statusCallback: () => {},
  }
  const result = await variantCellData({ pluginManager, args })
  if ('regionTooLarge' in result) {
    throw tooLarge(result.bytes)
  }
  const value = result.value
  const perRegion = regions.flatMap((_, i) => {
    const data = value.perRegionCellData[i]
    return data ? [{ region: i, data }] : []
  })
  const recordOf = new Map(result.records.map(r => [r.id(), r]))
  const records = perRegion.flatMap(({ data }) =>
    data.featureInfo.map(info => recordOf.get(info.featureId)!),
  )

  const sampleIndex = buildSampleIndex(value.sampleNames)
  const expanded =
    unit === 'haplotype'
      ? expandPhasedRows({
          rows: sources,
          ploidy: value.samplePloidy,
          domain: arrangement.domain,
        })
      : sources
  const fetched = new Set(value.rowNames)
  const arranged = keptRows(
    arrangeRows(expanded, arrangement, {
      unlistedRowsSort: 'source',
      rowAlias,
    }),
    arrangement.kept,
    rowAlias,
  ).filter(row => fetched.has(row.name))
  const facet = facetSettingOf({
    field: readConfObject(conf.facet, 'field'),
    domain: readConfObject(conf.facet, 'domain'),
  })
  const banded = facet
    ? bandRows(arranged, row => rowFieldValue(row, facet.field), facet)
    : { rows: arranged, bands: [] }
  const drawn = banded.rows
  const rowColor = rowColorsOf(
    conf,
    orderRowsByDomain(expanded, arrangement.domain, rowAlias),
    drawn,
    rowAlias,
  )
  const rows = {
    name: drawn.map(row => row.name),
    label: drawn.map(row => row.label ?? row.name),
    sample: drawn.map(row => row.sampleName),
    haplotype: drawn.map(row => row.HP ?? 0),
    ploidy: drawn.map(row => value.samplePloidy[row.sampleName] ?? 0),
    band: drawn.map(row => (facet ? rowFieldValue(row, facet.field) : '')),
    color: rowColor.colors,
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
  for (const { region: regionIndex, data } of perRegion) {
    const offset = variants.start.length
    const laneColors = paintFeatureColors(data, cellHue, true)
    data.featureInfo.forEach((info, f) => {
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
      variants.color.push(abgrToHex(laneColors[f]!))
      variants.region.push(regionIndex)
      variants.key.push(keys.get(info.featureId)!)
    })
    const colors = paintCellColors(data, cellHue, {
      phased: unit === 'haplotype',
      shade,
      valuesRead: true,
    })
    for (let i = 0; i < data.numCells; i++) {
      const f = data.cellFeatureIndices[i]!
      const name = value.rowNames[data.cellRowIndices[i]!]!
      const row = rowIndex.get(name)
      if (row === undefined) {
        continue
      }
      cells.variant.push(offset + f)
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
          unit === 'haplotype' ? rows.haplotype[row]! : undefined,
          rows.ploidy[row]!,
        ),
      )
      cells.color.push(abgrToHex(colors[i]!))
      cells.region.push(regionIndex)
    }
  }

  const scales = getVariantColorScales({
    unit,
    hasSecondaryAlt: value.hasSecondaryAlt,
    hasAltWithoutPhaseSet: value.hasAltWithoutPhaseSet,
    hasUnphased: value.hasUnphased,
    hasNoCall: value.hasNoCall,
    paintedDomain: paintedColorKeys(
      perRegion.map(({ data }) => data),
      cellHue,
    ),
    shadeByDosage: shade,
    color: encoding,
    colorSlots: slots,
    colorTitle: withPreset(colorSetting, CATEGORICAL_FIELD_PRESETS).title,
  })
  return {
    variants,
    ...infoColumns(records, (await vcfHeaderOf(adapter)).info, 'variant'),
    cells,
    rows,
    legend: legendOf(scales),
    ramps: scales.filter(s => s.kind === 'ramp').map(rampKeyOf),
    rowLegend: rowColor.legend,
    rowLegendTitle: rowColor.title,
    bands: {
      key: banded.bands.map(b => b.key),
      label: banded.bands.map(b => b.label),
      start: banded.bands.map(b => b.start),
      end: banded.bands.map(b => b.end),
    },
    config: fullConfSnapshot(conf),
    warnings: [] as string[],
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

interface FieldDeclaration {
  Number?: unknown
  Type?: unknown
  Description?: unknown
}

interface Declarations {
  declared: string[]
  meta: Record<string, FieldDeclaration | undefined>
}

interface VcfHeader {
  info: Declarations
  format: Declarations
  samples: string[]
}

async function vcfHeaderOf(adapter: object): Promise<VcfHeader> {
  const vcf = adapter as {
    getHeader?: () => Promise<string>
    getMetadata?: () => Promise<
      Partial<Record<'INFO' | 'FORMAT', Declarations['meta']>>
    >
  }
  const header = (await vcf.getHeader?.()) ?? ''
  const metadata = await vcf.getMetadata?.()
  const declared = (field: string) =>
    [...header.matchAll(new RegExp(`^##${field}=<ID=([^,>]+)`, 'gm'))].map(
      m => m[1]!,
    )
  const columns = header
    .split('\n')
    .find(line => line.startsWith('#CHROM'))
    ?.trimEnd()
    .split('\t')
  return {
    info: { declared: declared('INFO'), meta: metadata?.INFO ?? {} },
    format: { declared: declared('FORMAT'), meta: metadata?.FORMAT ?? {} },
    samples: columns?.slice(9) ?? [],
  }
}

type FieldValue = true | (string | number | undefined)[] | undefined

/**
 * Each key's values, one per row, typed by the key's header line: a flag as
 * a boolean, false where the row lacks it; a `Number=1` key as its value; any
 * other `Number` (`A`, `R`, `G`, `.`, 2) as an array, an entry per value. A
 * row lacking a non-flag key, or giving `.`, has null. The keys are the
 * header's, in its order, then any other a row uses, typed as the VCF spec
 * reserves it, else read as a flag where every use is bare and as a
 * `Number=.` string otherwise. `fields` lists each key's declaration.
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
    const declaration = meta[key]
    const bare = values.every(v => v === undefined || v === true)
    const type = String(declaration?.Type ?? (bare ? 'Flag' : 'String'))
    const number = String(declaration?.Number ?? (type === 'Flag' ? 0 : '.'))
    const numeric = type === 'Integer' || type === 'Float'
    fields.key.push(key)
    fields.number.push(number)
    fields.type.push(type)
    fields.description.push(String(declaration?.Description ?? ''))
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
 * Each record's ANN or CSQ consequences as a table, a row per record and
 * consequence: `index` names the record, `key` the INFO key, then a column per
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
  for (const key of CONSEQUENCE_KEYS) {
    const names = consequenceFieldNames(String(meta[key]?.Description ?? ''))
    if (names.length < 2) {
      continue
    }
    for (const name of names) {
      columns[name] ??= rows.map(() => null)
      annotationFields.key.push(key)
      annotationFields.field.push(name)
    }
    records.forEach((record, r) => {
      const info = record.get('INFO') as Record<string, unknown> | undefined
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
    })
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
 * - `samples`: a row per record and sample in header order, `feature` (an
 *   index into `ids`) and `sample`; `format`, a column per FORMAT key aligned
 *   to it, typed as INFO is; and `formatFields`, each key's declaration.
 * - `annotations` and `annotationFields`: its ANN or CSQ consequences, as
 *   `variantTables` gives them, `feature` an index into `ids`.
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
  const header = await vcfHeaderOf(adapter)
  const samples = { feature: [] as number[], sample: [] as string[] }
  const sampleValues: (Record<string, FieldValue> | undefined)[] = []
  records.forEach((record, f) => {
    const values = record.get('samples') as
      | Record<string, Record<string, FieldValue>>
      | undefined
    for (const sample of header.samples) {
      samples.feature.push(f)
      samples.sample.push(sample)
      sampleValues.push(values?.[sample])
    }
  })
  const format = typedColumns(sampleValues, header.format)
  return {
    records: {
      ref: records.map(r => String(r.get('REF') ?? '')),
      alt: records.map(r =>
        ((r.get('ALT') as string[] | undefined) ?? []).join(','),
      ),
      filter: records.map(filterOf),
    },
    ...infoColumns(records, header.info, 'feature'),
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
  }
  return Number.isNaN(dosage) ? null : dosage
}

/**
 * Each row's label-bar color as the display resolves it: the `rowColor`
 * field's value for the row's sample in the samples file, dealt the row
 * palette over `dealRows`, the rows in the config's order, else the sample's
 * own `color`, else `''`; and the key the display shows for an attribute.
 */
function rowColorsOf(
  conf: DisplayConf,
  dealRows: readonly ProcessedSource[],
  drawn: readonly ProcessedSource[],
  rowAlias: RowAlias,
) {
  const setting = liftRowColor({
    field: readConfObject(conf.rowColor, 'field'),
    domain: readConfObject(conf.rowColor, 'domain'),
    range: readConfObject(conf.rowColor, 'range'),
    unknown: readConfObject(conf.rowColor, 'unknown'),
  })
  const dealt = dealtValueColors(setting, () => dealRows, false)
  const resolved = resolveRowColors(dealRows, setting.field, dealt, rowAlias)
  const attribute = setting.field === 'name' ? '' : setting.field
  const entries = attribute
    ? rowColorKeyEntries(
        dealRows,
        { setting, pairs: pairedColorsOf(setting), dealt, resolved },
        name => name,
      )
    : []
  return {
    colors: drawn.map(row => resolved.get(row.name) ?? ''),
    legend: {
      label: entries.map(e => e.label),
      color: entries.map(e => e.color ?? ''),
    },
    title: attribute ? capitalizeFirst(attribute) : '',
  }
}

/**
 * #api
 * Each record's alpha factor where records too short to see share pixels at
 * `bpPerPx`, as the multi-sample variant display fades a zoomed-out row
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
