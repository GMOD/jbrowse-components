import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import type { StatusCallback } from '@jbrowse/core/util/parseLineByLine'

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

  parseLineByLine(
    buffer,
    line => {
      if (line.startsWith('#')) {
        headerLines.push(line)
      } else if (line.startsWith('>')) {
        return false // Stop parsing at FASTA section
      } else {
        const ret = line.indexOf('\t')
        const refName = line.slice(0, ret)
        if (!featureMap[refName]) {
          featureMap[refName] = ''
        }
        featureMap[refName] += `${line}\n`
      }
      return true
    },
    statusCallback,
  )

  return {
    header: headerLines.join('\n'),
    featureMap,
  }
}
