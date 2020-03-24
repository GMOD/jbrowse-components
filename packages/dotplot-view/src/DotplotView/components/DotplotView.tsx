/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const { getSnapshot } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { useRef, useEffect, useState } = React
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles: jbrequiredMakeStyles } = jbrequire(
    '@material-ui/core/styles',
  )

  const Header = jbrequire(require('./Header'))
  const { grey } = jbrequire('@material-ui/core/colors')

  const useStyles = (jbrequiredMakeStyles as typeof makeStyles)(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        overflow: 'hidden',
      },
      viewContainer: {
        marginTop: '3px',
      },
      container: {
        display: 'grid',
        position: 'relative',
        background: grey[300],
      },
      overlay: {
        pointerEvents: 'none',
        display: 'flex',
        width: '100%',
        gridArea: '1/1',
        zIndex: 100,
        '& path': {
          cursor: 'crosshair',
          fill: 'none',
        },
      },
      content: {
        gridArea: '1/1',
      },
    }
  })

  function DrawGrid(model: DotplotViewModel, ctx: CanvasRenderingContext2D) {
    const {
      views,
      viewingRegionWidth,
      viewingRegionHeight,
      height,
      borderSize,
    } = model
    let currWidth = 0
    ctx.strokeRect(
      borderSize,
      borderSize,
      viewingRegionWidth,
      viewingRegionHeight,
    )
    views[0].displayedRegions.forEach((region: IRegion) => {
      const len = region.end - region.start

      ctx.beginPath()
      ctx.moveTo(
        (currWidth + len) / views[0].bpPerPx + borderSize,
        height - borderSize,
      )
      ctx.lineTo((currWidth + len) / views[0].bpPerPx + borderSize, borderSize)
      ctx.stroke()
      currWidth += len
    })
    let currHeight = 0
    views[1].displayedRegions.forEach(region => {
      const len = region.end - region.start

      ctx.beginPath()
      ctx.moveTo(
        viewingRegionWidth + borderSize,
        height - (currHeight + len) / views[1].bpPerPx + borderSize,
      )
      ctx.lineTo(
        borderSize,
        height - (currHeight + len) / views[1].bpPerPx + borderSize,
      )
      ctx.stroke()
      currHeight += len
    })
  }

  function DrawLabels(model: DotplotViewModel, ctx: CanvasRenderingContext2D) {
    const { views, fontSize, height, borderSize } = model
    let currHeight = 0
    views[0].displayedRegions.forEach(region => {
      const len = region.end - region.start
      ctx.fillText(
        region.refName,
        (currHeight + len / 2) / views[0].bpPerPx,
        height - borderSize + fontSize,
      )

      currHeight += len
    })

    ctx.save()
    ctx.translate(0, height)
    ctx.rotate(-Math.PI / 2)
    let currWidth = 0
    views[1].displayedRegions.forEach(region => {
      const len = region.end - region.start
      ctx.fillText(
        region.refName,
        (currWidth + len / 2) / views[1].bpPerPx + borderSize,
        borderSize - 10,
      )

      currWidth += len
    })
    ctx.restore()
  }

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = useRef()
    const { borderSize, fontSize, views, width, height } = model
    const highlightOverlayCanvas = useRef(null)
    const [down, setDown] = useState()
    const [current, setCurrent] = useState([0, 0])

    const view0 = getSnapshot(views[0].displayedRegions)
    const view1 = getSnapshot(views[1].displayedRegions)
    useEffect(() => {
      if (ref.current) {
        const ctx = ref.current.getContext('2d')
        ctx.clearRect(0, 0, width, height)
        DrawLabels(model, ctx)
        DrawGrid(model, ctx)

        ctx.restore()
      }
    }, [borderSize, fontSize, height, model, views, width, view0, view1])

    useEffect(() => {
      const canvas = highlightOverlayCanvas.current
      if (!canvas) {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const rect = canvas.getBoundingClientRect()
      if (down) {
        ctx.fillStyle = 'rgba(255,0,0,0.3)'
        ctx.fillRect(
          down[0] - rect.left,
          down[1] - rect.top,
          current[0] - down[0],
          current[1] - down[1],
        )
      }
    }, [down, current])
    return (
      <div>
        <Header model={model} />
        <div className={classes.container}>
          <canvas
            style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}
            ref={highlightOverlayCanvas}
            onMouseDown={event => {
              setDown([event.clientX, event.clientY])
              setCurrent([event.clientX, event.clientY])
            }}
            onMouseUp={event => {
              setDown(undefined)
            }}
            onMouseLeave={event => {
              setDown(undefined)
            }}
            onMouseMove={event => {
              setCurrent([event.clientX, event.clientY])
            }}
            width={width}
            height={height}
          />
          <canvas
            className={classes.content}
            ref={ref}
            width={width}
            height={height}
          />
          <div className={classes.overlay}>
            {model.tracks.map((track: any) => {
              const { ReactComponent } = track

              return ReactComponent ? (
                <ReactComponent key={getConf(track, 'trackId')} model={track} />
              ) : null
            })}
          </div>
        </div>
      </div>
    )
  })

  DotplotView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return DotplotView
}
