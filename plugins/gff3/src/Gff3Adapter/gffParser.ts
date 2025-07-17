import { getProgressDisplayStr } from '@jbrowse/core/util'

type StatusCallback = (arg: string) => void

interface GffParseResult {
  header: string
  featureMap: Record<string, string>
}

/**
 * Parse GFF3 buffer into header lines and feature map organized by reference name
 * @param buffer - The GFF3 file buffer
 * @param statusCallback - Optional callback for progress updates
 * @returns Object containing header lines and feature map
 */
export function parseGffBuffer(
  buffer: Uint8Array,
  statusCallback: StatusCallback = () => {},
): GffParseResult {
  const headerLines: string[] = []
  const featureMap: Record<string, string> = {}
  const decoder = new TextDecoder('utf8')
  let blockStart = 0
  let i = 0

  while (blockStart < buffer.length) {
    const n = buffer.indexOf(10, blockStart)
    // could be a non-newline ended file, so subarray to end of file if n===-1
    const b =
      n === -1 ? buffer.subarray(blockStart) : buffer.subarray(blockStart, n)
    const line = decoder.decode(b).trim()
    
    if (line) {
      if (line.startsWith('#')) {
        headerLines.push(line)
      } else if (line.startsWith('>')) {
        break
      } else {
        const ret = line.indexOf('\t')
        const refName = line.slice(0, ret)
        if (!featureMap[refName]) {
          featureMap[refName] = ''
        }
        featureMap[refName] += `${line}\n`
      }
    }
    
    if (i++ % 10_000 === 0) {
      statusCallback(
        `Loading ${getProgressDisplayStr(blockStart, buffer.length)}`,
      )
    }

    // If no newline found (n === -1), set blockStart to buffer.length to exit the loop
    blockStart = n === -1 ? buffer.length : n + 1
  }

  return {
    header: headerLines.join('\n'),
    featureMap,
  }
}