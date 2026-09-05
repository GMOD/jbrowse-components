import { pluralize } from '@jbrowse/core/util'
import TrackControl from '@jbrowse/display-kit/TrackControl'

// Collecting features filters nothing until the user applies the list, so the
// (×) is the only way to abandon a part-built selection.
export default function SoloSelectionChip({
  count,
  applied,
  featureNoun,
  onApply,
  onClear,
}: {
  count: number
  applied: boolean
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
      label={applied ? counted : `${count} selected`}
      tooltip={
        applied
          ? `Clear the show-only list to show all ${pluralize(2, featureNoun)} again`
          : `Show only these ${counted}`
      }
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
