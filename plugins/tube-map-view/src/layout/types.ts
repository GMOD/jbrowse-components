export interface TubeMapNode {
  name: string
  sequenceLength: number
  sequence?: string
  order: number
  x: number
  y: number
  pixelWidth: number
  contentHeight: number
  successors: Set<number>
  predecessors: Set<number>
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

export interface TubeMapLayout {
  nodes: TubeMapNode[]
  tracks: TubeMapTrack[]
  // order → x coordinate lookup for efficient edge rendering
  orderToX: Float64Array
  maxX: number
  maxY: number
}
