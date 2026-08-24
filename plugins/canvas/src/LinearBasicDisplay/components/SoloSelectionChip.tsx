import { pluralize } from '@jbrowse/core/util'
import TrackControl from '@jbrowse/display-kit/TrackControl'

// Bottom-right badge for the show-only list. While the user is collecting
// (ctrl/cmd+click or the right-click "Add to show-only list" item) it shows the
// count and is clickable to isolate the view to the list; once applied it
// reports what's shown and its delete (×) restores everything. Nothing is
// filtered until it's applied — that's why `featureFilterCount` counts
// `soloApplied` and this × is the only recovery while still collecting.
export default function SoloSelectionChip({
  count,
  applied,
  featureNoun,
  onApply,
  onClear,
}: {
  count: number
  applied: boolean
  // singular noun for what the track holds, so a variant track's chip says
  // "Showing 3 variants" — see the canvas base's featureNoun getter
  featureNoun: string
  onApply: () => void
  onClear: () => void
}) {
  if (count === 0) {
    return null
  }
  const counted = `${count} ${pluralize(count, featureNoun)}`
  return (
    <TrackControl
      icon="filter"
      label={applied ? `Showing ${counted}` : `${count} selected`}
      tooltip={
        applied
          ? `Clear the show-only list to show all ${pluralize(2, featureNoun)} again`
          : `Show only these ${counted}`
      }
      // Applied, the chip reports rather than acts: the only thing left to do is
      // the (×). While collecting, pressing it is what isolates the view.
      onClick={
        applied
          ? undefined
          : () => {
              onApply()
            }
      }
      onDelete={() => {
        onClear()
      }}
    />
  )
}
