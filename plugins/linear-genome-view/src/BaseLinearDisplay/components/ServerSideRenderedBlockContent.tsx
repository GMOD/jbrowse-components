import React, { useEffect, useState } from 'react'
import { Typography, Button, Alert, Stack } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { isFeatureError } from '@jbrowse/core/util/types'
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
  blockMessage: {
    margin: theme.spacing(2),
    whiteSpace: 'normal',
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
    <Stack direction="row">
      <div style={{ width: '50%' }}>{children}</div>
      <div style={{ width: '50%' }}>{children}</div>
    </Stack>
  )
}

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
  messageContent: string | React.ReactNode
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.blockMessage}>
      {React.isValidElement(messageContent) ? (
        messageContent
      ) : (
        <Alert severity="info">{messageContent}</Alert>
      )}
    </div>
  )
}

function BlockError({
  error,
  reload,
  displayHeight,
}: {
  error: Error
  reload: () => void
  displayHeight: number
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.blockMessage}>
      <Alert
        severity={isFeatureError(error) ? error.severity : 'error'}
        action={
          !isFeatureError(error) || error.severity === 'error' ? (
            <Button
              data-testid="reload_button"
              onClick={reload}
              startIcon={<RefreshIcon />}
            >
              Reload
            </Button>
          ) : null
        }
      >
        {error.message}
      </Alert>
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
      return (
        <Repeater>
          <BlockError
            error={model.error}
            reload={model.reload}
            displayHeight={getParentRenderProps(model).displayModel.height}
          />
        </Repeater>
      )
    }
    if (model.message) {
      return (
        <Repeater>
          <BlockMessage messageContent={model.message} />
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
    return model.reactElement
  },
)

export default ServerSideRenderedBlockContent
