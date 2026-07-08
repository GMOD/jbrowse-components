import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export interface Region {
  end: number
  start: number
  refName: string
  elided?: false
}

export interface ElidedRegion {
  elided: true
  regions: Region[]
}

export type AnyRegion = Region | ElidedRegion

export interface Block {
  bpPerRadian: number
  startRadians: number
  endRadians: number
  region: AnyRegion
}

export interface ChordDisplayModel {
  error: unknown
  ready: boolean
  svgReady: boolean
  features: Feature[] | undefined
  blocksForRefs: Record<string, Block>
  selectedFeatureId: string | undefined
  configuration: AnyConfigurationModel
  radiusPx: number
  bezierRadius: number
  onChordClick: (feature: Feature) => void
  openErrorDialog: () => void
}
