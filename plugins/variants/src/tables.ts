import { readConfObject } from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
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
import { liftRowColor } from '@jbrowse/tree-sidebar/rowColorChoice'
import {
  dealtValueColors,
  resolveRowColors,
  rowColorKeyEntries,
} from '@jbrowse/tree-sidebar/rowColorScale'

import configSchemaFactory from './LinearMultiSampleVariantDisplay/configSchema.ts'
import {
  paintCellColors,
  paintFeatureColors,
  paintedColorKeys,
} from './LinearMultiSampleVariantDisplay/paintCells.ts'
import { getVariantColorScales } from './LinearMultiSampleVariantDisplay/variantLegend.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import { executeVariantCellData } from './VariantRPC/executeVariantCellData.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'
import { cellHueOf } from './shared/cellHue.ts'
import { buildSampleIndex, decodeGenotype } from './shared/genotypeCodec.ts'
import { parseRowName } from './shared/getSources.ts'

import type { VariantUnit } from './shared/constants.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { HeldSlots } from '@jbrowse/core/ui/colors'

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
   * `maxMissingnessFilter`, `referenceDrawingMode`, `shadeByDosage` and the
   * rest of its slots. Unset reads the default display.
   */
  display?: Record<string, unknown>
  /**
   * The most compressed bytes the region may need, refused off the index
   * before any record is fetched.
   */
  byteLimit?: number
}

const DEFAULT_BYTE_LIMIT = 200_000_000

/** A categorical key's swatches; a ramp keys no legend yet. */
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
 * genotype, its alt dosage and the fill the display paints it,
 * `shade(hue, dosage)`; `rows`, the rows the cells name; and `legend`, the
 * key the display shows. Under `referenceDrawingMode: 'skip'`, the default,
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
  const args: RpcExecuteArgs<'MultiSampleVariantGetCellData'> = {
    sessionId: 'tables',
    adapterConfig,
    regions: [{ assemblyName: '', ...region }],
    layout: 'genomic',
    unit,
    color: cellHue.read,
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

  const samples = new Set(value.sampleNames)
  const sampleIndex = buildSampleIndex(value.sampleNames)
  const rowsParsed = value.rowNames.map(name => parseRowName(name, samples))
  const rowSamples = rowsParsed.map(
    (r, i) => r?.sampleName ?? value.rowNames[i]!,
  )
  const rowColor = await rowColorsOf(
    pluginManager,
    adapterConfig,
    conf,
    value.rowNames,
    rowSamples,
  )
  const rows = {
    name: value.rowNames,
    sample: rowSamples,
    haplotype: rowsParsed.map(r => r?.HP ?? 0),
    ploidy: rowsParsed.map(r => value.samplePloidy[r?.sampleName ?? ''] ?? 0),
    color: rowColor.colors,
  }

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
    dosage: [] as number[],
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
      const row = data.cellRowIndices[i]!
      cells.variant.push(f)
      cells.row.push(value.rowNames[row]!)
      cells.genotype.push(
        decodeGenotype(
          value.genotypeDict,
          sampleIndex,
          data.featureInfo[f]!.genotypeCodes,
          rows.sample[row]!,
        ) ?? '',
      )
      cells.dosage.push(data.cellAltDosage[i]! / 255)
      cells.color.push(abgrToHex(colors[i]!))
    }
  }

  const legend = legendOf(
    getVariantColorScales({
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
    }),
  )
  return {
    variants,
    cells,
    rows,
    legend,
    rowLegend: rowColor.legend,
    rowLegendTitle: rowColor.title,
  }
}

/**
 * Each row's label-bar color as the display resolves it: the `rowColor`
 * field's value for the row's sample in the samples file, dealt the row
 * palette, else the sample's own `color`, else `''`; and the key the display
 * shows for an attribute.
 */
async function rowColorsOf(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  conf: ReturnType<ReturnType<typeof configSchemaFactory>['create']>,
  rowNames: readonly string[],
  rowSamples: readonly string[],
) {
  const adapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId: 'tables',
    adapterConfig,
  })
  const bySample = new Map(
    (await adapter.getSources([])).map(source => [source.name, source]),
  )
  const sources = rowNames.map((name, i) => ({
    ...bySample.get(rowSamples[i]!),
    name,
  }))
  const setting = liftRowColor({
    field: readConfObject(conf.rowColor, 'field'),
    domain: readConfObject(conf.rowColor, 'domain'),
    range: readConfObject(conf.rowColor, 'range'),
    unknown: readConfObject(conf.rowColor, 'unknown'),
  })
  const dealt = dealtValueColors(setting, () => sources, false)
  const resolved = resolveRowColors(sources, setting.field, dealt, undefined)
  const attribute = setting.field === 'name' ? '' : setting.field
  const entries = attribute
    ? rowColorKeyEntries(
        sources,
        { setting, pairs: pairedColorsOf(setting), dealt, resolved },
        name => name,
      )
    : []
  return {
    colors: rowNames.map(name => resolved.get(name) ?? ''),
    legend: {
      label: entries.map(e => e.label),
      color: entries.map(e => e.color ?? ''),
    },
    title: attribute ? capitalizeFirst(attribute) : '',
  }
}

export type VariantTables = Awaited<ReturnType<typeof variantTables>>
