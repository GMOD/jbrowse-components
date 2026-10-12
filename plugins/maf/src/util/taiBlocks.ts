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
