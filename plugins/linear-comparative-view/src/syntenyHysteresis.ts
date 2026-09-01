// The two thresholds every re-decision a pan can flip shares, in one place
// because three subsystems re-choose on them: the synteny follow (its block,
// its envelope's contig, its refused spread), the multi-way lane (its contig,
// its mirror) and the launch's panel resolution (its median block).

// Without a margin, two candidates covering the same window within a few bp
// (a segmental duplication, a fragmented assembly, two rows of an all-vs-all
// file) trade places on the rounding a pan produces, and the followed panel
// snaps between paralogous loci while the anchor moves smoothly.
const SWITCH_MARGIN = 1.5

// A vote past this share in either direction turns a row or a lane round;
// anything between is a window showing both orientations, and flipping it
// would hide half.
export const NEARLY_ALL = 0.9

/** the incumbent unless the best clears it by the switch margin */
export function preferIncumbent<T extends { overlap: number }>(
  best: T | undefined,
  incumbent: T | undefined,
) {
  return incumbent && best && best.overlap < incumbent.overlap * SWITCH_MARGIN
    ? incumbent
    : best
}
