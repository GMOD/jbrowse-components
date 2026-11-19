import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import { useAboveMenuZIndex } from './CascadingMenuContext.ts'
import InfoDialog from './InfoDialog.tsx'

export interface MenuHelpEntry {
  key: string
  label: React.ReactNode
  helpText: string
}

const useStyles = makeStyles()({
  paragraph: {
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
  },
})

// Opened from a menu level's Help row, and a React child of that level, so its
// clicks and keys are stopped at the root: a click would reach the row that
// opened it, and an arrow key the MenuList's own focus handling.
const CascadingMenuHelpDialog = observer(function CascadingMenuHelpDialog({
  onClose,
  title,
  intro,
  entries,
}: {
  onClose: () => void
  title?: React.ReactNode
  intro?: string
  entries: MenuHelpEntry[]
}) {
  const { classes } = useStyles()
  const zIndex = useAboveMenuZIndex()
  return (
    <InfoDialog
      open
      onClose={onClose}
      style={{ zIndex }}
      title="Help"
      titleNode={title ? <>Help: {title}</> : undefined}
      onClick={e => {
        e.stopPropagation()
      }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
      onKeyDown={e => {
        e.stopPropagation()
      }}
    >
      {intro ? (
        <Typography variant="body2" className={classes.paragraph}>
          {intro}
        </Typography>
      ) : null}
      {entries.map(({ key, label, helpText }) => (
        <div key={key} className={classes.paragraph}>
          <Typography variant="body2" className={classes.label}>
            {label}
          </Typography>
          <Typography variant="body2">{helpText}</Typography>
        </div>
      ))}
    </InfoDialog>
  )
})

export default CascadingMenuHelpDialog
