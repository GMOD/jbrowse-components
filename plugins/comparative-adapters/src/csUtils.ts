import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
} from '@jbrowse/cigar-utils'

import { flipCigar, swapIndelCigar } from './util.ts'

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

// Convert a cs string to a standard CIGAR: matches -> `=`, substitutions -> `X`,
// insertions -> `I`, deletions -> `D`, introns -> `N`. Sequence bases are
// discarded, so the result reorients with the same flipCigar/swapIndelCigar
// helpers as a `cg` CIGAR.
export function csToCigar(cs: string) {
  const ops: [number, string][] = []
  function push(len: number, op: string) {
    if (len > 0) {
      const last = ops[ops.length - 1]
      if (last?.[1] === op) {
        last[0] += len
      } else {
        ops.push([len, op])
      }
    }
  }
  function countBases(start: number) {
    let j = start
    while (j < cs.length && isBaseChar(cs[j])) {
      j++
    }
    return j - start
  }
  function countDigits(start: number) {
    let j = start
    let len = 0
    while (j < cs.length && cs.charCodeAt(j) >= 48 && cs.charCodeAt(j) <= 57) {
      len = len * 10 + (cs.charCodeAt(j) - 48)
      j++
    }
    return { len, next: j }
  }

  let i = 0
  while (i < cs.length) {
    const c = cs[i]!
    if (c === ':') {
      const { len, next } = countDigits(i + 1)
      push(len, '=')
      i = next
    } else if (c === '=') {
      const n = countBases(i + 1)
      push(n, '=')
      i = i + 1 + n
    } else if (c === '*') {
      push(1, 'X')
      i += 3
    } else if (c === '+') {
      const n = countBases(i + 1)
      push(n, 'I')
      i = i + 1 + n
    } else if (c === '-') {
      const n = countBases(i + 1)
      push(n, 'D')
      i = i + 1 + n
    } else if (c === '~') {
      const { len, next } = countDigits(i + 3)
      push(len, 'N')
      i = next + 2
    } else {
      i++
    }
  }
  let result = ''
  for (const [len, op] of ops) {
    result += len
    result += op
  }
  return result
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
        callback(MISMATCH_TYPE, ref, 1, cs[i + 2]!, undefined, undefined, undefined)
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
        callback(INSERTION_TYPE, ref, seq.length, seq, undefined, undefined, seq.length)
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
