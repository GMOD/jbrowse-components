/** One read's copy in one region: its lane, its region, and its index there. */
export interface ReadSlot {
  displayedRegionIndex: number
  groupKey: string
  idx: number
}
