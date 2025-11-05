import type { CSSProperties } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },

    blockMessage: {
      backgroundColor: bg,
      padding: '10px',
    },
  }
})

function LoadingMessage() {
  const { classes } = useStyles()
  return (
    <div className={classes.loading}>
      <LoadingEllipses />
    </div>
  )
}

function BlockMessage({ messageText }: { messageText: string }) {
  const { classes } = useStyles()
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={messageText} />
    </div>
  )
}

function BlockError({ error }: { error: unknown }) {
  return <ErrorMessage error={error} />
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
