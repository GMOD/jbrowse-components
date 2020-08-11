import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import Button from '@material-ui/core/Button'
import RefreshIcon from '@material-ui/icons/Refresh'
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
    width: '100%',
  },
  dots: {
    '&::after': {
      display: 'inline-block',
      animation: '$ellipsis 1.5s infinite',
      content: '"."',
      width: '1em',
      textAlign: 'left',
    },
  },
  '@keyframes ellipsis': {
    '0%': {
      content: '"."',
    },
    '33%': {
      content: '".."',
    },
    '66%': {
      content: '"..."',
    },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <div className={classes.loading}>
      <div className={classes.dots}>{message ? `${message}` : 'Loading'}</div>
    </div>
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

function BlockError({ error, reload }: { error: Error; reload: () => void }) {
  const classes = useStyles()
  return (
    <div className={classes.blockError}>
      {reload ? (
        <Button
          data-testid="reload_button"
          onClick={reload}
          size="small"
          startIcon={<RefreshIcon />}
        >
          Reload
        </Button>
      ) : null}
      <Typography color="error" variant="body2">
        {error.message}
      </Typography>
    </div>
  )
}
BlockError.propTypes = {
  error: MobxPropTypes.objectOrObservableObject.isRequired,
  reload: PropTypes.func,
}
BlockError.defaultProps = {
  reload: undefined,
}

const ServerSideRenderedBlockContent = observer(
  ({
    model,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any
  }) => {
    if (model.error) {
      return (
        <Repeater>
          <BlockError error={model.error} reload={model.reload} />
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
