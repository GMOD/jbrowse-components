import { parseCigar2 } from '@jbrowse/cigar-utils'
import {
  methylated5hmC,
  methylated5mC,
  unmethylated5hmC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import {
  getMethBins,
  getModPositions,
  getModProbabilities,
} from '@jbrowse/modifications-utils'

import { getMaxProbModAtEachPosition } from '../../shared/getMaximumModificationAtEachPosition.ts'
import { getColorForModification, getTagAlt } from '../../util.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'
import type {
  CytosineContext,
  ModificationType,
  ParsedModData,
} from '@jbrowse/modifications-utils'

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
  colorBy: ColorBy | undefined,
  detectedModifications: Set<string>,
  seenModTypes: Map<string, ModificationType>,
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

  // Collect (strand, type) pairs; the caller resolves simplex globally once all
  // reads are parsed (see detectSimplexModifications).
  for (const { strand: modStrand, type, base: modBase } of modifications) {
    const key = modStrand + type
    if (!seenModTypes.has(key)) {
      seenModTypes.set(key, { type, base: modBase, strand: modStrand })
    }
  }

  const mods = getMaxProbModAtEachPosition(
    modifications,
    probabilities,
    cigarOps,
    fstrand,
  )
  const modThreshold = (colorBy?.modifications?.threshold ?? 10) / 100
  const hidden = colorBy?.modifications?.hiddenModifications ?? []
  const twoColor = colorBy?.modifications?.twoColor ?? false
  // eslint-disable-next-line unicorn/no-array-for-each
  mods.forEach(({ prob, type, base }, refPos) => {
    // detectedModifications must list every type seen so the menu can offer all
    // of them — isolation filters what is *rendered*, not what is detected.
    detectedModifications.add(type)
    const typeVisible = !hidden.includes(type)
    if (colorBy?.type === 'modifications' && typeVisible) {
      const modRgb = cssColorToRgb(getColorForModification(type))
      // twoColor renders every call, painting low-confidence ones blue; the
      // default mode hides calls below the probability threshold instead.
      const shouldPush = twoColor || prob >= modThreshold
      if (shouldPush) {
        const {
          r,
          g,
          b,
          prob: alpha,
        } = twoColor
          ? methColorAndProb(prob, modRgb, METH_5MC_UNMETHYLATED_RGB)
          : { r: modRgb[0], g: modRgb[1], b: modRgb[2], prob }
        modificationsData.push({
          featureId,
          position: featureStart + refPos,
          base,
          modType: type,
          strand: strand === -1 ? -1 : 1,
          r,
          g,
          b,
          prob: alpha,
        })
      }
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
  region: Region,
  modData: ParsedModData,
  modificationsData: ModificationEntry[],
  context: CytosineContext,
) {
  const { start: regionStart, end: regionEnd } = region
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    getMethBins(modData, context)

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
