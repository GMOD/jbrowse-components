import React, { useEffect, useState, CSSProperties } from 'react'
import { makeStyles } from 'tss-react/mui'
import { Typography } from '@mui/material'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    blockError: {
      backgroundColor: bg,
      color: 'red',
      padding: '10px',
    },

    blockMessage: {
      backgroundColor: bg,
      padding: '10px',
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
      <Typography>{`${messageText}`}</Typography>
    </div>
  )
}

function BlockError({ error }: { error: unknown }) {
  const { classes } = useStyles()
  return (
    <div className={classes.blockError}>
      <Typography>{`${error}`}</Typography>
    </div>
  )
}

const ServerSideRenderedDotplotContent = observer(function ({
  model,
  style,
}: {
  model: {
    error?: unknown
    message?: string
    filled?: boolean
    shouldDisplay?: boolean
    reactElement?: React.ReactElement
  }
  style: CSSProperties
}) {
  if (model.error) {
    return <BlockError error={model.error} data-testid="reload_button" />
  } else if (model.message) {
    return <BlockMessage messageText={model.message} />
  } else if (!model.filled) {
    return <LoadingMessage />
  } else if (model.shouldDisplay) {
    return <div style={style}>{model.reactElement}</div>
  }
  return null
})

export default ServerSideRenderedDotplotContent
