// note that these are currently put into the style section instead of being
// defined in classes to aid copy and paste to an external document e.g. word
export const intronColor = undefined
export const utrColor = 'rgb(200,240,240)'
export const proteinColor = 'rgb(220,160,220)'
export const cdsColor = 'rgb(220,220,180)'
export const updownstreamColor = 'rgba(250,200,200)'
export const genomeColor = 'rgb(200,280,200)'

export function splitString(str: string, size: number, initial: number) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  let iter = 0
  let offset = 0
  for (; iter < numChunks + 1; ++iter) {
    const inc = iter === 0 ? size - initial : size
    const r = str.slice(offset, offset + inc)
    if (!r) {
      break
    }
    chunks[iter] = r
    offset += inc
  }

  return {
    segments: chunks,
    remainder: ((chunks.at(-1)?.length || 0) + (iter < 2 ? initial : 0)) % size,
  }
}
