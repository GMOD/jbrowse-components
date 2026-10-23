import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import { matchesCytosineContext } from './cytosineContext.ts'
import { forEachModRefPos } from './forEachModRefPos.ts'

import type { CytosineContext } from './cytosineContext.ts'
import type { ModWithPositions } from './getModPositions.ts'
import type { ReadWindow } from '@jbrowse/cigar-utils'

export interface ParsedModData {
  modifications: ModWithPositions[]
  probabilities: number[] | undefined
  cigarOps: ArrayLike<number>
  seq: string
  fstrand: -1 | 0 | 1
  flen: number
  /** the window `modifications` was cut to, and the only one binned */
  window?: ReadWindow
}

/**
 * #api
 * The modification types the methylation walk below paints — 5mC and 5hmC, the
 * pair that compete for one cytosine.
 *
 * Stated once because two functions have to agree on it and they are in
 * different packages: this walk claims those types, and
 * `extractModifications` has to skip exactly them in the fill view so a
 * cytosine gets one mark rather than two. A second spelling would either
 * double-paint or, as it did, drop every OTHER type the read declares.
 */
export function isMethylationFillType(type: string) {
  return type === 'm' || type === 'h'
}

export interface MethBins {
  /** the read-relative reference offset that index 0 of each array holds */
  refStart: number
  /** 1 where a 5mC call or the unmethylated fill landed */
  methBins: Uint8Array
  hydroxyMethBins: Uint8Array
  methProbs: Float32Array
  hydroxyMethProbs: Float32Array
}

/**
 * #api
 * Bins per-read base modifications and their probabilities onto the reference
 * offsets of `window` (the whole read without one), indexed from `refStart`.
 * Only cytosines in `context` are considered (default CpG); plants also use
 * CHG/CHH. With `fill`, a cytosine in context that the MM tag left implicit
 * bins as unmethylated (probability 0) where the tag allows it: no `?` skip flag
 * on a 5mC or 5hmC group that `isVisible` keeps. A hidden group drops out of
 * that check, since the fill then claims nothing about its type.
 *
 * Every ML probability is `(N + 0.5) / 256`, which float32 holds exactly.
 */
export function getMethBins(
  {
    modifications,
    probabilities,
    cigarOps,
    seq,
    fstrand,
    flen,
    window,
  }: ParsedModData,
  context: CytosineContext = 'CG',
  fill = true,
  isVisible: (type: string) => boolean = () => true,
): MethBins {
  const isReverse = fstrand === -1
  const lo = Math.max(0, window?.refStart ?? 0)
  const hi = Math.max(lo, Math.min(flen, window?.refEnd ?? flen))
  const size = hi - lo
  const methBins = new Uint8Array(size)
  const hydroxyMethBins = new Uint8Array(size)
  const methProbs = new Float32Array(size)
  const hydroxyMethProbs = new Float32Array(size)

  forEachModRefPos(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, strand, positions }, ref, idx, prob) => {
      const isMeth = isMethylationFillType(type)
      if (
        isMeth &&
        ref >= lo &&
        ref < hi &&
        matchesCytosineContext(
          seq,
          positions[idx]!,
          isReverse !== (strand === '-'),
          context,
        )
      ) {
        const at = ref - lo
        if (type === 'm') {
          methBins[at] = 1
          methProbs[at] = prob
        } else {
          hydroxyMethBins[at] = 1
          hydroxyMethProbs[at] = prob
        }
      }
    },
    window,
  )

  // Only fill undetected sites as unmethylated when the read actually carries a
  // 5mC ('m') call. A read with only e.g. 6mA modifications never assayed
  // methylation, so inventing unmethylated cytosines for it would be wrong.
  // Per SAMtags the '?' flag means the status of bases not listed in the MM tag
  // is unknown, so we must NOT assume them unmethylated. A filled site claims
  // low 5mC and low 5hmC, so a visible 'h' group's '?' blocks the fill too.
  const methMods = modifications.filter(m => m.type === 'm')
  const fillUnmethylated =
    fill &&
    methMods.length > 0 &&
    !modifications.some(
      m => m.unknownSkip && isMethylationFillType(m.type) && isVisible(m.type),
    )

  // A '-' MM group assays the cytosines of the strand OPPOSITE the read, so a
  // both-strand modBAM ('C+m;G-m') has its uncalled sites in both directions.
  const fillForward = methMods.some(m => isReverse === (m.strand === '-'))
  const fillReverse = methMods.some(m => isReverse !== (m.strand === '-'))

  // Scan the window's read sequence for every cytosine in `context` and mark any
  // not already detected from the MM tag as unmethylated (prob=0).
  if (fillUnmethylated) {
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
            !methBins[rf - lo] &&
            ((fillForward && matchesCytosineContext(seq, rp, false, context)) ||
              (fillReverse && matchesCytosineContext(seq, rp, true, context)))
          ) {
            methBins[rf - lo] = 1
          }
        }
        readPos += len
        refPos += len
      }
    }
  }

  return {
    refStart: lo,
    methBins,
    hydroxyMethBins,
    methProbs,
    hydroxyMethProbs,
  }
}
