import React, { useEffect, useState } from 'react'
import { Typography, Tooltip, Button, Alert } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import RefreshIcon from '@mui/icons-material/Refresh'

const useStyles = makeStyles()(theme => ({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: theme.palette.action.disabledBackground,
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
    textAlign: 'center',
  },
  blockMessage: {},
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LoadingMessage = observer(({ model }: { model: any }) => {
  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  const { classes } = useStyles()
  useEffect(() => {
    let killed = false
    const timeout = setTimeout(() => {
      if (!killed) {
        setShown(true)
      }
    }, 300)
    return () => {
      clearTimeout(timeout)
      killed = true
    }
  }, [])

  const { status: blockStatus } = model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { message: displayStatus } = getParent<any>(model, 2)
  const status = displayStatus || blockStatus
  return (
    <>
      {shown ? (
        <div className={classes.loading}>
          <Typography className={classes.dots} variant="body2">
            {status ? `${status}` : 'Loading'}
          </Typography>
        </div>
      ) : null}
    </>
  )
})

function BlockMessage({
  messageContent,
}: {
  messageContent?: React.ReactNode
}) {
  const { classes } = useStyles()
  const [width, setWidth] = useState(0)

  return (
    <div
      ref={ref => {
        if (ref) {
          setWidth(ref.getBoundingClientRect().width)
        }
      }}
      className={classes.blockMessage}
    >
      {React.isValidElement(messageContent) ? (
        messageContent
      ) : width < 500 ? (
        <Tooltip title={`${messageContent}`}>
          <Alert severity="info" />
        </Tooltip>
      ) : (
        <Alert severity="info">{`${messageContent}`}</Alert>
      )}
    </div>
  )
}

function BlockError({ error, reload }: { error: unknown; reload: () => void }) {
  const { classes } = useStyles()
  const [width, setWidth] = useState(0)
  const action = reload ? (
    <Button
      data-testid="reload_button"
      onClick={reload}
      startIcon={<RefreshIcon />}
    >
      Reload
    </Button>
  ) : null
  return (
    <div
      ref={ref => {
        if (ref) {
          setWidth(ref.getBoundingClientRect().width)
        }
      }}
      className={classes.blockMessage}
    >
      {width < 500 ? (
        <Tooltip title={`${error}`}>
          <Alert severity="error" action={action} />
        </Tooltip>
      ) : (
        <Alert severity="error" action={action}>
          {`${error}`}
        </Alert>
      )}
    </div>
  )
}

const ServerSideRenderedBlockContent = observer(
  ({
    model,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any
  }) => {
    if (model.error) {
      return <BlockError error={model.error} reload={model.reload} />
    }
    if (model.message) {
      return <BlockMessage messageContent={model.message} />
    }
    if (!model.filled) {
      return <LoadingMessage model={model} />
    }
    return model.reactElement
  },
)

export default ServerSideRenderedBlockContent
