// note that these are currently put into the style section instead of being
// defined in classes to aid copy and paste to an external document e.g. word
export const intronColor = undefined
export const utrColor = 'rgb(200,240,240)'
export const proteinColor = 'rgb(220,160,220)'
export const cdsColor = 'rgb(220,220,180)'
export const updownstreamColor = 'rgba(250,200,200)'
export const genomeColor = 'rgb(200,280,200)'

export function splitString({
  str,
  charactersPerRow,
  showCoordinates,
  currRemainder = 0,
  splitSize = 10,
}: {
  str: string
  charactersPerRow: number
  showCoordinates: boolean
  currRemainder?: number
  splitStart?: number
  splitSize?: number
}) {
  const numChunks = Math.ceil(str.length / charactersPerRow)
  const chunks = new Array(numChunks)
  let splitStart = currRemainder % 10

  let iter = 0
  let offset = 0
  for (; iter < numChunks + 1; ++iter) {
    const inc = iter === 0 ? charactersPerRow - currRemainder : charactersPerRow
    const r = str.slice(offset, offset + inc)
    if (!r) {
      break
    }
    if (showCoordinates) {
      let res = ''
      for (let i = 0, j = splitStart; i < r.length; i++, j++) {
        // note: this adds a space at the start but it causes trouble to try to
        // say e.g. j%splitSize==0 && j to try to only add non-zero spaces
        if (j % splitSize === 0) {
          res += ' '
          j = 0
        }
        res += r[i]
      }
      if (res) {
        chunks[iter] = res
      }
    } else {
      chunks[iter] = r
    }
    splitStart = 0 // after newline, reset
    offset += inc
  }

  return {
    segments: chunks,
    remainder:
      ((chunks.at(-1)?.replaceAll(' ', '').length || 0) +
        (iter < 2 ? currRemainder : 0)) %
      charactersPerRow,
  }
}
