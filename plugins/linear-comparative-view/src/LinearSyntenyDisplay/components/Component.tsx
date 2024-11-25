import React, { useEffect, useState } from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import LinearSyntenyRendering from './LinearSyntenyRendering'
import type { LinearSyntenyDisplayModel } from '../model'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },
    blockMessage: {
      background: '#f1f1f1',
      padding: 10,
    },
    blockError: {
      background: '#f1f1f1',
      padding: 10,
      color: 'red',
    },
  }
})

function LoadingMessage() {
  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  const { classes } = useStyles()
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShown(true)
    }, 300)
    return () => {
      clearTimeout(timeout)
    }
  })

  return shown ? (
    <div className={classes.loading}>
      <LoadingEllipses />
    </div>
  ) : null
}

function BlockMessage({ messageText }: { messageText: string }) {
  const { classes } = useStyles()
  return <div className={classes.blockMessage}>{messageText}</div>
}

function BlockError({ error }: { error: unknown }) {
  const { classes } = useStyles()
  return <div className={classes.blockError}>{`${error}`}</div>
}

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  if (model.error) {
    return <BlockError error={model.error} />
  }
  if (model.message) {
    return <BlockMessage messageText={model.message} />
  }
  if (!model.features) {
    return <LoadingMessage />
  }

  return <LinearSyntenyRendering model={model} />
})

export default ServerSideRenderedBlockContent
