export interface Filehandle {
  read: (position: number, length: number) => Promise<ArrayBuffer>
}

export interface Chromosome {
  index: number
  name: string
  size: number
}

export interface HicRegion {
  chr: string
  start: number
  end: number
}

export interface Zoom {
  index: number
  unit: string
  binSize: number
}

export interface BlockIndexEntry {
  filePosition: number
  size: number
}

export interface HicMetadata {
  version: number
  genome: string
  chromosomes: Chromosome[]
  resolutions: number[]
}
