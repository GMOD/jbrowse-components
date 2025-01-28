export interface Source {
  baseUri?: string
  name: string
  label?: string
  color?: string
  group?: string
  HP?: number
  id?: string
  [key: string]: unknown
}

export interface SampleInfo {
  isPhased: boolean
  maxPloidy: number
}
