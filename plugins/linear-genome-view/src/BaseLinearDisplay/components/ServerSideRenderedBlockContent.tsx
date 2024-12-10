import { Suspense, isValidElement, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

import BlockMsg from './BlockMsg'

// lazies
const BlockError = lazy(() => import('./BlockError'))

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

const LoadingMessage = observer(({ model }: { model: { status?: string } }) => {
  const { classes } = useStyles()
  const { status: blockStatus } = model
  const { message: displayStatus } = getParent<{ message?: string }>(model, 2)
  const status = displayStatus || blockStatus
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={status} />
    </div>
  )
})

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: {
    error?: unknown
    reload: () => void
    message: React.ReactNode
    filled?: boolean
    status?: string
    reactElement?: React.ReactElement
  }
}) {
  if (model.error) {
    return (
      <Suspense fallback={null}>
        <BlockError model={model} />
      </Suspense>
    )
  } else if (model.message) {
    // the message can be a fully rendered react component, e.g. the region too
    // large message
    return isValidElement(model.message) ? (
      model.message
    ) : (
      <BlockMsg message={`${model.message}`} severity="info" />
    )
  } else if (!model.filled) {
    return <LoadingMessage model={model} />
  } else {
    return model.reactElement
  }
})

export default ServerSideRenderedBlockContent
