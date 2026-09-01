// The follow state every surface that reads or takes the anchor agrees on: the
// header toggle, the sync menu, the row menus, the off-screen mate click and
// the LGV display's panel move each used to redeclare these three.
export interface FollowHost {
  followSynteny: boolean
  followAnchorIndex: number
  setFollowAnchorIndex: (idx: number) => void
}

/**
 * A level that refused its multi-contig answer, in the two names the header
 * needs: the anchor region the rows are following, and the ones whose answers
 * are not on screen. Named regions rather than a bare flag, since scrolling the
 * anchor onto one of them is how the reader reaches the other answer.
 */
export interface FollowPartialReport {
  following: string
  elsewhere: string[]
}

// What the last settled pass has to say about itself, written by the follow's
// autorun and read only by the header, which is what keeps it from being a
// dependency of the very pass that writes it.
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
