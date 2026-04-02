export interface TubeMapNode {
  name: string
  sequenceLength: number
  sequence?: string
  order: number
  x: number
  y: number
  pixelWidth: number
  contentHeight: number
  successors: number[]
  predecessors: number[]
  topLane: number
  degree: number
}

export interface TubeMapTrack {
  id: string
  name: string
  // indices into nodes array; negative = reverse complement
  indexOfFirstBase: number
  sequence: number[]
  type: 'haplotype' | 'read'
  path: PathSegment[]
}

export interface PathSegment {
  order: number
  lane: number
  isForward: boolean
  node: number | null
  y: number
}

export interface TrackAssignment {
  trackID: number
  segmentID: number
  lane: number
  idealLane: number
  idealY: number | null
}

export interface NodeAssignment {
  node: number | null
  tracks: TrackAssignment[]
  idealLane: number
}

export interface TubeMapLayout {
  nodes: TubeMapNode[]
  tracks: TubeMapTrack[]
  maxX: number
  maxY: number
}
