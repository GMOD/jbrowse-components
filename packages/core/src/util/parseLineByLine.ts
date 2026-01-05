import { getProgressDisplayStr } from './index'

export type StatusCallback = (arg: string) => void
export type LineCallback = (
  line: string,
  lineIndex: number,
) => boolean | undefined

/**
 * Parse buffer line by line, calling a callback for each line
 * @param buffer - The buffer to parse
 * @param lineCallback - Callback function called for each line. Return false to stop parsing.
 * @param statusCallback - Optional callback for progress updates
 */
export function parseLineByLine(
  buffer: Uint8Array,
  lineCallback: LineCallback,
  statusCallback: StatusCallback = () => {},
) {
  const decoder = new TextDecoder('utf8')
  let blockStart = 0
  let i = 0

  while (blockStart < buffer.length) {
    const n = buffer.indexOf(10, blockStart)
    // could be a non-newline ended file, so subarray to end of file if n===-1
    const lineEnd = n === -1 ? buffer.length : n
    const b = buffer.subarray(blockStart, lineEnd)
    const line = decoder.decode(b).trim()

    if (line) {
      const shouldContinue = lineCallback(line, i)
      if (shouldContinue === false) {
        break
      }
    }

    if (i++ % 10_000 === 0) {
      statusCallback(
        `Loading ${getProgressDisplayStr(blockStart, buffer.length)}`,
      )
    }

    // If no newline found, we've reached the end
    blockStart = lineEnd + 1
  }
}
