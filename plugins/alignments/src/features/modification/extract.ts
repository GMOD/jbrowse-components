import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  parseCigar2,
} from '@jbrowse/cigar-utils'
import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import {
  getMethBins,
  getModPositions,
  getModProbabilities,
  matchesCytosineContext,
} from '@jbrowse/modifications-utils'

import { getMaxProbModAtEachPosition } from '../../shared/getMaximumModificationAtEachPosition.ts'
import { isModificationTypeVisible } from '../../shared/types.ts'
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

// getColorForModification + cssColorToRgb are pure functions of the mod code,
// but the mods.forEach loop below hits them once per modified base — thousands
// of times per nanopore read, nearly all the same code ('m'). Memoize the
// parsed RGB per code (globally deterministic) so each distinct code parses once
// for the whole session instead of once per base.
const modRgbCache = new Map<string, [number, number, number]>()
function modRgbForType(type: string) {
  let rgb = modRgbCache.get(type)
  if (!rgb) {
    rgb = cssColorToRgb(getColorForModification(type))
    modRgbCache.set(type, rgb)
  }
  return rgb
}

function methColorAndProb(
  methP: number,
  methylatedRgb: readonly [number, number, number],
  unmethylatedRgb: readonly [number, number, number],
) {
  const isMeth = methP > 0.5
  const [r, g, b] = isMeth ? methylatedRgb : unmethylatedRgb
  // !isMeth → the no-modification bucket; prob becomes the confidence it is
  // unmodified (1 - methP) so the bar/tooltip reflect that call.
  return { r, g, b, prob: isMeth ? methP : 1 - methP, noMod: !isMeth }
}

export function extractModifications(
  feature: Feature,
  readIndex: number,
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
  const twoColor = colorBy?.modifications?.twoColor ?? false
  mods.forEach(({ prob, type, base }, refPos) => {
    // detectedModifications must list every type seen so the menu can offer all
    // of them — isolation filters what is *rendered*, not what is detected.
    detectedModifications.add(type)
    const typeVisible = isModificationTypeVisible(colorBy?.modifications, type)
    if (colorBy?.type === 'modifications' && typeVisible) {
      const modRgb = modRgbForType(type)
      // twoColor renders every call, painting low-confidence ones blue; the
      // default mode hides calls below the probability threshold instead.
      const shouldPush = twoColor || prob >= modThreshold
      if (shouldPush) {
        const {
          r,
          g,
          b,
          prob: alpha,
          noMod,
        } = twoColor
          ? methColorAndProb(prob, modRgb, METH_5MC_UNMETHYLATED_RGB)
          : { r: modRgb[0], g: modRgb[1], b: modRgb[2], prob, noMod: false }
        modificationsData.push({
          readIndex,
          position: featureStart + refPos,
          base,
          modType: type,
          strand: strand === -1 ? -1 : 1,
          r,
          g,
          b,
          prob: alpha,
          noMod,
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
  readIndex: number,
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
    // 5mC and 5hmC are competing modifications of the same cytosine, so their
    // likelihoods plus the implicit unmodified call sum to 1 (SAMtags). A model
    // that emits both (e.g. ONT 5mCG_5hmCG) reports a 5hmC probability at every
    // CpG, almost always low. Drawing each channel as its own methylated/
    // unmethylated mark therefore painted an "unmethylated 5hmC" mark at nearly
    // every CpG, flooding the view. Instead pick the single most-likely state
    // per cytosine — 5mC, 5hmC, or unmodified — mirroring IGV's no-mod logic.
    const mProb = methBins[i] ? (methProbs[i] ?? 0) : 0
    const hProb = hydroxyMethBins[i] ? (hydroxyMethProbs[i] ?? 0) : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)
    const genomicPos = i + featureStart

    const winner =
      hProb > mProb && hProb > noModProb
        ? {
            modType: 'h',
            rgb: METH_5HMC_METHYLATED_RGB,
            prob: hProb,
            noMod: false,
          }
        : mProb > noModProb
          ? {
              modType: 'm',
              rgb: METH_5MC_METHYLATED_RGB,
              prob: mProb,
              noMod: false,
            }
          : {
              modType: 'm',
              rgb: METH_5MC_UNMETHYLATED_RGB,
              prob: noModProb,
              noMod: true,
            }

    modificationsData.push({
      readIndex,
      position: genomicPos,
      base: 'C',
      modType: winner.modType,
      strand: methStrand,
      r: winner.rgb[0],
      g: winner.rgb[1],
      b: winner.rgb[2],
      prob: winner.prob,
      noMod: winner.noMod,
    })
  }
}

// Bisulfite/EM-seq has no MM/ML tags: methylation is read from C->T conversion
// against the reference. Unmethylated C is converted (read T); methylated C is
// protected (read C). Produces the same methylated/unmethylated marks as the
// modBAM methylation path so all downstream rendering is shared.
export function extractBisulfite(
  feature: Feature,
  readIndex: number,
  featureStart: number,
  strand: number,
  region: Region,
  regionSequence: string,
  regionSequenceStart: number,
  context: CytosineContext,
  modificationsData: ModificationEntry[],
) {
  const cigarString = feature.get('CIGAR') as string | undefined
  const seq = feature.get('seq') as string | undefined
  if (!cigarString || !seq) {
    return
  }
  const cigarOps = parseCigar2(cigarString)
  const flags = (feature.get('flags') as number | undefined) ?? 0
  const isReverse = strand === -1
  const isSecondOfPair = (flags & 128) !== 0

  // Bisulfite converts only the read's own template strand. That strand is
  // reverse XOR second-of-pair (IGV's rule). On it we read genomic C as read
  // C=methylated / T=unmethylated; otherwise genomic G as read G / A. The
  // reference (regionSequence) is lowercased; read bases are uppercased.
  const flip = isReverse !== isSecondOfPair
  const wantRef = flip ? 'g' : 'c'
  const methRead = flip ? 'G' : 'C'
  const unmethRead = flip ? 'A' : 'T'
  const methStrand = isReverse ? -1 : 1
  const refLen = regionSequence.length
  const { start: regionStart, end: regionEnd } = region

  let readPos = 0
  let refPos = 0
  for (let i = 0, l = cigarOps.length; i < l; i++) {
    const packed = cigarOps[i]!
    const len = packed >> 4
    const op = packed & 0xf
    if (op === CIGAR_S || op === CIGAR_I) {
      readPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      refPos += len
    } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
      for (let j = 0; j < len; j++) {
        const genomicPos = featureStart + refPos + j
        const ri = genomicPos - regionSequenceStart
        if (
          ri >= 0 &&
          ri < refLen &&
          regionSequence[ri] === wantRef &&
          genomicPos >= regionStart &&
          genomicPos < regionEnd &&
          matchesCytosineContext(regionSequence, ri, flip, context)
        ) {
          const readBase = seq[readPos + j]?.toUpperCase()
          const methylated = readBase === methRead
          if (methylated || readBase === unmethRead) {
            const { r, g, b, prob, noMod } = methColorAndProb(
              methylated ? 1 : 0,
              METH_5MC_METHYLATED_RGB,
              METH_5MC_UNMETHYLATED_RGB,
            )
            modificationsData.push({
              readIndex,
              position: genomicPos,
              base: 'C',
              modType: 'm',
              strand: methStrand,
              r,
              g,
              b,
              prob,
              noMod,
            })
          }
        }
      }
      readPos += len
      refPos += len
    }
  }
}
