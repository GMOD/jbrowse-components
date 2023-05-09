import React from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { makeStyles } from 'tss-react/mui'
import { LinearReadCloudDisplayModel } from '../LinearReadCloudDisplay/model'
import { getContainingView } from '@jbrowse/core/util'
import { LinearReadArcsDisplayModel } from '../LinearReadArcsDisplay/model'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      height: '100%',
      width: '100%',
      pointerEvents: 'none',
      textAlign: 'center',
    },
  }
})

export default observer(function ({
  model,
  children,
}: {
  model: LinearReadArcsDisplayModel | LinearReadCloudDisplayModel
  children?: React.ReactNode
}) {
  const view = getContainingView(model)
  const { classes } = useStyles()
  const { drawn, loading, error, regionTooLarge, message } = model
  return error ? (
    <BlockMsg
      message={`${error}`}
      severity="error"
      buttonText="Reload"
      action={model.reload}
    />
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : loading ? (
    <div
      className={classes.loading}
      style={{
        width: view.dynamicBlocks.totalWidthPx,
        height: 20,
      }}
    >
      <LoadingEllipses message={message} />
    </div>
  ) : (
    // this data-testid is located here because changing props on the canvas
    // itself is very sensitive to triggering ref invalidation
    <div data-testid={`drawn-${drawn}`}>{children}</div>
  )
})
