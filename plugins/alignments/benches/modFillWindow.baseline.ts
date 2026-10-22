// The fill view as it shipped before getMethBins took typed arrays: bins in
// `number[]`s indexed by the read's own reference offset. Declared twice, as the
// baseline and its control, for modFillWindow.bench.ts.
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/cigar-utils'
import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  forEachModRefPos,
  isMethylationFillType,
  matchesCytosineContext,
} from '@jbrowse/modifications-utils'

import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'
import type { ParsedModData } from '@jbrowse/modifications-utils'

const ABGR_5MC = cssColorToABGR(methylated5mC)
const ABGR_UNMOD = cssColorToABGR(unmethylated5mC)
const ABGR_5HMC = cssColorToABGR(methylated5hmC)

function binsShipped({
  modifications,
  probabilities,
  cigarOps,
  seq,
  fstrand,
  flen,
  window,
}: ParsedModData) {
  const isReverse = fstrand === -1
  const methBins: number[] = []
  const hydroxyMethBins: number[] = []
  const methProbs: number[] = []
  const hydroxyMethProbs: number[] = []
  forEachModRefPos(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, strand, positions }, ref, idx, prob) => {
      if (
        isMethylationFillType(type) &&
        ref >= 0 &&
        ref < flen &&
        matchesCytosineContext(
          seq,
          positions[idx]!,
          isReverse !== (strand === '-'),
          'CG',
        )
      ) {
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
    },
    window,
  )
  const methMods = modifications.filter(m => m.type === 'm')
  const fill = methMods.length > 0 && !methMods.some(m => m.unknownSkip)
  const fillForward = methMods.some(m => isReverse === (m.strand === '-'))
  const fillReverse = methMods.some(m => isReverse !== (m.strand === '-'))
  if (fill) {
    const lo = Math.max(0, window?.refStart ?? 0)
    const hi = Math.min(flen, window?.refEnd ?? flen)
    let readPos = window?.opRead ?? 0
    let refPos = window?.opRef ?? 0
    for (
      let i = window?.op ?? 0, l = cigarOps.length;
      i < l && refPos < hi;
      i++
    ) {
      const packed = cigarOps[i]!
      const len = packed >>> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
        for (let j = 0; j < len; j++) {
          const rp = readPos + j
          const rf = refPos + j
          if (
            rf >= lo &&
            rf < hi &&
            !methBins[rf] &&
            ((fillForward && matchesCytosineContext(seq, rp, false, 'CG')) ||
              (fillReverse && matchesCytosineContext(seq, rp, true, 'CG')))
          ) {
            methBins[rf] = 1
            methProbs[rf] = 0
          }
        }
        readPos += len
        refPos += len
      }
    }
  }
  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

export function fillShipped(
  readIndex: number,
  featureStart: number,
  strand: number,
  regionStart: number,
  regionEnd: number,
  modData: ParsedModData,
  out: ModificationEntry[],
) {
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    binsShipped(modData)
  const methStrand = strand === -1 ? -1 : 1
  const iStart = Math.max(0, regionStart - featureStart)
  const iEnd = Math.min(modData.flen, regionEnd - featureStart)
  for (let i = iStart; i < iEnd; i++) {
    const hasMeth = methBins[i]
    const hasHydroxy = hydroxyMethBins[i]
    if (!hasMeth && !hasHydroxy) {
      continue
    }
    const mProb = hasMeth ? (methProbs[i] ?? 0) : 0
    const hProb = hasHydroxy ? (hydroxyMethProbs[i] ?? 0) : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    out.push({
      readIndex,
      position: i + featureStart,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy ? ABGR_5HMC : isMeth ? ABGR_5MC : ABGR_UNMOD,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
    })
  }
}

function binsControl({
  modifications,
  probabilities,
  cigarOps,
  seq,
  fstrand,
  flen,
  window,
}: ParsedModData) {
  const isReverse = fstrand === -1
  const methBins: number[] = []
  const hydroxyMethBins: number[] = []
  const methProbs: number[] = []
  const hydroxyMethProbs: number[] = []
  forEachModRefPos(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, strand, positions }, ref, idx, prob) => {
      if (
        isMethylationFillType(type) &&
        ref >= 0 &&
        ref < flen &&
        matchesCytosineContext(
          seq,
          positions[idx]!,
          isReverse !== (strand === '-'),
          'CG',
        )
      ) {
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
    },
    window,
  )
  const methMods = modifications.filter(m => m.type === 'm')
  const fill = methMods.length > 0 && !methMods.some(m => m.unknownSkip)
  const fillForward = methMods.some(m => isReverse === (m.strand === '-'))
  const fillReverse = methMods.some(m => isReverse !== (m.strand === '-'))
  if (fill) {
    const lo = Math.max(0, window?.refStart ?? 0)
    const hi = Math.min(flen, window?.refEnd ?? flen)
    let readPos = window?.opRead ?? 0
    let refPos = window?.opRef ?? 0
    for (
      let i = window?.op ?? 0, l = cigarOps.length;
      i < l && refPos < hi;
      i++
    ) {
      const packed = cigarOps[i]!
      const len = packed >>> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
        for (let j = 0; j < len; j++) {
          const rp = readPos + j
          const rf = refPos + j
          if (
            rf >= lo &&
            rf < hi &&
            !methBins[rf] &&
            ((fillForward && matchesCytosineContext(seq, rp, false, 'CG')) ||
              (fillReverse && matchesCytosineContext(seq, rp, true, 'CG')))
          ) {
            methBins[rf] = 1
            methProbs[rf] = 0
          }
        }
        readPos += len
        refPos += len
      }
    }
  }
  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

export function fillControl(
  readIndex: number,
  featureStart: number,
  strand: number,
  regionStart: number,
  regionEnd: number,
  modData: ParsedModData,
  out: ModificationEntry[],
) {
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    binsControl(modData)
  const methStrand = strand === -1 ? -1 : 1
  const iStart = Math.max(0, regionStart - featureStart)
  const iEnd = Math.min(modData.flen, regionEnd - featureStart)
  for (let i = iStart; i < iEnd; i++) {
    const hasMeth = methBins[i]
    const hasHydroxy = hydroxyMethBins[i]
    if (!hasMeth && !hasHydroxy) {
      continue
    }
    const mProb = hasMeth ? (methProbs[i] ?? 0) : 0
    const hProb = hasHydroxy ? (hydroxyMethProbs[i] ?? 0) : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    out.push({
      readIndex,
      position: i + featureStart,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy ? ABGR_5HMC : isMeth ? ABGR_5MC : ABGR_UNMOD,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
    })
  }
}
