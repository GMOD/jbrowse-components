import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export type Coord = [number, number] | undefined

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface DotplotViewInit extends SyntenyViewSharedInit {
  views: {
    assembly: string
  }[]
  tracks?: string[]
}
