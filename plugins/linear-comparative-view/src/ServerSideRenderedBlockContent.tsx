import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { LoadingEllipses } from '@jbrowse/core/ui'

const useStyles = makeStyles()({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: '#f1f1f1',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    height: '100%',
    width: '100%',
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

interface Display {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderingComponent: React.FC<any>
  error: unknown
  message: string
  filled: boolean
}

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: Display
}) {
  if (model.error) {
    return <BlockError error={model.error} />
  }
  if (model.message) {
    return <BlockMessage messageText={model.message} />
  }
  if (!model.filled) {
    return <LoadingMessage />
  }

  return <model.renderingComponent displayModel={model} />
})

export default ServerSideRenderedBlockContent
