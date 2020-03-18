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
        pointerEvents: 'none',
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

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = useRef()
    const { totalBp, borderSize, fontSize, views, width, height } = model
    useEffect(() => {
      if (ref.current) {
        const ctx = ref.current.getContext('2d')
        const wt = width / totalBp[0]
        const ht = height / totalBp[1]
        let current = 0
        views[0].displayedRegions.forEach((region: IRegion) => {
          const len = region.end - region.start
          ctx.fillText(
            region.refName,
            (current + len / 2) * wt,
            height + borderSize + fontSize,
          )
          ctx.beginPath()
          ctx.moveTo((current + len) * wt + borderSize, height + borderSize)
          ctx.lineTo((current + len) * wt + borderSize, borderSize)
          ctx.stroke()
          current += len
        })

        ctx.save()
        ctx.translate(0, height)
        ctx.rotate(-Math.PI / 2)
        current = 0
        views[1].displayedRegions.forEach(region => {
          const len = region.end - region.start
          ctx.fillText(
            region.refName,
            (current + len / 2) * ht,
            borderSize - 10,
          )
          ctx.beginPath()
          ctx.moveTo((current + len) * ht + borderSize, width + borderSize)
          ctx.lineTo((current + len) * ht + borderSize, borderSize)
          ctx.stroke()
          current += len
        })
        ctx.restore()
      }
    }, [borderSize, fontSize, height, totalBp, views, width])
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
