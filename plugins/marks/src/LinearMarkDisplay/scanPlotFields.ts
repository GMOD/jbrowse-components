import { MAX_LEGEND_ITEMS } from '@jbrowse/core/ui/legendSpec'
import { matedBy } from '@jbrowse/core/util/featureTransforms'
import { censusFields, isRecord } from '@jbrowse/core/util/fieldCensus'

import type { Feature } from '@jbrowse/core/util'
import type { FieldSummary } from '@jbrowse/core/util/fieldCensus'

export const PLOT_FIELD_SAMPLE = 200

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
  /** The genomes the features align to, where they are genome alignments. */
  genomes?: string[]
  /**
   * How the scanned features state a second locus, where any of them do: the
   * `mate` a paired adapter filled, or a breakend or symbolic `ALT`.
   */
  mated?: 'mate' | 'alt' | 'pair'
  /** Every scanned feature carries SAM `flags`: they are aligned reads. */
  reads?: true
  /** The scan read no features, so it decides no default plot. */
  empty?: true
}

function namesOf(fields: readonly FieldSummary[]) {
  return fields.map(f => f.field).sort()
}

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
  const genomes = new Set<string>()
  for (const feature of sample) {
    if (mated !== 'mate') {
      mated = matedBy(feature) ?? mated
    }
    reads &&= typeof feature.get('flags') === 'number'
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
    ...(genomes.size > 0 ? { genomes: [...genomes].sort() } : {}),
    ...(mated === undefined ? {} : { mated }),
    ...(reads ? { reads: true as const } : {}),
    ...(features.length === 0 ? { empty: true as const } : {}),
  }
}
