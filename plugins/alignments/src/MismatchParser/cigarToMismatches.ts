import type { Mismatch } from '../shared/types'
import type { Buffer } from 'buffer'

export function cigarToMismatches(
  ops: string[],
  seq?: string,
  ref?: string,
  qual?: Buffer,
) {
  let roffset = 0 // reference offset
  let soffset = 0 // seq offset
  const mismatches: Mismatch[] = []
  const hasRefAndSeq = ref && seq
  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]!
    const op = ops[i + 1]!

    if (op === 'M' || op === '=' || op === 'E') {
      if (hasRefAndSeq) {
        for (let j = 0; j < len; j++) {
          if (
            // @ts-ignore in the full yarn build of the repo, this says that
            // object is possibly undefined for some reason, ignored
            seq[soffset + j].toUpperCase() !== ref[roffset + j].toUpperCase()
          ) {
            mismatches.push({
              start: roffset + j,
              type: 'mismatch',
              base: seq[soffset + j]!,
              altbase: ref[roffset + j]!,
              length: 1,
            })
          }
        }
      }
      soffset += len
    }
    if (op === 'I') {
      mismatches.push({
        start: roffset,
        type: 'insertion',
        base: `${len}`,
        length: 0,
      })
      soffset += len
    } else if (op === 'D') {
      mismatches.push({
        start: roffset,
        type: 'deletion',
        base: '*',
        length: len,
      })
    } else if (op === 'N') {
      mismatches.push({
        start: roffset,
        type: 'skip',
        base: 'N',
        length: len,
      })
    } else if (op === 'X') {
      const r = seq?.slice(soffset, soffset + len) || []
      const q = qual?.subarray(soffset, soffset + len) || []

      for (let j = 0; j < len; j++) {
        mismatches.push({
          start: roffset + j,
          type: 'mismatch',
          base: r[j] || 'X',
          qual: q[j],
          length: 1,
        })
      }
      soffset += len
    } else if (op === 'H') {
      mismatches.push({
        start: roffset,
        type: 'hardclip',
        base: `H${len}`,
        cliplen: len,
        length: 1,
      })
    } else if (op === 'S') {
      mismatches.push({
        start: roffset,
        type: 'softclip',
        base: `S${len}`,
        cliplen: len,
        length: 1,
      })
      soffset += len
    }

    if (op !== 'I' && op !== 'S' && op !== 'H') {
      roffset += len
    }
  }
  return mismatches
}
