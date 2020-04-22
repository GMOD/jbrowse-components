import { makeStyles } from '@material-ui/core/styles'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import ServerSideRenderedContent from '../../LinearGenomeView/components/ServerSideRenderedContent'
import BlockError from '../../LinearGenomeView/components/BlockError'

const useStyles = makeStyles(theme => ({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: theme.palette.action.disabledBackground,
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    height: '100%',
    width: '100%',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  error: {
    display: 'block',
    color: theme.palette.error.main,
    width: '30em',
    wordWrap: 'normal',
    whiteSpace: 'normal',
  },
  blockMessage: {
    background: theme.palette.action.disabledBackground,
    padding: theme.spacing(2),
    pointerEvents: 'none',
  },
}))

function LoadingMessage() {
  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  const classes = useStyles()
  useEffect(() => {
    const timeout = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(timeout)
  }, [])

  return shown ? (
    <div className={classes.loading}>
      Loading &hellip;
      <LinearProgress />
    </div>
  ) : null
}

function BlockMessage({ messageText }: { messageText: string }) {
  const classes = useStyles()
  return (
    <Typography variant="body2" className={classes.blockMessage}>
      {messageText}
    </Typography>
  )
}
BlockMessage.propTypes = {
  messageText: PropTypes.string.isRequired,
}

const ServerSideRenderedBlockContent = observer(({ model }) => {
  if (model.error) {
    return <BlockError error={model.error} reload={model.reload} />
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
