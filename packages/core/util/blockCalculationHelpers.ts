import type { Region } from './index.ts'

export interface BlockData {
  assemblyName: string
  refName: string
  start: number
  end: number
  reversed: boolean | undefined
  offsetPx: number
  parentRegion: Region
  regionNumber: number
  widthPx: number
  isLeftEndOfDisplayedRegion: boolean
  isRightEndOfDisplayedRegion: boolean
  key: string
}
