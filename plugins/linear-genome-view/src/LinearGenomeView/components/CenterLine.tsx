import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  centerLineContainer: {
    background: 'transparent',
    height: '100%',
    zIndex: 4, // above the track but under menu
    position: 'absolute',
    left: 0,
    border: `1px ${theme.palette.action.active} dashed`,
    borderTop: 'none',
    borderBottom: 'none',
    pointerEvents: 'none',
  },
  centerLineText: {
    position: 'absolute',
    left: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    whiteSpace: 'nowrap',
    fontWeight: 'bold',
  },
  dismiss: {
    // re-enable clicks disabled on the pointer-events:none container
    pointerEvents: 'auto',
    padding: 2,
  },
}))

const CenterLine = observer(function CenterLine({ model }: { model: LGV }) {
  const { bpPerPx, centerLineInfo, trackHeights, tracks, width } = model
  const { classes } = useStyles()
  const startingPosition = width / 2

  return tracks.length ? (
    <div
      data-testid="centerline_container"
      className={classes.centerLineContainer}
      role="presentation"
      style={{
        transform: `translateX(${startingPosition}px)`,
        width: Math.max(1 / bpPerPx, 1),
      }}
    >
      {centerLineInfo && (
        <div
          // text that indicates what bp is center, positioned
          // at the bottom right of the center line
          data-testid="centerline_text"
          className={classes.centerLineText}
          role="presentation"
          style={{
            transform: `translateX(${Math.max(1 / bpPerPx, 1) + 5}px)`,
            top: trackHeights,
          }}
        >
          {centerLineInfo.refName}:{' '}
          {Math.max(Math.round(centerLineInfo.offset) + 1, 0).toLocaleString(
            'en-US',
          )}
          <Tooltip title="Hide center line">
            <IconButton
              className={classes.dismiss}
              onClick={() => {
                model.setShowCenterLine(false)
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </div>
      )}
    </div>
  ) : null
})

export default CenterLine
