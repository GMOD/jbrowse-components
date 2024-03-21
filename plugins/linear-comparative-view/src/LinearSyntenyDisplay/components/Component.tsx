import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { LoadingEllipses } from '@jbrowse/core/ui'

// locals
import LinearSyntenyRendering from './LinearSyntenyRendering'
import { LinearSyntenyDisplayModel } from '../model'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    blockError: {
      background: '#f1f1f1',
      color: 'red',
      padding: 10,
    },
    blockMessage: {
      background: '#f1f1f1',
      padding: 10,
    },
    loading: {
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      paddingLeft: '0.6em',
      textAlign: 'center',
    },
  }
})

function LoadingMessage() {
  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  const { classes } = useStyles()
  useEffect(() => {
    const timeout = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(timeout)
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
