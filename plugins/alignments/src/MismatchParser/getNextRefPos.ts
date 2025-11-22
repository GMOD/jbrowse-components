// get relative reference sequence positions for positions given relative to
// the read sequence
export function getNextRefPos(cigarOps: number[], positions: number[]) {
  let readPos = 0
  let refPos = 0
  let currPos = 0
  const ret = []
  for (let i = 0; i < cigarOps.length && currPos < positions.length; i += 2) {
    const len = cigarOps[i]!
    const op = cigarOps[i + 1]!
    if (op === 83 || op === 73) {  // 'S' or 'I'
      for (let i = 0; i < len && currPos < positions.length; i++) {
        if (positions[currPos] === readPos + i) {
          currPos++
        }
      }
      readPos += len
    } else if (op === 68 || op === 78) {  // 'D' or 'N'
      refPos += len
    } else if (op === 77 || op === 88 || op === 61) {  // 'M' or 'X' or '='
      for (let i = 0; i < len && currPos < positions.length; i++) {
        if (positions[currPos] === readPos + i) {
          ret.push({
            ref: refPos + i,
            idx: currPos,
          })
          currPos++
        }
      }
      readPos += len
      refPos += len
    }
  }
  return ret
}
