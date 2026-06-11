import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'

export type Mode = 'guided' | 'bulk'

const useStyles = makeStyles()(theme => ({
  modeToggle: {
    marginBottom: theme.spacing(1),
  },
}))

export default function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: Mode
  setMode: (mode: Mode) => void
  disabled: boolean
}) {
  const { classes } = useStyles()
  return (
    <ToggleButtonGroup
      className={classes.modeToggle}
      size="small"
      exclusive
      disabled={disabled}
      value={mode}
      onChange={(_event, value: Mode | null) => {
        if (value) {
          setMode(value)
        }
      }}
    >
      <ToggleButton value="guided">Guided</ToggleButton>
      <ToggleButton value="bulk">Drop / paste files</ToggleButton>
    </ToggleButtonGroup>
  )
}
