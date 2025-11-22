import type { Mismatch } from '../shared/types'

export function mdToMismatches(
  mdstring: string,
  ops: string[],
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Uint8Array,
) {
  let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0
  const mismatchRecords: Mismatch[] = []
  const opsLength = ops.length

  // only check for skips if cigarMismatches has any
  const cigarLength = cigarMismatches.length
  let hasSkips = false
  for (let k = 0; k < cigarLength; k++) {
    if (cigarMismatches[k]!.type === 'skip') {
      hasSkips = true
      break
    }
  }

  // parse the MD string manually for better performance
  let i = 0
  const len = mdstring.length
  while (i < len) {
    const char = mdstring.charCodeAt(i)

    if (char >= 48 && char <= 57) {
      // digit (0-9)
      let num = 0
      while (i < len) {
        const c = mdstring.charCodeAt(i)
        if (c >= 48 && c <= 57) {
          num = num * 10 + (c - 48)
          i++
        } else {
          break
        }
      }
      curr.start += num
    } else if (char === 94) {
      // '^' deletion
      i++
      let delLen = 0
      while (i < len) {
        const c = mdstring.charCodeAt(i)
        if (c >= 65 && c <= 90) {
          delLen++
          i++
        } else {
          break
        }
      }
      curr.start += delLen
    } else if (char >= 65 && char <= 90) {
      // letter (A-Z) - mismatch
      const letter = mdstring[i]!
      i++

      curr.length = 1

      if (hasSkips) {
        while (lastSkipPos < cigarLength) {
          const mismatch = cigarMismatches[lastSkipPos]!
          if (mismatch.type === 'skip' && curr.start >= mismatch.start) {
            curr.start += mismatch.length
            lastSkipPos++
          } else if (mismatch.type === 'skip') {
            break
          } else {
            lastSkipPos++
          }
        }
      }

      // inlined getTemplateCoordLocal for better performance
      let templateOffset = lastTemplateOffset
      let refOffset = lastRefOffset
      for (
        let j = lastCigar;
        j < opsLength && refOffset <= curr.start;
        j += 2, lastCigar = j
      ) {
        const len = +ops[j]!
        const op = ops[j + 1]!

        if (op === 'S' || op === 'I') {
          templateOffset += len
        } else if (op === 'D' || op === 'P' || op === 'N') {
          refOffset += len
        } else if (op !== 'H') {
          templateOffset += len
          refOffset += len
        }
      }
      lastTemplateOffset = templateOffset
      lastRefOffset = refOffset
      const s = templateOffset - (refOffset - curr.start)

      curr.base = seq[s] || 'X'
      curr.qual = qual?.[s]
      curr.altbase = letter

      // inlined nextRecord
      mismatchRecords.push(curr)
      curr = {
        start: curr.start + curr.length,
        length: 0,
        base: '',
        type: 'mismatch',
      }
    } else {
      i++
    }
  }
  return mismatchRecords
}
