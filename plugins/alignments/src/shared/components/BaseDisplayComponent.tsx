import React from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// local
import type { LinearReadArcsDisplayModel } from '../../LinearReadArcsDisplay/model'
import type { LinearReadCloudDisplayModel } from '../../LinearReadCloudDisplay/model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  loading: {
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${theme.palette.action.disabledBackground} 5px, ${theme.palette.action.disabledBackground} 10px)`,
    position: 'absolute',
    bottom: 0,
    height: 50,
    width: 300,
    right: 0,
    pointerEvents: 'none',
    textAlign: 'center',
  },
}))

const BaseDisplayComponent = observer(function ({
  model,
  children,
}: {
  model: LinearReadArcsDisplayModel | LinearReadCloudDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <BlockMsg
      message={`${error}`}
      severity="error"
      action={
        <Tooltip title="Reload">
          <Button
            data-testid="reload_button"
            onClick={() => {
              model.reload()
            }}
          >
            Reload
          </Button>
        </Tooltip>
      }
    />
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <DataDisplay model={model}>{children}</DataDisplay>
  )
})

const DataDisplay = observer(function ({
  model,
  children,
}: {
  model: LinearReadArcsDisplayModel | LinearReadCloudDisplayModel
  children?: React.ReactNode
}) {
  const { drawn, loading } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const left = (model.lastDrawnOffsetPx || 0) - view.offsetPx
  return (
    // this data-testid is located here because changing props on the canvas
    // itself is very sensitive to triggering ref invalidation
    <div data-testid={`drawn-${drawn}`}>
      <div style={{ position: 'absolute', left }}>{children}</div>
      {left !== 0 || loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel | LinearReadCloudDisplayModel
}) {
  const { classes } = useStyles()
  const { message } = model
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={message} />
    </div>
  )
})

export default BaseDisplayComponent
