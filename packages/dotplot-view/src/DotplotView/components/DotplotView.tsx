/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef, useEffect } = React
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
        background: grey[300],
      },
      overlay: {
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
      horizontalBpPerPx,
      verticalBpPerPx,
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
        (currWidth + len) * horizontalBpPerPx + borderSize,
        height - borderSize,
      )
      ctx.lineTo((currWidth + len) * horizontalBpPerPx + borderSize, borderSize)
      ctx.stroke()
      currWidth += len
    })
    let currHeight = 0
    views[1].displayedRegions.forEach(region => {
      const len = region.end - region.start

      ctx.beginPath()
      ctx.moveTo(
        viewingRegionWidth + borderSize,
        (currHeight + len) * verticalBpPerPx + borderSize,
      )
      ctx.lineTo(borderSize, (currHeight + len) * verticalBpPerPx + borderSize)
      ctx.stroke()
      currHeight += len
    })
  }

  function DrawLabels(model: DotplotViewModel, ctx: CanvasRenderingContext2D) {
    const {
      views,
      fontSize,
      height,
      borderSize,
      verticalBpPerPx,
      horizontalBpPerPx,
    } = model
    let currHeight = 0
    views[0].displayedRegions.forEach(region => {
      const len = region.end - region.start
      ctx.fillText(
        region.refName,
        (currHeight + len / 2) * horizontalBpPerPx,
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
        (currWidth + len / 2) * verticalBpPerPx + borderSize,
        borderSize - 10,
      )

      currWidth += len
    })
    ctx.restore()
  }

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = useRef()
    const { totalBp, borderSize, fontSize, views, width, height } = model
    useEffect(() => {
      if (ref.current) {
        const ctx = ref.current.getContext('2d')
        DrawLabels(model, ctx)
        DrawGrid(model, ctx)

        ctx.restore()
      }
    }, [borderSize, fontSize, height, model, totalBp, views, width])
    return (
      <div>
        <Header model={model} />
        <div className={classes.container}>
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
