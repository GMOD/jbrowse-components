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
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
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

// Methylated/unmethylated display colors for bisulfite/ONT methylation mode,
// packed once to opaque ABGR (the modificationColors / GPU vertex format).
// Differ from the modification-mode colors in shared/modificationData.ts —
// theme.ts is source of truth, converted once here for the worker context.
const METH_5MC_METHYLATED = cssColorToABGR(methylated5mC)
const METH_5MC_UNMETHYLATED = cssColorToABGR(unmethylated5mC)
const METH_5HMC_METHYLATED = cssColorToABGR(methylated5hmC)

// getColorForModification + cssColorToABGR are pure functions of the mod code,
// but the mods.forEach loop below hits them once per modified base — thousands
// of times per nanopore read, nearly all the same code ('m'). Memoize the
// packed ABGR per code (globally deterministic) so each distinct code parses
// once for the whole session instead of once per base.
const modColorCache = new Map<string, number>()
function modColorForType(type: string) {
  let color = modColorCache.get(type)
  if (color === undefined) {
    color = cssColorToABGR(getColorForModification(type))
    modColorCache.set(type, color)
  }
  return color
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

  // One pass over the parsed MM types:
  // - detectedModifications lists every type so the menu can offer all of them
  //   (isolation filters what is *rendered*, not what is detected).
  // - seenModTypes collects (strand, type) pairs; the caller resolves simplex
  //   globally once all reads are parsed (see detectSimplexModifications).
  // The per-refPos max-prob walk further down only paints marks, so it stays
  // gated to modifications mode — methylation/bisulfite/normal never pay for it.
  for (const { strand: modStrand, type, base: modBase } of modifications) {
    detectedModifications.add(type)
    const key = modStrand + type
    if (!seenModTypes.has(key)) {
      seenModTypes.set(key, { type, base: modBase, strand: modStrand })
    }
  }

  if (colorBy?.type === 'modifications') {
    const modStrand = strand === -1 ? -1 : 1
    const modThreshold = (colorBy.modifications?.threshold ?? 10) / 100
    const twoColor = colorBy.modifications?.twoColor ?? false
    const mods = getMaxProbModAtEachPosition(
      modifications,
      probabilities,
      cigarOps,
      fstrand,
    )
    mods.forEach(({ prob, type, base }, refPos) => {
      // twoColor renders every call, painting low-confidence ones in the
      // unmethylated color (with prob = 1-prob = the unmodified confidence);
      // default mode hides calls below the threshold and always paints the mod
      // color at full prob. `isMeth` unifies both without an intermediate alloc.
      if (
        isModificationTypeVisible(colorBy.modifications, type) &&
        (twoColor || prob >= modThreshold)
      ) {
        const isMeth = !twoColor || prob > 0.5
        modificationsData.push({
          readIndex,
          position: featureStart + refPos,
          base,
          modType: type,
          strand: modStrand,
          color: isMeth ? modColorForType(type) : METH_5MC_UNMETHYLATED,
          prob: isMeth ? prob : 1 - prob,
          noMod: !isMeth,
        })
      }
    })
  }
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

    // Winner selection, allocation-free: pick 5hmC, then 5mC, else the no-mod
    // bucket. Each color is a module-level packed constant (no per-cytosine work).
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    modificationsData.push({
      readIndex,
      position: i + featureStart,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy
        ? METH_5HMC_METHYLATED
        : isMeth
          ? METH_5MC_METHYLATED
          : METH_5MC_UNMETHYLATED,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
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
            // Bisulfite is a binary call (converted vs protected), not a
            // likelihood — full confidence either way. Methylated paints the
            // 5mC color, unmethylated the no-mod color.
            modificationsData.push({
              readIndex,
              position: genomicPos,
              base: 'C',
              modType: 'm',
              strand: methStrand,
              color: methylated ? METH_5MC_METHYLATED : METH_5MC_UNMETHYLATED,
              prob: 1,
              noMod: !methylated,
            })
          }
        }
      }
      readPos += len
      refPos += len
    }
  }
}
