import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { Typography } from '@mui/material'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: '#f1f1f1',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    textAlign: 'center',
  },

  blockMessage: {
    background: '#f1f1f1',
    padding: '10px',
  },
  blockError: {
    background: '#f1f1f1',
    padding: '10px',
    color: 'red',
  },
})

function LoadingMessage() {
  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  const { classes } = useStyles()
  useEffect(() => {
    const timeout = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(timeout)
  }, [])

  return shown ? (
    <div className={classes.loading}>
      <LoadingEllipses />
    </div>
  ) : null
}

function BlockMessage({ messageText }: { messageText: string }) {
  const { classes } = useStyles()
  return (
    <div className={classes.blockMessage}>
      <Typography>{messageText}</Typography>
    </div>
  )
}

function BlockError({ error }: { error: Error }) {
  const { classes } = useStyles()
  return (
    <div className={classes.blockError}>
      <Typography>{error.message}</Typography>
    </div>
  )
}

const ServerSideRenderedBlockContent = observer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ model, style }: { model: any; style: any }) => {
    if (model.error) {
      return <BlockError error={model.error} data-testid="reload_button" />
    }
    if (model.message) {
      return <BlockMessage messageText={model.message} />
    }
    if (!model.filled) {
      return <LoadingMessage />
    }
    return <div style={style}>{model.reactElement}</div>
  },
)

export default ServerSideRenderedBlockContent
