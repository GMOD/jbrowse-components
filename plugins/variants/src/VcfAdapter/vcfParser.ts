import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import type { StatusCallback } from '@jbrowse/core/util/parseLineByLine'

interface VcfParseResult {
  header: string
  featureMap: Record<string, string[]>
}

/**
 * Parse VCF buffer into header lines and feature map organized by reference name
 * @param buffer - The VCF file buffer
 * @param statusCallback - Optional callback for progress updates
 * @returns Object containing header lines and feature map
 */
export function parseVcfBuffer(
  buffer: Uint8Array,
  statusCallback: StatusCallback = () => {},
): VcfParseResult {
  const headerLines: string[] = []
  const featureMap: Record<string, string[]> = {}

  parseLineByLine(
    buffer,
    (line) => {
      if (line.startsWith('#')) {
        headerLines.push(line)
      } else {
        const ret = line.indexOf('\t')
        const refName = line.slice(0, ret)
        if (!featureMap[refName]) {
          featureMap[refName] = []
        }
        featureMap[refName].push(line)
      }
    },
    statusCallback,
  )

  return {
    header: headerLines.join('\n'),
    featureMap,
  }
}