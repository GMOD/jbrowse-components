import type { Mismatch } from '../shared/types'

export function mdToMismatches(
  mdstring: string,
  ops: string[],
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Uint8Array,
) {
  const mismatchRecords: Mismatch[] = []
  const opsLength = ops.length
  const seqLength = seq.length
  const hasQual = qual !== undefined

  // only check for skips if cigarMismatches has any
  const cigarLength = cigarMismatches.length
  let hasSkips = false
  for (let k = 0; k < cigarLength; k++) {
    if (cigarMismatches[k]!.type === 'skip') {
      hasSkips = true
      break
    }
  }

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

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
      currStart += num
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
      currStart += delLen
    } else if (char >= 65 && char <= 90) {
      // letter (A-Z) - mismatch
      const letter = mdstring[i]!
      i++

      if (hasSkips) {
        while (lastSkipPos < cigarLength) {
          const mismatch = cigarMismatches[lastSkipPos]!
          if (mismatch.type === 'skip' && currStart >= mismatch.start) {
            currStart += mismatch.length
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
        j < opsLength && refOffset <= currStart;
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
      const s = templateOffset - (refOffset - currStart)

      const base = s < seqLength ? seq[s] : 'X'
      mismatchRecords.push({
        start: currStart,
        base,
        qual: hasQual ? qual[s] : undefined,
        altbase: letter,
        length: 1,
        type: 'mismatch',
      })

      currStart++
    } else {
      i++
    }
  }
  return mismatchRecords
}
