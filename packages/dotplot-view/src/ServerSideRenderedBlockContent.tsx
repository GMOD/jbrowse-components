import { makeStyles } from '@material-ui/core/styles'
import LinearProgress from '@material-ui/core/LinearProgress'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import ServerSideRenderedContent from './ServerSideRenderedContent'

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
      Loading &hellip;
      <LinearProgress />
    </div>
  ) : null
}

function BlockMessage({ messageText }: { messageText: string }) {
  const classes = useStyles()
  return <div className={classes.blockMessage}>{messageText}</div>
}
BlockMessage.propTypes = {
  messageText: PropTypes.string.isRequired,
}

function BlockError({ error, reload }: { error: Error; reload: () => void }) {
  const classes = useStyles()
  return <div className={classes.blockError}>{error.message}</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ServerSideRenderedBlockContent = observer(({ model }: { model: any }) => {
  if (model.error) {
    return (
      <BlockError
        error={model.error}
        reload={model.reload}
        data-testid="reload_button"
      />
    )
  }
  if (model.message) {
    return <BlockMessage messageText={model.message} />
  }
  if (!model.filled) {
    return <LoadingMessage />
  }

  return <ServerSideRenderedContent model={model} />
})

export default ServerSideRenderedBlockContent
