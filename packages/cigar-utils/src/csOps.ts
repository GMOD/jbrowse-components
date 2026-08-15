import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
} from './mismatchCallback.ts'

import type { MismatchCallback } from './mismatchCallback.ts'

/** An operation of the minimap2 `cs` grammar. */
export type CsOp = ':' | '=' | '*' | '+' | '-' | '~'

function isDigit(code: number) {
  return code >= 48 && code <= 57
}

function isBaseChar(ch: string | undefined) {
  return ch !== undefined && /[A-Za-z]/.test(ch)
}

function scanBases(cs: string, start: number) {
  let i = start
  while (i < cs.length && isBaseChar(cs[i])) {
    i++
  }
  return i
}

function scanDigits(cs: string, start: number) {
  let i = start
  let value = 0
  while (i < cs.length && isDigit(cs.charCodeAt(i))) {
    value = value * 10 + (cs.charCodeAt(i) - 48)
    i++
  }
  return { value, next: i }
}

/**
 * Walk a minimap2 `cs` difference string
 * (https://github.com/lh3/minimap2#cs), calling `callback` once per operation.
 *
 * Short form is `:N` match run, `*ab` substitution (ref base a, query base b),
 * `+seq` insertion, `-seq` deletion; long form adds `=SEQ` match runs; `~ab12cd`
 * is a 12 bp intron between the given splice motifs. A character belonging to
 * none of those is skipped, so a truncated or extended string still walks to the
 * end rather than throwing.
 *
 * `refLen`/`queryLen` are the bases the operation consumes on each sequence, and
 * `[seqStart, seqEnd)` bounds its operand *within `cs`* — the bases for `=`/`+`/
 * `-`, the two substituted bases for `*`, the digits for `:`, the whole motif
 * for `~`. Offsets rather than a substring because the mismatch walk runs per
 * feature per frame, and only two of six ops ever need the text.
 *
 * **One walker, because four disagreed.** This replaces a copy in each of
 * `csToCigar`, `flipCs`, `forEachCsMismatch` and the (now removed) `visitCsOps`,
 * and every one of the divergences was silent: two of them dropped `~` and then
 * mis-scanned the rest of the string, one ignored `=SEQ` entirely and so never
 * advanced the reference across a long-form match run, and the three that
 * scanned `+`/`-` operands disagreed on where one ends.
 */
export function forEachCsOp(
  cs: string,
  callback: (
    op: CsOp,
    refLen: number,
    queryLen: number,
    seqStart: number,
    seqEnd: number,
  ) => void,
) {
  let i = 0
  while (i < cs.length) {
    const c = cs[i]
    if (c === ':') {
      const { value, next } = scanDigits(cs, i + 1)
      callback(':', value, value, i + 1, next)
      i = next
    } else if (c === '=') {
      const next = scanBases(cs, i + 1)
      const len = next - i - 1
      callback('=', len, len, i + 1, next)
      i = next
    } else if (c === '*') {
      callback('*', 1, 1, i + 1, Math.min(i + 3, cs.length))
      i += 3
    } else if (c === '+' || c === '-') {
      const next = scanBases(cs, i + 1)
      const len = next - i - 1
      callback(c, c === '-' ? len : 0, c === '+' ? len : 0, i + 1, next)
      i = next
    } else if (c === '~') {
      // the length sits between two 2-base splice motifs
      const { value, next } = scanDigits(cs, i + 3)
      const end = Math.min(next + 2, cs.length)
      callback('~', value, 0, i + 1, end)
      i = end
    } else {
      i++
    }
  }
}

/**
 * Rewrite a cs string from the target perspective to the query perspective (for
 * a synteny view anchored on the query assembly): `*ab` -> `*ba`, `+seq` ->
 * `-seq`, `-seq` -> `+seq`, match runs unchanged.
 *
 * Undefined when the string states something the query perspective cannot: an
 * intron is a gap in the *reference*, and flipped it becomes a gap in the query
 * with no sequence to write for it, which cs has no way to express. Callers fall
 * back to the CIGAR there, the same as they already do for reverse-strand
 * alignments (which additionally need a reverse-complement).
 */
export function flipCs(cs: string) {
  // The one op with no query-perspective form, and cs writes it nowhere else —
  // operands are base letters. Answered before the walk so the rewrite below is
  // total.
  if (cs.includes('~')) {
    return undefined
  }
  let result = ''
  forEachCsOp(cs, (op, refLen, _queryLen, seqStart, seqEnd) => {
    if (op === ':') {
      result += `:${refLen}`
    } else if (op === '=') {
      result += `=${cs.slice(seqStart, seqEnd)}`
    } else if (op === '*') {
      result += `*${cs[seqStart + 1] ?? ''}${cs[seqStart] ?? ''}`
    } else {
      result += `${op === '+' ? '-' : '+'}${cs.slice(seqStart, seqEnd)}`
    }
  })
  return result
}

/**
 * Walk a cs string and drive a {@link MismatchCallback} (the contract BAM/CRAM
 * features use), emitting per-base substitutions with their real query base plus
 * insertions, deletions and introns. Offsets are relative to the reference
 * (feature) start; `windowStart`/`windowEnd` (also reference-relative) clip the
 * output.
 */
export function forEachCsMismatch(
  cs: string,
  callback: MismatchCallback,
  windowStart?: number,
  windowEnd?: number,
) {
  const lo = windowStart ?? Number.NEGATIVE_INFINITY
  const hi = windowEnd ?? Number.POSITIVE_INFINITY
  let ref = 0
  forEachCsOp(cs, (op, refLen, queryLen, seqStart, seqEnd) => {
    if (op === '*') {
      if (ref >= lo && ref < hi) {
        callback(MISMATCH_TYPE, ref, 1, cs[seqStart + 1] ?? '', -1, 0, 0)
      }
    } else if (op === '+') {
      if (ref >= lo && ref <= hi) {
        const seq = cs.slice(seqStart, seqEnd)
        callback(INSERTION_TYPE, ref, queryLen, seq, -1, 0, queryLen)
      }
    } else if (op === '-' || op === '~') {
      if (ref < hi && ref + refLen > lo) {
        // an intron is a reference gap the read skips rather than deletes, and
        // the two draw differently
        const type = op === '-' ? DELETION_TYPE : SKIP_TYPE
        callback(type, ref, refLen, '', -1, 0, 0)
      }
    }
    ref += refLen
  })
}
