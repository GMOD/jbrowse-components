import type { RowHit } from './components/findRowHover.ts'

export interface GenomicPosition {
  refName: string
  coord: number
}

export type MafHover = RowHit & {
  sampleLabel: string
}
