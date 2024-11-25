import React from 'react'
import { ResizeHandle } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import Controls from './Controls'
import ImportForm from './ImportForm'
import Ruler from './Ruler'
import type { CircularViewModel } from '../models/model'

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
