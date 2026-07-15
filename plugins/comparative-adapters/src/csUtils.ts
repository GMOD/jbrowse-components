import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  csToCigar,
  flipCigar,
  swapIndelCigar,
} from '@jbrowse/cigar-utils'

import type { MismatchCallback } from '@jbrowse/cigar-utils'

// Parsing for the minimap2 `cs` difference string
// (https://github.com/lh3/minimap2#cs). Short form: `:N` match run, `*ab`
// substitution (ref base a, query base b), `+seq` insertion, `-seq` deletion.
// Long form: `=SEQ` match run. `~xxNyy` denotes an N-bp intron.

function isBaseChar(ch: string | undefined) {
  return ch !== undefined && /[A-Za-z]/.test(ch)
}

function isOpChar(ch: string | undefined) {
  return (
    ch === ':' ||
    ch === '=' ||
    ch === '*' ||
    ch === '+' ||
    ch === '-' ||
    ch === '~'
  )
}

// Rewrite a cs string from the target perspective to the query perspective (used
// when a synteny view is anchored on the query assembly): `*ab` -> `*ba` (swap
// ref/query base), `+seq` -> `-seq`, `-seq` -> `+seq`. Match runs are unchanged.
// Only valid for +-strand alignments; reverse-strand additionally needs a
// reverse-complement, so callers fall back to the CIGAR there.
export function flipCs(cs: string) {
  let result = ''
  let i = 0
  while (i < cs.length) {
    const c = cs[i]!
    if (c === ':') {
      const start = i
      i++
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        i++
      }
      result += cs.slice(start, i)
    } else if (c === '=') {
      const start = i
      i++
      while (i < cs.length && isBaseChar(cs[i])) {
        i++
      }
      result += cs.slice(start, i)
    } else if (c === '*') {
      result += `*${cs[i + 2]}${cs[i + 1]}`
      i += 3
    } else if (c === '+' || c === '-') {
      const flipped = c === '+' ? '-' : '+'
      i++
      const start = i
      while (i < cs.length && !isOpChar(cs[i])) {
        i++
      }
      result += flipped + cs.slice(start, i)
    } else {
      i++
    }
  }
  return result
}

// Resolve a PAF row's alignment detail into the perspective the view is anchored
// on. `flip` is set when viewing the query assembly. A cg CIGAR is used when
// present, otherwise one is derived from cs. cs (real per-base diffs) maps
// directly in the target perspective; in the query perspective it is flipped,
// except reverse-strand which additionally needs a reverse-complement we don't
// do — there cs is dropped and the flipped CIGAR carries mismatch positions.
export function orientAlignment({
  cg,
  cs,
  flip,
  strand,
}: {
  cg: string | undefined
  cs: string | undefined
  flip: boolean
  strand: number
}) {
  let CIGAR = cg ?? (cs ? csToCigar(cs) : undefined)
  let orientedCs = cs
  if (CIGAR && flip) {
    if (strand === -1) {
      CIGAR = flipCigar(CIGAR)
      orientedCs = undefined
    } else {
      CIGAR = swapIndelCigar(CIGAR)
      orientedCs = cs ? flipCs(cs) : undefined
    }
  }
  return { CIGAR, cs: orientedCs }
}

// Walk a cs string and drive a MismatchCallback (same contract BAM/CRAM features
// use), emitting per-base substitutions with their real query base plus
// insertions, deletions, and introns. Offsets are relative to the reference
// (feature) start; windowStart/windowEnd (also reference-relative) clip output.
export function forEachCsMismatch(
  cs: string,
  callback: MismatchCallback,
  windowStart?: number,
  windowEnd?: number,
) {
  const lo = windowStart ?? Number.NEGATIVE_INFINITY
  const hi = windowEnd ?? Number.POSITIVE_INFINITY
  let ref = 0
  let i = 0
  while (i < cs.length) {
    const c = cs[i]!
    if (c === ':') {
      i++
      let n = 0
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        n = n * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      ref += n
    } else if (c === '=') {
      i++
      const start = i
      while (i < cs.length && isBaseChar(cs[i])) {
        i++
      }
      ref += i - start
    } else if (c === '*') {
      if (ref >= lo && ref < hi) {
        callback(
          MISMATCH_TYPE,
          ref,
          1,
          cs[i + 2]!,
          undefined,
          undefined,
          undefined,
        )
      }
      ref += 1
      i += 3
    } else if (c === '+') {
      i++
      const start = i
      while (i < cs.length && isBaseChar(cs[i])) {
        i++
      }
      const seq = cs.slice(start, i)
      if (ref >= lo && ref <= hi) {
        callback(
          INSERTION_TYPE,
          ref,
          seq.length,
          seq,
          undefined,
          undefined,
          seq.length,
        )
      }
    } else if (c === '-') {
      i++
      const start = i
      while (i < cs.length && isBaseChar(cs[i])) {
        i++
      }
      const len = i - start
      if (ref < hi && ref + len > lo) {
        callback(DELETION_TYPE, ref, len, '', undefined, undefined, undefined)
      }
      ref += len
    } else if (c === '~') {
      i += 3
      let n = 0
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        n = n * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      i += 2
      if (ref < hi && ref + n > lo) {
        callback(SKIP_TYPE, ref, n, '', undefined, undefined, undefined)
      }
      ref += n
    } else {
      i++
    }
  }
}
