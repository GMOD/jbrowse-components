import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import ServerSideRenderedContent from '../../LinearGenomeView/components/ServerSideRenderedContent'

const useStyles = makeStyles(theme => ({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: theme.palette.action.disabledBackground,
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    height: '100%',
    width: '100%',
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
    width: '100%',
    background: theme.palette.action.disabledBackground,
    padding: theme.spacing(2),
    pointerEvents: 'none',
    textAlign: 'center',
  },
  blockError: {
    padding: theme.spacing(2),
    pointerEvents: 'none',
    width: '100%',
  },
}))

function Repeater({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex' }}>
      {children}
      {children}
    </div>
  )
}

const LoadingMessage = observer(({ model }: { model: any }) => {
  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  const classes = useStyles()
  useEffect(() => {
    const timeout = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { message } = getParent(model, 2)
  return shown ? (
    <div className={classes.loading}>{`${message}...` || 'Loading...'}</div>
  ) : null
})

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

function BlockError({ error }: { error: Error }) {
  const classes = useStyles()
  return (
    <div className={classes.blockError}>
      <Typography color="error" variant="body2">
        {error.message}
      </Typography>
    </div>
  )
}
BlockError.propTypes = {
  error: MobxPropTypes.objectOrObservableObject.isRequired,
}

const ServerSideRenderedBlockContent = observer(
  ({
    model,
  }: {
    // requires typing out to avoid circular reference with this component being referenced in the model itself
    model: {
      error: Error | undefined
      message: string | undefined
      filled: boolean
    }
  }) => {
    if (model.error) {
      return (
        <Repeater>
          <BlockError error={model.error} />
        </Repeater>
      )
    }
    if (model.message) {
      return (
        <Repeater>
          <BlockMessage messageText={model.message} />
        </Repeater>
      )
    }
    if (!model.filled) {
      return (
        <Repeater>
          <LoadingMessage model={model} />
        </Repeater>
      )
    }

    return <ServerSideRenderedContent model={model} />
  },
)

export default ServerSideRenderedBlockContent
