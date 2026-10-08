import { resolveSampleName } from '../shared/getSources.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import { MISSING, readAltDosages } from './genotypeMatrixEncoding.ts'
import { prepareMatrixWalk } from './matrixWalk.ts'

import type { MatrixWalkArgs } from './matrixWalk.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function getGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MatrixWalkArgs
}) {
  // resolved once per source, not per (source, feature)
  const resolved = args.sources.map(s => ({
    name: s.name,
    key: resolveSampleName(s),
  }))
  const {
    filteredVariants,
    sampleIdxByKey,
    samplesLen,
    headerRemapOf,
    breakpoint,
    report,
  } = await prepareMatrixWalk({ pluginManager, args })

  // A site contributes one column per ALT allele (`readAltDosages`), so a
  // pre-pass sums the offsets and each row stays one pre-sized Float32Array.
  // Float32 because a no-call is NaN (genotypeMatrixEncoding.ts).
  const numFeatures = filteredVariants.length
  const altCounts = new Int32Array(numFeatures)
  const colOffsets = new Int32Array(numFeatures)
  let numCols = 0
  let maxAlts = 1
  for (let f = 0; f < numFeatures; f++) {
    const alt = filteredVariants[f]!.feature.get('ALT') as string[] | undefined
    // At least one column even for a record with no ALT listed: the genotypes
    // are still readable and an all-ref column is a real observation.
    const k = Math.max(1, alt?.length ?? 1)
    altCounts[f] = k
    colOffsets[f] = numCols
    numCols += k
    if (k > maxAlts) {
      maxAlts = k
    }
  }
  // A Map keyed in `resolved` order, which the cluster `order` indexes; a plain
  // object would renumber numeric sample IDs (see ClusterMatrix).
  const rows = new Map<string, Float32Array>()
  const rowArrays: Float32Array[] = []
  for (const r of resolved) {
    const arr = new Float32Array(numCols)
    rows.set(r.name, arr)
    rowArrays.push(arr)
  }

  // Per feature, processGenotypes fills a reusable dosage buffer indexed by
  // canonical sample column, with no Record and no substring; a feature
  // without it falls back to its genotypes Record.
  const used = new Uint8Array(samplesLen)
  // one slot per (sample, ALT) for the widest site, reused across every site
  const dosages = new Float32Array(samplesLen * maxAlts)
  const resolvedSampleIdx = resolved.map(r => {
    const idx = sampleIdxByKey.get(r.key) ?? -1
    if (idx !== -1) {
      used[idx] = 1
    }
    return idx
  })

  for (let f = 0; f < numFeatures; f++) {
    const feature = filteredVariants[f]!.feature
    const numAlts = altCounts[f]!
    const col = colOffsets[f]!
    if (hasProcessGenotypes(feature) && samplesLen > 0) {
      // @gmod/vcf skips the callback for a sample whose FORMAT fields stop
      // before GT, which would leave the previous feature's dosage in its slot
      dosages.fill(MISSING, 0, samplesLen * numAlts)
      const remap = headerRemapOf(feature)
      feature.processGenotypes((str, start, end, sampleIdx) => {
        const column = remap === undefined ? sampleIdx : remap[sampleIdx]!
        if (column >= 0 && column < samplesLen && used[column]) {
          readAltDosages(str, start, end, dosages, column * numAlts, numAlts)
        }
      })
      for (let k = 0; k < rowArrays.length; k++) {
        const idx = resolvedSampleIdx[k]!
        const row = rowArrays[k]!
        if (idx === -1) {
          for (let j = 0; j < numAlts; j++) {
            row[col + j] = MISSING
          }
        } else {
          const from = idx * numAlts
          for (let j = 0; j < numAlts; j++) {
            row[col + j] = dosages[from + j]!
          }
        }
      }
    } else {
      // a sites-only record has no `genotypes` field, and `readAltDosages`
      // reads '' as missing
      const genotypes =
        (feature.get('genotypes') as Record<string, string> | undefined) ?? {}
      for (let k = 0; k < resolved.length; k++) {
        const gt = genotypes[resolved[k]!.key] ?? ''
        readAltDosages(gt, 0, gt.length, rowArrays[k]!, col, numAlts)
      }
    }
    report(f)
    if (breakpoint.due()) {
      await breakpoint.yield()
    }
  }
  return rows
}
