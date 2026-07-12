/* eslint-disable react-refresh/only-export-components -- the shared row width belongs with these leaf menu-row primitives; no component state to fast-refresh */
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { IconButton, Tooltip } from '@mui/material'

// Shared width for inline track-menu control rows (the size sliders and the
// wiggle resolution stepper), so the rows line up when they stack in one menu
// and can't drift apart.
export const INLINE_MENU_ROW_WIDTH = 220

// Shared "reset to default" affordance for those rows. A compact icon button in
// a span so its Tooltip still shows while disabled at the default. Kept in one
// place so the icon/size/padding and the disabled-at-default behavior stay
// identical across the sibling controls.
export function ResetToDefaultButton({
  disabled,
  title = 'Reset to default',
  onClick,
}: {
  disabled: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          sx={{ p: 0.25 }}
          disabled={disabled}
          onClick={() => {
            onClick()
          }}
        >
          <RestartAltIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}
