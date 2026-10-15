import { readConfObject } from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
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
import { executeVariantCellData } from './VariantRPC/executeVariantCellData.ts'
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
import type { RowAlias } from '@jbrowse/tree-sidebar/arrangeRows'

type DisplayConf = ReturnType<ReturnType<typeof configSchemaFactory>['create']>

/** Registers the adapters `variantTables` reads through: VCF, tabixed or not. */
export function registerVariantAdapters(pluginManager: PluginManager) {
  VcfAdapterF(pluginManager)
  VcfTabixAdapterF(pluginManager)
  SplitVcfTabixAdapterF(pluginManager)
}

export interface VariantTablesArgs {
  adapterConfig: Record<string, unknown>
  region: { refName: string; start: number; end: number }
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
   * The most compressed bytes the region may need, refused off the index
   * before any record is fetched.
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
 * keeps, with its lane color; `cells`, each sample's (or under
 * `unit: 'haplotype'` each haplotype's) cell at each record, with its
 * genotype, its `dosage` and the fill the display paints it; `rows`, the
 * rows the cells name, top to bottom as the display arranges them by `rows`
 * and stacks them in `facet`'s bands, each with its label and band; `bands`,
 * each band's value, label and the rows it spans; and `legend` and `ramps`,
 * the key the display shows. Under `referenceDrawingMode: 'skip'`, the default,
 * a reference call draws no cell. For a host that draws them itself, such as
 * R through V8. The adapters must be registered on `pluginManager`
 * (`registerVariantAdapters`).
 */
export async function variantTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    region,
    display = {},
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: VariantTablesArgs,
) {
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
  const adapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId: 'tables',
    adapterConfig,
  })
  const sources: ProcessedSource[] = (await adapter.getSources([])).map(
    source => ({ ...source, sampleName: resolveSampleName(source) }),
  )
  const rowAlias = rowAliasOf(sources)
  const args: RpcExecuteArgs<'MultiSampleVariantGetCellData'> = {
    sessionId: 'tables',
    adapterConfig,
    regions: [{ assemblyName: '', ...region }],
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
    byteLimit,
    statusCallback: () => {},
  }
  const result = await executeVariantCellData({ pluginManager, args })
  if ('regionTooLarge' in result) {
    throw new Error(
      `${region.refName}:${region.start}-${region.end} needs ${result.bytes} bytes of variants, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
    )
  }
  const value = result.value
  const data = value.perRegionCellData[0]

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
  }
  const cells = {
    variant: [] as number[],
    row: [] as string[],
    genotype: [] as string[],
    dosage: [] as (number | null)[],
    color: [] as string[],
  }
  if (data) {
    const laneColors = paintFeatureColors(data, cellHue, true)
    data.featureInfo.forEach((info, f) => {
      variants.start.push(data.featurePositions[f * 2]!)
      variants.end.push(data.featurePositions[f * 2 + 1]!)
      variants.id.push(info.featureId)
      variants.name.push(info.name)
      variants.ref.push(info.ref)
      variants.alt.push(info.alt.join(','))
      variants.type.push(info.type)
      variants.color.push(abgrToHex(laneColors[f]!))
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
      cells.variant.push(f)
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
    }
  }

  const scales = getVariantColorScales({
    unit,
    hasSecondaryAlt: value.hasSecondaryAlt,
    hasAltWithoutPhaseSet: value.hasAltWithoutPhaseSet,
    hasUnphased: value.hasUnphased,
    hasNoCall: value.hasNoCall,
    paintedDomain: data ? paintedColorKeys([data], cellHue) : [],
    shadeByDosage: shade,
    color: encoding,
    colorSlots: slots,
    colorTitle: withPreset(colorSetting, CATEGORICAL_FIELD_PRESETS).title,
  })
  return {
    variants,
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
