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
  flipped: boolean
  bpPerRadian: number
  startRadians: number
  region: AnyRegion
}
