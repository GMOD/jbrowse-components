import FilterAltIcon from '@mui/icons-material/FilterAlt'

import StatusChip from './StatusChip.tsx'

// Bottom-right badge for the "show only these features" collection. While the
// user is collecting (ctrl/cmd+click or the right-click "Add to show-only set"
// item) it shows the count and is clickable to isolate the view to the set;
// once applied it reports what's shown and its delete (×) restores everything.
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
  const noun = `${count} feature${count > 1 ? 's' : ''}`
  return applied ? (
    <StatusChip
      icon={<FilterAltIcon />}
      label={`Showing ${noun}`}
      tooltip="Remove the filter to show all features again"
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
