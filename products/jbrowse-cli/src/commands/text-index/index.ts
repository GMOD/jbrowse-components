export { aggregateIndex } from './aggregate.ts'
export { perTrackIndex } from './per-track.ts'
export { indexFileList } from './file-list.ts'
export { run } from './command.ts'

/**
 * Type-safe flags interface for text-index command
 */
export interface TextIndexFlags {
  // Common flags
  out?: string
  target?: string
  tracks?: string
  excludeTracks?: string
  attributes: string
  quiet?: boolean
  exclude: string
  prefixSize?: string | number
  force?: boolean
  dryrun?: boolean

  // Aggregate/per-track specific
  assemblies?: string
  perTrack?: boolean

  // File-list specific
  file?: string[]
  fileId?: string[]
}
