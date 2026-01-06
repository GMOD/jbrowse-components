export interface MinimalFeature {
  type: string
  start: number
  end: number
  refName: string
  uniqueId?: string
  phase?: number
  [key: string]: unknown
}
