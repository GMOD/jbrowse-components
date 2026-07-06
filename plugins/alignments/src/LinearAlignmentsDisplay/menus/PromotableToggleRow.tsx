import { makeStyles } from '@jbrowse/core/util/tss-react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'


const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    cursor: 'pointer',
  },
  label: {
    flexGrow: 1,
  },
  // right-aligned "default for all" control, kept compact so it reads as a
  // secondary scope toggle next to the primary value check
  defaultLabel: {
    margin: 0,
  },
  defaultCheckbox: {
    padding: theme.spacing(0.25),
  },
}))

// One menu row that carries both axes of a promotable setting: the primary
// value (this track) and whether that value is the session-wide default for all
// tracks of this type. Clicking the row toggles the value (matching a normal
// checkbox row, value check on the right); the inset "default for all" checkbox
// promotes/clears the default and is only shown when the value is on (there's
// nothing to promote otherwise). Replaces the old two-sibling-rows layout where
// the make-default checkbox floated indistinguishably next to unrelated toggles.
export function PromotableToggleRow({
  label,
  checked,
  onToggle,
  isDefault,
  onToggleDefault,
  showDefault,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  isDefault: boolean
  onToggleDefault: () => void
  showDefault: boolean
}) {
  const { classes } = useStyles()
  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked}
      className={classes.row}
      onClick={() => {
        onToggle()
      }}
    >
      <Typography variant="body2" className={classes.label}>
        {label}
      </Typography>
      {showDefault ? (
        <FormControlLabel
          className={classes.defaultLabel}
          labelPlacement="start"
          onClick={e => {
            e.stopPropagation()
          }}
          control={
            <Checkbox
              size="small"
              className={classes.defaultCheckbox}
              checked={isDefault}
              onChange={() => {
                onToggleDefault()
              }}
            />
          }
          label={
            <Typography variant="caption" color="textSecondary">
              default for all
            </Typography>
          }
        />
      ) : null}
      {checked ? (
        <CheckBoxIcon fontSize="small" color="action" />
      ) : (
        <CheckBoxOutlineBlankIcon fontSize="small" color="action" />
      )}
    </div>
  )
}
