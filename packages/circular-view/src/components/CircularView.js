import exampleSvg from '../../test_data/circos_example_content.txt'

const svgFetch = fetch(exampleSvg).then(result => result.text())

const dragHandleHeight = 3

export default ({ jbrequire }) => {
  const { PropTypes } = jbrequire('mobx-react')
  const { observer } = jbrequire('mobx-react-lite')
  const ReactPropTypes = jbrequire('prop-types')
  const React = jbrequire('react')
  const { useState, useEffect } = React
  const { withStyles } = jbrequire('@material-ui/core')
  const ResizeHandleHorizontal = jbrequire(
    '@gmod/jbrowse-core/components/ResizeHandleHorizontal',
  )

  const styles = theme => ({
    root: {
      position: 'relative',
      marginBottom: theme.spacing.unit,
      overflow: 'hidden',
      background: 'white',
    },
    svgRoot: {
      background: 'none',
      // background: theme.palette.background.paper,
      boxSizing: 'content-box',
      display: 'block',
    },
    controls: {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'absolute',
      left: 0,
      top: 0,
    },
    // viewControls: {
    //   height: '100%',
    //   borderBottom: '1px solid #9e9e9e',
    //   boxSizing: 'border-box',
    // },
    // trackControls: {
    //   whiteSpace: 'normal',
    // },
    // zoomControls: {
    //   position: 'absolute',
    //   top: '0px',
    // },
    // iconButton: {
    //   padding: theme.spacing.unit / 2,
    // },
  })

  function CircularView(props) {
    const { classes, model } = props
    const [testingSvg, updateTestingSvg] = useState(undefined)
    // const rootModel = getRoot(model)
    // const { id } = model
    useEffect(() => {
      if (!testingSvg) {
        svgFetch.then(text => {
          updateTestingSvg(text)
        })
      }
    })
    return (
      <div className={classes.root}>
        <div
          style={{
            transform: [`rotate(${(model.rotation * 180) / Math.PI}deg)`].join(
              ' ',
            ),
            transition: 'transform 0.5s',
            transformOrigin: '500px 500px',
            width: `${model.width}px`,
            height: `${model.height - dragHandleHeight}px`,
          }}
        >
          <svg
            className={classes.svgRoot}
            width={`${model.figureWidth}px`}
            height={`${model.figureHeight}px`}
            version="1.1"
          >
            <g
              style={{
                transform: [
                  'scale(0.33)',
                  `translate(-${model.figureWidth}px, -${
                    model.figureHeight
                  }px)`,
                  // `rotate(${(model.rotation * 180) / Math.PI}deg)`,
                ].join(' '),
                transformOrigin: `${model.figureWidth /
                  2}px ${model.figureHeight / 2}px`,
              }}
              dangerouslySetInnerHTML={{ __html: testingSvg }}
            />
          </svg>
        </div>
        <div className={classes.controls}>
          <button>-</button>
          <button>+</button>
          <button>←</button>
          <button>→</button>
          <button>↑</button>
          <button>↓</button>
          <button onClick={model.rotateClockwiseButton}>↻</button>
          <button onClick={model.rotateCounterClockwiseButton}>↺</button>
        </div>

        <ResizeHandleHorizontal
          onVerticalDrag={model.resizeHeight}
          objectId={model.id}
          style={{ height: dragHandleHeight }}
        />
      </div>
    )
  }
  CircularView.propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return withStyles(styles)(observer(CircularView))
  // return withStyles(styles)(observer(CircularView))
}
