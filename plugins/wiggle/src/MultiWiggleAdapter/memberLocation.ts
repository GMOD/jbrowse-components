import { matchFormat } from '@jbrowse/add-track-core'

import { getFilename } from '../util.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

export interface MemberConfig {
  type?: string
  [key: string]: unknown
}

export function adapterSpec(adapterType: string) {
  return matchFormat('', adapterType)?.spec
}

export function getLocationPath(location?: FileLocation) {
  return location === undefined
    ? undefined
    : 'uri' in location && location.uri
      ? location.uri
      : 'localPath' in location && location.localPath
        ? location.localPath
        : 'blob' in location && location.blob instanceof File
          ? location.blob.name || undefined
          : undefined
}

export function getPrimaryLocationPath(config: MemberConfig) {
  const spec = config.type ? adapterSpec(config.type) : undefined
  return spec && 'locField' in spec
    ? getLocationPath(config[spec.locField] as FileLocation | undefined)
    : undefined
}

export function getFilenameFromAdapterConfig(config: MemberConfig) {
  const path = getPrimaryLocationPath(config)
  return path ? getFilename(path) : undefined
}
