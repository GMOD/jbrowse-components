import { matchFormat } from '@jbrowse/add-track-core'
import { getFileName } from '@jbrowse/core/util'
import { isLocalPathLocation, isUriLocation } from '@jbrowse/core/util/types'

import { withoutExtension } from '../util.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

export interface MemberConfig {
  type?: string
  [key: string]: unknown
}

export function adapterSpec(adapterType: string) {
  return matchFormat('', adapterType)?.spec
}

function primaryLocation(config: MemberConfig): FileLocation | undefined {
  const spec = config.type ? adapterSpec(config.type) : undefined
  const location =
    spec && 'locField' in spec
      ? (config[spec.locField] as FileLocation | undefined)
      : undefined
  return (
    location ??
    (typeof config.uri === 'string'
      ? { uri: config.uri, locationType: 'UriLocation' }
      : undefined)
  )
}

export function getPrimaryLocationPath(config: MemberConfig) {
  const location = primaryLocation(config)
  return isUriLocation(location)
    ? location.uri.split(/[?#]/, 1)[0]
    : isLocalPathLocation(location)
      ? location.localPath
      : undefined
}

export function getFilenameFromAdapterConfig(config: MemberConfig) {
  const location = primaryLocation(config)
  const name = location ? getFileName(location) : ''
  return name ? withoutExtension(name) : undefined
}
