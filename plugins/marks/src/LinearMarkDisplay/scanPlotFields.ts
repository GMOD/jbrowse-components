import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'
import {
  BED_COLOR_FIELDS,
  featureBedColor,
  featureItemRgb,
} from '@jbrowse/core/util/colorBits'
import { matedBy } from '@jbrowse/core/util/featureTransforms'
import { censusFields, isRecord } from '@jbrowse/core/util/fieldCensus'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'

import { isRowField } from './rowFields.ts'

import type { Feature } from '@jbrowse/core/util'
import type { FieldCensus, FieldSummary } from '@jbrowse/core/util/fieldCensus'

export const PLOT_FIELD_SAMPLE = 200

// A bigBed's uint color column parses to UCSC's packed 0xRRGGBB, where 0 is
// unset rather than black.
function statesBedColor(feature: Feature) {
  return (
    featureBedColor(feature) !== undefined ||
    BED_COLOR_FIELDS.some(field => {
      const v = feature.get(field)
      return typeof v === 'number' && v > 0 && !!featureItemRgb(v, true)
    })
  )
}

// What a feature is called rather than a value it carries: a plot of `name`
// says nothing, and `CHROM` and `POS` are a VCF record's position again.
const NOT_PLOTTED = new Set([
  'type',
  'name',
  'id',
  'description',
  'CHROM',
  'POS',
])

// A code, not a quantity: +1 and -1 want a palette and never a ramp.
const ALWAYS_CATEGORICAL = new Set(['strand'])

const ROWS_FIELD = 'source'
const GENOME_FIELD = 'mate.assemblyName'

/** The fields an adapter writes onto a feature only under a fetch option. */
export type JoinedPlotFields = Pick<PlotFields, 'numeric' | 'categorical'>

/** The scanned fields with the joined ones a scan cannot find. */
export function withJoinedFields(
  scanned: PlotFields,
  joined: JoinedPlotFields,
): PlotFields {
  return {
    ...scanned,
    numeric: [...new Set([...scanned.numeric, ...joined.numeric])],
    categorical: [...new Set([...scanned.categorical, ...joined.categorical])],
  }
}

/** The plottable fields the scanned features carry, split by what they hold. */
export interface PlotFields {
  numeric: string[]
  /** Numeric fields fewer than half the scanned features carry. */
  sparse?: string[]
  /** Text fields few enough values apart that a color key can name them. */
  categorical: string[]
  /**
   * The field giving a row each: `source` where a multi-source adapter lists
   * more than one, or the mate's assembly where the features align to more
   * than one other genome.
   */
  rows?: string
  /**
   * The field whose values each hold features that never overlap, so each is
   * a lane: a painting's `sample`, a transcript's `name`.
   */
  lane?: string
  /** The genomes the features align to, where they are genome alignments. */
  genomes?: string[]
  /**
   * How the scanned features state a second locus, where any of them do: the
   * `mate` a paired adapter filled, or a breakend or symbolic `ALT`.
   */
  mated?: 'mate' | 'alt' | 'pair'
  /** Every scanned feature carries SAM `flags`: they are aligned reads. */
  reads?: true
  /**
   * Every field a scanned feature carries a value in besides its position
   * and its children, `name` and `type` included, by the path a channel reads
   * it: what a row or a color may be read from.
   */
  attributes?: string[]
  /**
   * A scanned feature's children have none of their own, as a BED12 row's
   * blocks and a transcript's exons do, so it draws as blocks joined by a
   * line.
   */
  spliced?: true
  /**
   * The `type`s a spliced feature's children carry, as a GFF3 transcript's
   * exons, CDS and the matches placed on it do.
   */
  childTypes?: string[]
  /** A scanned feature states its own BED color as an `r,g,b` triple. */
  bedColored?: true
  /** The scan read no features, so it decides no default plot. */
  empty?: true
}

// A feature's children where none has children of its own, else none: the
// blocks a spliced feature draws joined by a line
function splicedChildren(feature: Feature): Feature[] {
  const subfeatures = feature.get('subfeatures')
  return subfeatures?.length &&
    subfeatures.every(sub => !sub.get('subfeatures')?.length)
    ? subfeatures
    : []
}

function namesOf(fields: readonly FieldSummary[]) {
  return fields.map(f => f.field).sort()
}

// What a feature is called, which gives a row each only where nothing else does.
const NAME_FIELDS = new Set(['name', 'id'])

// The first `PLOT_FIELD_SAMPLE` features, each once: the scan's windows
// answer a feature spanning two of them twice.
function sampleOf(features: readonly Feature[]) {
  const byId = new Map<string, Feature>()
  for (const feature of features) {
    if (byId.size < PLOT_FIELD_SAMPLE) {
      byId.set(feature.id(), feature)
    }
  }
  return [...byId.values()]
}

