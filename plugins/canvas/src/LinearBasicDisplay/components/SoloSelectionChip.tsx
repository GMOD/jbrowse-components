import { pluralize } from '@jbrowse/core/util'
import FilterAltIcon from '@mui/icons-material/FilterAlt'

import StatusChip from './StatusChip.tsx'

// Bottom-right badge for the show-only list. While the user is collecting
// (ctrl/cmd+click or the right-click "Add to show-only list" item) it shows the
// count and is clickable to isolate the view to the list; once applied it
// reports what's shown and its delete (×) restores everything. Nothing is
// filtered until it's applied — that's why `hasFeatureFilters` keys off
// `soloApplied` and this × is the only recovery while still collecting.
export default function SoloSelectionChip({
  count,
  applied,
  onApply,
  onClear,
}: {
  count: number
  applied: boolean
  onApply: () => void
  onClear: () => void
}) {
  if (count === 0) {
    return null
  }
  const noun = `${count} ${pluralize(count, 'feature')}`
  return applied ? (
    <StatusChip
      icon={<FilterAltIcon />}
      label={`Showing ${noun}`}
      tooltip="Clear the show-only list to show all features again"
      onDelete={() => {
        onClear()
      }}
    />
  ) : (
    <StatusChip
      icon={<FilterAltIcon />}
      label={`${count} selected`}
      tooltip={`Show only these ${noun}`}
      onClick={() => {
        onApply()
      }}
      onDelete={() => {
        onClear()
      }}
    />
  )
}
