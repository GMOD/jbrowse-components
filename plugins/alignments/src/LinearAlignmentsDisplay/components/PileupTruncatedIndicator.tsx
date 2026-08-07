import { TrackControl } from '@jbrowse/plugin-linear-genome-view'

// Bottom-right notice for a pileup clipped by the display-wide `maxHeight`:
// reads past the ceiling are collapsed onto the bottom row, so the track is
// showing strictly less than its data and pressing this raises the ceiling.
// Only offered where raising it helps, which is `pileupTruncated`'s job (a
// per-group clip has its own affordance on the section label, see
// `groupClippedBy`).
//
// Dropping features is data loss, so it takes the `warning` tone rather than
// hiding in the tooltip, the same call `TrackHeightIndicator` makes for the
// features a layout could not place.
//
// A `TrackControl` rather than markup of its own: this used to be a themed div
// plus a Material `Link`, which made it the one ambient corner control that
// ignored the bring-your-own seam. An embedder who installed `plainTrackControl`
// got plain controls everywhere until a pileup happened to truncate, and then a
// Material widget appeared in the corner. See
// `agent-docs/reference/DISPLAYCHROME.md`.
export default function PileupTruncatedIndicator({
  onShowAll,
}: {
  onShowAll: () => void
}) {
  return (
    <TrackControl
      icon="height"
      warning
      label="Max height reached"
      tooltip="Reads past the layout height cap are collapsed onto the bottom row. Press to lay out all of them."
      onClick={onShowAll}
    />
  )
}
