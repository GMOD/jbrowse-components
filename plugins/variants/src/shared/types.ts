export interface Source {
  baseUri?: string
  name: string
  sampleName?: string
  color?: string
  group?: string
  HP?: number
  [key: string]: unknown
}

export type ProcessedSource = Source & { sampleName: string }

export interface SampleInfo {
  isPhased: boolean
  maxPloidy: number
}