// Whether the features sharing a value of `field` never overlap, read as the
// rows read it.
function holdsLanes(byStart: readonly Feature[], field: string) {
  const read = fieldReader(field, undefined)
  const ends = new Map<string, number>()
  return byStart.every(feature => {
    const lane = `${feature.get('refName')}\n${valueText(read(feature))}`
    const free = feature.get('start') >= (ends.get(lane) ?? -Infinity)
    ends.set(lane, feature.get('end'))
    return free
  })
}

// A row is a lane, so the row field is the one every feature carries, as text
// of more than one value, whose features never overlap within a value: a
// painting's `sample`, where its segment `name`s overlap across samples. Of
// several, the one of fewest values, a name only where nothing else is one,
// then the file's own column order.
function laneFieldOf(sample: readonly Feature[], { n, fields }: FieldCensus) {
  const byStart = [...sample].sort(
    (a, b) => a.get('start') - b.get('start') || a.get('end') - b.get('end'),
  )
  return fields
    .flatMap(({ field, carried, numeric, values }) =>
      numeric === false && carried === n && values && values.length > 1
        ? [{ field, count: values.length }]
        : [],
    )
    .filter(({ field }) => isRowField(field) && holdsLanes(byStart, field))
    .sort(
      (a, b) =>
        a.count - b.count ||
        Number(NAME_FIELDS.has(a.field)) - Number(NAME_FIELDS.has(b.field)),
    )[0]?.field
}

/**
 * What a sample of features says a plot of them can read: the census of their
 * fields (`censusFields`) split by what each holds, a text field a color
 * choice only where a key could name its values and a numeric one sparse where
 * most features lack it, then what the features are, read off the features
 * themselves. `source` is a facet only where the adapter lists more than one
 * source, since a GFF3 record's `source` column is not a file, and a
 * multi-BigWig answers each file's features in one run, so a sample would see
 * the first file alone.
 */
export function scanPlotFields(
  features: readonly Feature[],
  { listedSources }: { listedSources: number },
): PlotFields {
  const sample = sampleOf(features)
  let mated: PlotFields['mated']
  let reads = sample.length > 0
  let spliced = false
  const childTypes = new Set<string>()
  let bedColored = false
  const genomes = new Set<string>()
  for (const feature of sample) {
    if (mated !== 'mate') {
      mated = matedBy(feature) ?? mated
    }
    reads &&= typeof feature.get('flags') === 'number'
    const children = splicedChildren(feature)
    spliced ||= children.length > 0
    for (const child of children) {
      const type = child.get('type')
      if (typeof type === 'string') {
        childTypes.add(type)
      }
    }
    bedColored ||= statesBedColor(feature)
    const mate: unknown = feature.get('mate')
    if (isRecord(mate) && typeof mate.assemblyName === 'string') {
      genomes.add(mate.assemblyName)
    }
  }
  const census = censusFields(sample, PLOT_FIELD_SAMPLE)
  const plotted = census.fields.filter(f => !NOT_PLOTTED.has(f.field))
  const isNumeric = (f: FieldSummary) =>
    f.numeric === true && !ALWAYS_CATEGORICAL.has(f.field)
  const numeric = plotted.filter(isNumeric)
  const sparse = numeric.filter(f => f.carried * 2 < census.n)
  const lane = laneFieldOf(sample, census)
  return {
    numeric: namesOf(numeric),
    ...(sparse.length > 0 ? { sparse: namesOf(sparse) } : {}),
    categorical: namesOf(
      plotted.filter(
        f =>
          f.numeric !== undefined &&
          !isNumeric(f) &&
          f.values !== undefined &&
          f.values.length <= MAX_LEGEND_ITEMS,
      ),
    ),
    ...(listedSources > 1
      ? { rows: ROWS_FIELD }
      : genomes.size > 1
        ? { rows: GENOME_FIELD }
        : {}),
    ...(lane === undefined ? {} : { lane }),
    ...(genomes.size > 0 ? { genomes: [...genomes].sort() } : {}),
    ...(mated === undefined ? {} : { mated }),
    ...(reads ? { reads: true as const } : {}),
    ...(census.fields.length > 0 ? { attributes: namesOf(census.fields) } : {}),
    ...(spliced ? { spliced: true as const } : {}),
    ...(childTypes.size > 0 ? { childTypes: [...childTypes].sort() } : {}),
    ...(bedColored ? { bedColored: true as const } : {}),
    ...(features.length === 0 ? { empty: true as const } : {}),
  }
}
