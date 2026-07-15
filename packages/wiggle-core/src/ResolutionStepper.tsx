import type React from 'react'

import { INLINE_MENU_ROW_WIDTH, ResetToDefaultButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { MenuItem } from '@jbrowse/core/ui'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: INLINE_MENU_ROW_WIDTH,
  },
  // subtle text buttons: no uppercase, minimal padding, inherit text color so
  // "Coarser"/"Finer" read as quiet affordances rather than prominent CTAs
  step: {
    textTransform: 'none',
    minWidth: 0,
    padding: '0 4px',
  },
  value: {
    flex: 1,
    textAlign: 'center',
  },
}))

// Live state of a resolution stepper row, read inside the observer so the label
// and disabled edges track the model while the menu stays open.
interface ResolutionStepperState {
  label: string
  finerDisabled: boolean
  coarserDisabled: boolean
  resetDisabled: boolean
}

// Subtle inline stepper: [−] label [+] [reset]. The −/+ icon buttons let the
// user step finer/coarser repeatedly without reopening the menu. Shared by the
// wiggle binning multiplier and the Hi-C matrix binsize, which differ only in
// how they format the label and bound the steps.
const ResolutionStepper = observer(function ResolutionStepper({
  getState,
  onFiner,
  onCoarser,
  onReset,
  resetTitle,
}: {
  getState: () => ResolutionStepperState
  onFiner: () => void
  onCoarser: () => void
  onReset: () => void
  resetTitle?: string
}) {
  const { classes } = useStyles()
  const { label, finerDisabled, coarserDisabled, resetDisabled } = getState()
  return (
    <div className={classes.row}>
      <Button
        className={classes.step}
        size="small"
        color="inherit"
        disabled={coarserDisabled}
        onClick={() => {
          onCoarser()
        }}
      >
        Coarser
      </Button>
      <Typography
        variant="caption"
        color="textSecondary"
        className={classes.value}
      >
        {label}
      </Typography>
      <Button
        className={classes.step}
        size="small"
        color="inherit"
        disabled={finerDisabled}
        onClick={() => {
          onFiner()
        }}
      >
        Finer
      </Button>
      <ResetToDefaultButton
        title={resetTitle}
        disabled={resetDisabled}
        onClick={() => {
          onReset()
        }}
      />
    </div>
  )
})

// A "Resolution" submenu whose single row is the inline stepper, so it sits
// alongside the other track-menu submenus but keeps the menu open while
// stepping. Callers own the label formatting, step bounds, and step actions.
export function makeResolutionSubMenuItem(opts: {
  getState: () => ResolutionStepperState
  onFiner: () => void
  onCoarser: () => void
  onReset: () => void
  icon?: React.ElementType
  resetTitle?: string
}): MenuItem {
  const { getState, onFiner, onCoarser, onReset, icon, resetTitle } = opts
  return {
    label: 'Resolution',
    icon,
    subMenu: [
      {
        label: 'Resolution stepper',
        type: 'custom',
        render: () => (
          <ResolutionStepper
            getState={getState}
            onFiner={onFiner}
            onCoarser={onCoarser}
            onReset={onReset}
            resetTitle={resetTitle}
          />
        ),
      },
    ],
  }
}
