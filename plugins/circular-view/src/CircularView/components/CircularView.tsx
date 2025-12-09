import { LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Controls from './Controls'
import ImportForm from './ImportForm'
import Ruler from './Ruler'

import type { CircularViewModel } from '../model'

const dragHandleHeight = 3

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  scroller: {
    overflow: 'auto',
  },
}))

const Slices = observer(({ model }: { model: CircularViewModel }) => {
  return (
    <>
      {model.staticSlices.map(slice => (
        <Ruler
          key={assembleLocString(
            slice.region.elided ? slice.region.regions[0]! : slice.region,
          )}
          model={model}
          slice={slice}
        />
      ))}
      {model.tracks.map(track => {
        const display = track.displays[0]
        return (
          <display.RenderingComponent
            key={display.id}
            display={display}
            view={model}
          />
        )
      })}
    </>
  )
})

const CircularView = observer(({ model }: { model: CircularViewModel }) => {
  const {
    displayedRegions,
    figureWidth,
    figureHeight,
    initialized,
    disableImportForm,
    error,
    loadingMessage,
  } = model

  const fullyInitialized =
    !!displayedRegions.length && !!figureWidth && !!figureHeight && initialized

  // Show loading if regions exist but not yet initialized (e.g., share link
  // waiting for assemblies to load)
  if (!initialized && !error && displayedRegions.length > 0) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if ((!fullyInitialized && !disableImportForm) || error) {
    return <ImportForm model={model} />
  } else if (fullyInitialized) {
    return <CircularViewLoaded model={model} />
  } else {
    return null
  }
})

const CircularViewLoaded = observer(function ({
  model,
}: {
  model: CircularViewModel
}) {
  const {
    width,
    height,
    id,
    offsetRadians,
    centerXY,
    figureWidth,
    figureHeight,
    hideVerticalResizeHandle,
  } = model
  const { classes } = useStyles()
  return (
    <div className={classes.root} style={{ width, height }} data-testid={id}>
      <div className={classes.scroller} style={{ width, height }}>
        <svg
          style={{
            transform: `rotate(${offsetRadians}rad)`,
            transition: 'transform 0.5s',
            transformOrigin: centerXY.map(x => `${x}px`).join(' '),
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          width={figureWidth}
          height={figureHeight}
        >
          <g transform={`translate(${centerXY})`}>
            <Slices model={model} />
          </g>
        </svg>
      </div>
      <Controls model={model} />
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          onDrag={model.resizeHeight}
          style={{
            height: dragHandleHeight,
            position: 'absolute',
            bottom: 0,
            left: 0,
            background: '#ccc',
            boxSizing: 'border-box',
            borderTop: '1px solid #fafafa',
          }}
        />
      )}
    </div>
  )
})

export default CircularView
