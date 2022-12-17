import React from 'react'
import { observer } from 'mobx-react'
import { ResizeHandle, ErrorMessage } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

// locals
import Ruler from './Ruler'
import Controls from './Controls'
import ImportForm from './ImportForm'
import { CircularViewModel } from '../models/CircularView'

const dragHandleHeight = 3

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    background: 'white',
  },
  scroller: {
    overflow: 'auto',
  },
  sliceRoot: {
    background: 'none',
    // background: theme.palette.background.paper,
    boxSizing: 'content-box',
    display: 'block',
  },
}))

const Slices = observer(({ model }: { model: CircularViewModel }) => {
  return (
    <>
      {model.staticSlices.map(slice => (
        <Ruler
          key={assembleLocString(
            // @ts-ignore
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

  return (
    <>
      {showImportForm ? (
        <ImportForm model={model} />
      ) : model.error ? (
        <ErrorMessage error={model.error} />
      ) : showFigure ? (
        <CircularViewLoaded model={model} />
      ) : null}
    </>
  )
})

const CircularViewLoaded = observer(
  ({ model }: { model: CircularViewModel }) => {
    const {
      width,
      height,
      id,
      offsetRadians,
      centerXY,
      figureWidth,
      figureHeight,
    } = model
    const { classes } = useStyles()
    return (
      <div className={classes.root} style={{ width, height }} data-testid={id}>
        <div className={classes.scroller} style={{ width, height }}>
          <div
            style={{
              transform: [`rotate(${offsetRadians}rad)`].join(' '),
              transition: 'transform 0.5s',
              transformOrigin: centerXY.map(x => `${x}px`).join(' '),
            }}
          >
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
              }}
              className={classes.sliceRoot}
              width={figureWidth}
              height={figureHeight}
              version="1.1"
            >
              <g transform={`translate(${centerXY})`}>
                <Slices model={model} />
              </g>
            </svg>
          </div>
        </div>
        <Controls model={model} />
        {model.hideVerticalResizeHandle ? null : (
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
  },
)

export default CircularView
