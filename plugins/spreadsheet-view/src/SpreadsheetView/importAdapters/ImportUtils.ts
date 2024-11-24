import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Buffer } from 'buffer'

export function bufferToString(buffer: Buffer) {
  return new TextDecoder('utf8', { fatal: true }).decode(buffer)
}

export interface Row {
  id: string
  feature?: SimpleFeatureSerialized
}
