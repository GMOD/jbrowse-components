import React from 'react'
import { observer } from 'mobx-react'
import { ResizeHandle } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

// locals
import Ruler from './Ruler'
import Controls from './Controls'
import ImportForm from './ImportForm'
import { CircularViewModel } from '../models/model'

const dragHandleHeight = 3

const useStyles = makeStyles()(theme => ({
  root: {
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    position: 'relative',
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
            slice.region.elided ? slice.region.regions[0] : slice.region,
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
  const initialized =
    !!model.displayedRegions.length &&
    !!model.figureWidth &&
    !!model.figureHeight &&
    model.initialized

  const showImportForm = !initialized && !model.disableImportForm
  const showFigure = initialized && !showImportForm

  return showImportForm || model.error ? (
    <ImportForm model={model} />
  ) : showFigure ? (
    <CircularViewLoaded model={model} />
  ) : null
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
    <div className={classes.root} style={{ height, width }} data-testid={id}>
      <div className={classes.scroller} style={{ height, width }}>
        <svg
          style={{
            left: 0,
            position: 'absolute',
            top: 0,
            transform: `rotate(${offsetRadians}rad)`,
            transformOrigin: centerXY.map(x => `${x}px`).join(' '),
            transition: 'transform 0.5s',
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
            background: '#ccc',
            borderTop: '1px solid #fafafa',
            bottom: 0,
            boxSizing: 'border-box',
            height: dragHandleHeight,
            left: 0,
            position: 'absolute',
          }}
        />
      )}
    </div>
  )
})

export default CircularView
