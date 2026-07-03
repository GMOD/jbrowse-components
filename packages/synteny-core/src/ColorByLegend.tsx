import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Tooltip } from '@mui/material'

import { colorByShortLabel, getColorBySwatch } from './colorLegend.ts'

import type { SyntenyColorBy } from './colorUtils.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 100,
    pointerEvents: 'auto',
    padding: '2px 2px 4px 6px',
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    opacity: 0.9,
    boxShadow: theme.shadows[2],
    fontSize: '0.7rem',
    maxWidth: 200,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  title: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  close: {
    padding: 1,
  },
  ramp: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingRight: 4,
  },
  bar: {
    flex: 1,
    height: 10,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
  },
  domainLabel: {
    fontSize: '0.62rem',
    opacity: 0.8,
    whiteSpace: 'nowrap',
  },
  note: {
    fontSize: '0.62rem',
    opacity: 0.8,
    paddingRight: 4,
  },
}))

// Floating, dismissible legend for the active color-by mode. Presentational —
// the plugin gates visibility on its own model flag and supplies onClose.
export function ColorByLegend({
  colorBy,
  onClose,
}: {
  colorBy: SyntenyColorBy
  onClose: () => void
}) {
  const { classes } = useStyles()
  const swatch = getColorBySwatch(colorBy)
  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <span className={classes.title}>{colorByShortLabel[colorBy]}</span>
        <Tooltip title="Hide legend">
          <IconButton
            className={classes.close}
            size="small"
            onClick={() => {
              onClose()
            }}
          >
            <CloseIcon style={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </div>
      {swatch ? (
        <div className={classes.ramp}>
          <span className={classes.domainLabel}>{swatch.minLabel}</span>
          <span
            className={classes.bar}
            style={{ background: swatch.background }}
          />
          <span className={classes.domainLabel}>{swatch.maxLabel}</span>
        </div>
      ) : (
        <div className={classes.note}>Distinct color per sequence</div>
      )}
    </div>
  )
}
