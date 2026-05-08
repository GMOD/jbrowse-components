import type { FileLocation } from '@jbrowse/core/util/types'

export function getName(loc?: FileLocation) {
  if (!loc) {
    return undefined
  }
  if ('uri' in loc) {
    return loc.uri
  }
  if ('localPath' in loc) {
    return loc.localPath
  }
  return loc.name
}

export function basename(str: string) {
  return str.split('#')[0]!.split('?')[0]!.split('/').pop()
}
