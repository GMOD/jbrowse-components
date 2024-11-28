export function parseStrand(strand?: string) {
  if (strand === '+') {
    return 1
  } else if (strand === '-') {
    return -1
  } else {
    return undefined
  }
}

export function bufferToLines(buffer: Uint8Array) {
  return new TextDecoder('utf8')
    .decode(buffer)
    .split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(f => !!f)
}
