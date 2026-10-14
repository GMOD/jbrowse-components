import { expandSourcesToHaplotypes } from '../shared/getSources.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import { siteSpanKey } from '../shared/siteSpanKey.ts'
import {
  MISSING,
  readPhasedAlleleIndicators,
} from './genotypeMatrixEncoding.ts'
import { prepareMatrixWalk } from './matrixWalk.ts'

import type { MatrixWalkArgs } from './matrixWalk.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// On a column several records share, an alt on any of them wins, then a called
// reference. A lone record writes straight through: merging every cell cost
// the build a measurable slowdown on a 1000 Genomes-sized panel.
function writeIndicator(
  row: Float32Array,
  column: number,
  value: number,
  shared: boolean,
) {
  if (!shared || value === 1 || (value === 0 && Number.isNaN(row[column]!))) {
    row[column] = value
  }
}

export async function getPhasedGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MatrixWalkArgs & { samplePloidy: Record<string, number> }
}) {
  const { sources, samplePloidy } = args
  // One entry per output row, through the `expandSourcesToHaplotypes` the cell
  // computation and the model's `sources` use, so the returned `order` lines up
  // with the caller's rows. A source already naming one haplotype contributes
  // that row alone.
  const rowSpecs = expandSourcesToHaplotypes({ sources, samplePloidy })

  const {
    filteredVariants,
    sampleIdxByKey,
    samplesLen,
    headerRemapOf,
    breakpoint,
    report,
  } = await prepareMatrixWalk({ pluginManager, args })

  // One column per site (`siteSpanKey`), as a multiallelic record's alts all
  // read as one indicator. With a column per record, two carriers of one
  // split-site inversion sat further apart than either sat from a non-carrier.
  const numFeatures = filteredVariants.length
  const siteColumnOf = new Int32Array(numFeatures)
  const recordsInColumn = new Int32Array(numFeatures)
  const columnByKey = new Map<string, number>()
  for (let f = 0; f < numFeatures; f++) {
    const feature = filteredVariants[f]!.feature
    const key = siteSpanKey(
      feature.get('refName'),
      feature.get('start'),
      feature.get('end'),
    )
    let siteColumn = columnByKey.get(key)
    if (siteColumn === undefined) {
      siteColumn = columnByKey.size
      columnByKey.set(key, siteColumn)
    }
    siteColumnOf[f] = siteColumn
    recordsInColumn[siteColumn]!++
  }
  // Float32 because a haplotype with nothing to say is NaN
  // (genotypeMatrixEncoding.ts)
  // Map, keyed in `rowSpecs` order — see getGenotypeMatrix.
  const rows = new Map<string, Float32Array>()
  const rowArrays = rowSpecs.map(spec => {
    const arr = new Float32Array(columnByKey.size).fill(MISSING)
    rows.set(spec.name, arr)
    return arr
  })

  // wide enough for every haplotype some row asks for, which for a pre-expanded
  // source is its own HP
  let maxPloidy = 1
  for (const spec of rowSpecs) {
    if (spec.HP + 1 > maxPloidy) {
      maxPloidy = spec.HP + 1
    }
  }
  const used = new Uint8Array(samplesLen)
  const rowSampleIdx = Int32Array.from(rowSpecs, spec => {
    const idx = sampleIdxByKey.get(spec.sampleName) ?? -1
    if (idx !== -1) {
      used[idx] = 1
    }
    return idx
  })
  const rowHp = Int32Array.from(rowSpecs, spec => spec.HP)
  // per-sample haplotype indicators for the feature being read, one flat buffer
  // laid out [sample0 hp0..hpN, sample1 hp0..hpN, ...]
  const indicators = new Float32Array(samplesLen * maxPloidy)
  const scratch = new Float32Array(maxPloidy)

  for (let f = 0; f < numFeatures; f++) {
    const feature = filteredVariants[f]!.feature
    const siteColumn = siteColumnOf[f]!
    const shared = recordsInColumn[siteColumn]! > 1
    if (hasProcessGenotypes(feature) && samplesLen > 0) {
      // @gmod/vcf skips the callback for a sample whose FORMAT fields stop
      // before GT
      indicators.fill(MISSING)
      const remap = headerRemapOf(feature)
      feature.processGenotypes((str, start, end, sampleIdx) => {
        const column = remap === undefined ? sampleIdx : remap[sampleIdx]!
        if (column >= 0 && column < samplesLen && used[column]) {
          readPhasedAlleleIndicators(
            str,
            start,
            end,
            indicators,
            column * maxPloidy,
            maxPloidy,
          )
        }
      })
      for (let k = 0; k < rowArrays.length; k++) {
        const idx = rowSampleIdx[k]!
        if (idx !== -1) {
          writeIndicator(
            rowArrays[k]!,
            siteColumn,
            indicators[idx * maxPloidy + rowHp[k]!]!,
            shared,
          )
        }
      }
    } else {
      // `?? {}` for the sites-only case — see getGenotypeMatrix.
      const genotypes =
        (feature.get('genotypes') as Record<string, string> | undefined) ?? {}
      // a sample's genotype is scanned once for each run of its adjacent rows
      let scannedKey: string | undefined
      for (let k = 0; k < rowArrays.length; k++) {
        const { sampleName: key, HP: hp } = rowSpecs[k]!
        if (key !== scannedKey) {
          const val = genotypes[key]
          readPhasedAlleleIndicators(
            val ?? '',
            0,
            val?.length ?? 0,
            scratch,
            0,
            maxPloidy,
          )
          scannedKey = key
        }
        writeIndicator(rowArrays[k]!, siteColumn, scratch[hp]!, shared)
      }
    }
    report(f)
    if (breakpoint.due()) {
      await breakpoint.yield()
    }
  }
  return rows
}
