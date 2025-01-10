import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface Display {
  id: string
  [key: string]: unknown
}

export interface Track {
  id: string
  displays: Display[]
  [key: string]: unknown
}

export interface BreakpointSplitView {
  views: LinearGenomeViewModel[]
}
