import { TabixIndexedFile } from '@gmod/tabix'
import { openLocation } from '@jbrowse/core/util/io'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'

export function parseGfaPathName(path: string) {
  const parts = path.split('#')
  if (parts.length >= 3) {
    return {
      genome: parts.slice(0, -1).join('#'),
      refName: parts[parts.length - 1]!,
    }
  }
  return { genome: parts[0]!, refName: parts[1] ?? parts[0]! }
}

export function hasFileLocation(
  loc: FileLocation | undefined,
): loc is FileLocation {
  if (!loc) {
    return false
  }
  if ('uri' in loc) {
    return loc.uri !== ''
  }
  if ('localPath' in loc) {
    return loc.localPath !== ''
  }
  if ('blobId' in loc) {
    return loc.blobId !== ''
  }
  return false
}

export function readHeaderField(header: string, key: string) {
  const m = new RegExp(String.raw`${key}=([^\n\s]+)`).exec(header)
  return m?.[1]
}

export function parseSizesField(sizesField: string) {
  const entries: { refName: string; genome: string; length: number }[] = []
  for (const entry of sizesField.split(',')) {
    const colonIdx = entry.lastIndexOf(':')
    if (colonIdx === -1) {
      continue
    }
    const { genome, refName } = parseGfaPathName(entry.slice(0, colonIdx))
    entries.push({ refName, genome, length: +entry.slice(colonIdx + 1) })
  }
  return entries
}

export function openTabixIfConfigured(
  loc: FileLocation | undefined,
  idxLoc: FileLocation | undefined,
  pm: PluginManager | undefined,
) {
  if (!hasFileLocation(loc) || !hasFileLocation(idxLoc)) {
    return undefined
  }
  return new TabixIndexedFile({
    filehandle: openLocation(loc, pm),
    tbiFilehandle: openLocation(idxLoc, pm),
    chunkCacheSize: 50 * 2 ** 20,
  })
}
