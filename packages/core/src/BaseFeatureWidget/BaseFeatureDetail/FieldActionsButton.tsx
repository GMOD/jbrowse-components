import FilterListIcon from '@mui/icons-material/FilterList'

import CascadingMenuButton from '../../ui/CascadingMenuButton.tsx'
import { makeStyles } from '../../util/tss-react/index.ts'

import type { FieldActions } from '../types.tsx'

// on a wrapper because MUI folds an Emotion class handed to one of its
// components into a class of its own, which a selector naming it never matches
const useStyles = makeStyles()({
  reveal: {
    opacity: 0,
  },
})

/** A class for a field row that shows its FieldActionsButton on hover or focus. */
export function useRevealFieldActions() {
  const { classes, css } = useStyles()
  const { reveal } = classes
  return css({
    [`&:hover .${reveal}, &:focus-within .${reveal}`]: { opacity: 1 },
  })
}

export default function FieldActionsButton({
  path,
  value,
  fieldActions,
}: {
  path: string[]
  value: unknown
  fieldActions?: FieldActions
}) {
  const { classes } = useStyles()
  const items = fieldActions?.(path, value) ?? []
  return items.length > 0 ? (
    <span className={classes.reveal}>
      <CascadingMenuButton
        menuItems={items}
        size="small"
        tooltip="Filter by this value"
        style={{ padding: 0 }}
      >
        <FilterListIcon fontSize="small" />
      </CascadingMenuButton>
    </span>
  ) : null
}
