/**
 * The lines of a `.tai` slice that the byte range did not cut. A slice that
 * does not end on a newline had its last line truncated, and neither that line
 * nor the block holding it can be trusted: emitting the block puts a short
 * sequence at real coordinates. `endsClean` is false there, so a parser leaves
 * its open block unemitted.
 */
export function wholeLines(text: string) {
  const endsClean = text.endsWith('\n')
  const lines = text.split('\n')
  if (!endsClean) {
    lines.pop()
  }
  return { lines, endsClean }
}

const NEWLINE = 10

/**
 * Line starts in `text` as byte offsets into the `bytes` it decoded from, asked
 * in rising order. A newline byte never sits inside a UTF-8 sequence, so the
 * two walk in step by newline.
 */
export function byteOffsetsOf(text: string, bytes: Uint8Array) {
  const first =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  let char = 0
  let byte = first
  return text.length === bytes.length - first
    ? (charOffset: number) => first + charOffset
    : (charOffset: number) => {
        if (charOffset < char) {
          char = 0
          byte = first
        }
        let next = char < charOffset ? text.indexOf('\n', char) : -1
        while (next !== -1) {
          char = next + 1
          byte = bytes.indexOf(NEWLINE, byte) + 1
          next = char < charOffset ? text.indexOf('\n', char) : -1
        }
        return byte
      }
}
