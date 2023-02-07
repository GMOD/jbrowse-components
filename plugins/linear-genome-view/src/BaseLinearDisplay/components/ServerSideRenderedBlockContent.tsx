import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { LoadingEllipses } from '@jbrowse/core/ui'

// icons
import RefreshIcon from '@mui/icons-material/Refresh'

// locals
import BlockMsg from './BlockMsg'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },
  }
})

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
          <LoadingEllipses message={status} />
        </div>
      ) : null}
    </>
  )
})

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
}) {
  if (model.error) {
    return (
      <BlockMsg
        message={`${model.error}`}
        severity="error"
        buttonText="reload"
        icon={<RefreshIcon />}
        action={model.reload}
      />
    )
  }
  if (model.message) {
    // the message can be a fully rendered react component, e.g. the region too large message
    return React.isValidElement(model.message) ? (
      model.message
    ) : (
      <BlockMsg message={`${model.message}`} severity="info" />
    )
  }
  if (!model.filled) {
    return <LoadingMessage model={model} />
  }
  return model.reactElement
})

export default ServerSideRenderedBlockContent
