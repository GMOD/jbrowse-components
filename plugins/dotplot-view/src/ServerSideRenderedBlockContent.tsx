import React, { useEffect, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { Typography, LinearProgress } from '@material-ui/core'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'

const useStyles = makeStyles({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: '#f1f1f1',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    height: '100%',
    width: '100%',
    textAlign: 'center',
  },
  error: {
    display: 'block',
    color: 'red',
    width: '30em',
    wordWrap: 'normal',
    whiteSpace: 'normal',
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
  const classes = useStyles()
  useEffect(() => {
    const timeout = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(timeout)
  }, [])

  return shown ? (
    <div data-testid="loading-synteny" className={classes.loading}>
      <Typography>Loading &hellip;</Typography>
      <LinearProgress />
    </div>
  ) : null
}

function BlockMessage({ messageText }: { messageText: string }) {
  const classes = useStyles()
  return (
    <div className={classes.blockMessage}>
      <Typography>{messageText}</Typography>
    </div>
  )
}
BlockMessage.propTypes = {
  messageText: PropTypes.string.isRequired,
}

function BlockError({ error }: { error: Error }) {
  const classes = useStyles()
  return (
    <div className={classes.blockError}>
      <Typography>{error.message}</Typography>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ServerSideRenderedBlockContent = observer(({ model }: { model: any }) => {
  if (model.error) {
    return <BlockError error={model.error} data-testid="reload_button" />
  }
  if (model.message) {
    return <BlockMessage messageText={model.message} />
  }
  if (!model.filled) {
    return <LoadingMessage />
  }
  return model.reactElement
})

export default ServerSideRenderedBlockContent
