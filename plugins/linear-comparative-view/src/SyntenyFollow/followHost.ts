import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FollowHost {
  followSynteny: boolean
  followAnchorIndex: number
  setFollowAnchorIndex: (idx: number) => void
}

// `holdFollowAnchor` runs a navigation as a nested action, which the gesture
// middleware lets by
export interface FollowAnchorHost extends IStateTreeNode, FollowHost {
  views: readonly unknown[]
  holdFollowAnchor: <T>(fn: () => T) => T
}

// a level that refused its multi-contig answer: the anchor region the rows
// follow, and the ones whose answers are off screen
export interface FollowPartialReport {
  following: string
  elsewhere: string[]
}

// written by the settle and read only by the header
export interface FollowReport {
  // nothing loaded covers the anchor's window, so the other rows are holding
  unaligned: boolean
  // a row was placed proportionally rather than by a CIGAR walk
  approximate: boolean
  // a level between two rows has no synteny track to follow by at all
  noSyntenyTrack: boolean
  partial: FollowPartialReport | undefined
}

export const EMPTY_FOLLOW_REPORT: FollowReport = {
  unaligned: false,
  approximate: false,
  noSyntenyTrack: false,
  partial: undefined,
}
