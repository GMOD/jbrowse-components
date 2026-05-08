export type Coord = [number, number] | undefined

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

export interface DotplotViewInit {
  views: {
    assembly: string
  }[]
  tracks?: string[]
}
