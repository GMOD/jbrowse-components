import { Suspense, isValidElement, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import BlockMsg from './BlockMsg'

// lazies
const BlockErrorMessage = lazy(() => import('./BlockErrorMessage'))

const useStyles = makeStyles()(theme => ({
  contentContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: '100px',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)`,
    pointerEvents: 'none',
    zIndex: 1,
  },
  loadingMessage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
    pointerEvents: 'none',
  },
}))

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
    isRenderingPending?: boolean
  }
}) {
  const { classes } = useStyles()

  if (model.error) {
    return (
      <Suspense fallback={null}>
        <BlockErrorMessage model={model} />
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
  } else if (
    model.isRenderingPending ||
    (!model.filled && !model.reactElement)
  ) {
    // Render is in flight, or we have no content and not filled yet
    // Show old content with overlay if available, otherwise show just overlay
    return (
      <div className={classes.contentContainer}>
        {model.reactElement}
        <div className={classes.loadingOverlay} />
        <div className={classes.loadingMessage}>
          <LoadingEllipses message={model.status} />
        </div>
      </div>
    )
  } else if (model.filled) {
    // Render completed - show new content without overlay
    return model.reactElement
  } else {
    // No content and not rendering - show nothing
    return null
  }
})

export default ServerSideRenderedBlockContent
