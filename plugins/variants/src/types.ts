export interface Source {
  baseUri?: string
  name: string
  label?: string
  color?: string
  group?: string
  HP?: number
  [key: string]: unknown
}

export interface SampleInfo {
  isPhased: boolean
  maxPloidy: number
}
