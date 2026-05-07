import {
  methylated5hmC,
  methylated5mC,
  unmethylated5hmC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

import { parseCigar2 } from '../../MismatchParser/index.ts'
import { detectSimplexModifications } from '../../ModificationParser/detectSimplexModifications.ts'
import { getMethBins } from '../../ModificationParser/getMethBins.ts'
import { getModPositions } from '../../ModificationParser/getModPositions.ts'
import { getModProbabilities } from '../../ModificationParser/getModProbabilities.ts'
import { getMaxProbModAtEachPosition } from '../../shared/getMaximumModificationAtEachPosition.ts'
import { getColorForModification, getTagAlt } from '../../util.ts'

import type { ParsedModData } from '../../ModificationParser/getMethBins.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

// Methylated/unmethylated display colors for bisulfite/ONT methylation mode.
// Differ from the modification-mode colors in shared/modificationData.ts —
// theme.ts is source of truth, converted once here for the worker context.
const METH_5MC_METHYLATED_RGB = cssColorToRgb(methylated5mC)
const METH_5MC_UNMETHYLATED_RGB = cssColorToRgb(unmethylated5mC)
const METH_5HMC_METHYLATED_RGB = cssColorToRgb(methylated5hmC)
const METH_5HMC_UNMETHYLATED_RGB = cssColorToRgb(unmethylated5hmC)

function methColorAndProb(
  methP: number,
  methylatedRgb: readonly [number, number, number],
  unmethylatedRgb: readonly [number, number, number],
) {
  const isMeth = methP > 0.5
  const [r, g, b] = isMeth ? methylatedRgb : unmethylatedRgb
  return { r, g, b, prob: isMeth ? methP : 1 - methP }
}

export function extractModifications(
  feature: Feature,
  featureId: string,
  featureStart: number,
  strand: number,
  colorBy: { type: string; modifications?: { threshold?: number } } | undefined,
  detectedModifications: Set<string>,
  detectedSimplexModifications: Set<string>,
  modificationsData: ModificationEntry[],
): ParsedModData | undefined {
  const mmTag = getTagAlt(feature, 'MM', 'Mm') as string | undefined
  if (!mmTag) {
    return
  }
  const cigarString = feature.get('CIGAR') as string | undefined
  if (!cigarString) {
    return
  }
  const seq = feature.get('seq') as string | undefined
  if (!seq) {
    return
  }
  const cigarOps = parseCigar2(cigarString)
  const fstrand = strand as -1 | 0 | 1
  const modifications = getModPositions(mmTag, seq, fstrand)
  const probabilities = getModProbabilities(feature)
  const simplexSet = detectSimplexModifications(modifications)
  const mods = getMaxProbModAtEachPosition(
    modifications,
    probabilities,
    cigarOps,
    fstrand,
  )
  const modThreshold = (colorBy?.modifications?.threshold ?? 10) / 100
  // eslint-disable-next-line unicorn/no-array-for-each
  mods.forEach(({ prob, type, base }, refPos) => {
    detectedModifications.add(type)
    const isSimplex = simplexSet.has(type)
    if (isSimplex) {
      detectedSimplexModifications.add(type)
    }
    if (colorBy?.type === 'modifications' && prob >= modThreshold) {
      const [r, g, b] = cssColorToRgb(getColorForModification(type))
      modificationsData.push({
        featureId,
        position: featureStart + refPos,
        base,
        modType: type,
        isSimplex,
        strand: strand === -1 ? -1 : 1,
        r,
        g,
        b,
        prob,
      })
    }
  })
  return {
    modifications,
    probabilities,
    cigarOps,
    seq,
    fstrand,
    flen: feature.get('end') - feature.get('start'),
  }
}

export function extractMethylation(
  featureId: string,
  featureStart: number,
  strand: number,
  regionStart: number,
  regionEnd: number,
  modData: ParsedModData,
  modificationsData: ModificationEntry[],
) {
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    getMethBins(modData)

  const methStrand = strand === -1 ? -1 : 1
  const iStart = Math.max(0, regionStart - featureStart)
  const iEnd = Math.min(modData.flen, regionEnd - featureStart)

  for (let i = iStart; i < iEnd; i++) {
    if (!methBins[i] && !hydroxyMethBins[i]) {
      continue
    }
    const genomicPos = i + featureStart
    if (methBins[i]) {
      modificationsData.push({
        featureId,
        position: genomicPos,
        base: 'C',
        modType: 'm',
        isSimplex: true,
        strand: methStrand,
        ...methColorAndProb(
          methProbs[i] ?? 0,
          METH_5MC_METHYLATED_RGB,
          METH_5MC_UNMETHYLATED_RGB,
        ),
      })
    }
    if (hydroxyMethBins[i]) {
      modificationsData.push({
        featureId,
        position: genomicPos,
        base: 'C',
        modType: 'h',
        isSimplex: true,
        strand: methStrand,
        ...methColorAndProb(
          hydroxyMethProbs[i] ?? 0,
          METH_5HMC_METHYLATED_RGB,
          METH_5HMC_UNMETHYLATED_RGB,
        ),
      })
    }
  }
}
