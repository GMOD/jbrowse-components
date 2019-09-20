import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import { ContentBlock, ElidedBlock } from '../util/blockTypes'
import Block from './Block'

const useStyles = makeStyles({
  trackBlocks: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    background: '#404040',
    position: 'absolute',
    display: 'flex',
    minHeight: '100%',
  },
  elidedBlock: {
    position: 'absolute',
    minHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },

  heightOverflowed: {
    position: 'absolute',
    color: 'rgb(77,77,77)',
    borderBottom: '2px solid rgb(77,77,77)',
    textShadow: 'white 0px 0px 1px',
    whiteSpace: 'nowrap',
    width: '100%',
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 2000,
    boxSizing: 'border-box',
  },
})

const ElidedBlockMarker = ({ width, offset }) => {
  const classes = useStyles()
  return <div className={classes.elidedBlock} style={{ width: `${width}px` }} />
}
ElidedBlockMarker.propTypes = {
  width: ReactPropTypes.number.isRequired,
  offset: ReactPropTypes.number.isRequired,
}
const RenderedBlock = observer(({ block, viewModel, state }) => {
  const classes = useStyles()
  return (
    <Block block={block} model={viewModel}>
      {state && state.reactComponent ? (
        <state.reactComponent model={state} />
      ) : null}
      {state && state.maxHeightReached ? (
        <div
          className={classes.heightOverflowed}
          style={{
            top: state.data.layout.totalHeight - 16,
            height: 16,
          }}
        >
          Max height reached
        </div>
      ) : null}
    </Block>
  )
})
function TrackBlocks({ model, viewModel, blockState }) {
  const classes = useStyles()
  const { blockDefinitions } = model
  const width = blockDefinitions
    .map(block => block.widthPx)
    .reduce((a, b) => a + b, 0)
  const offsetBlockPx = blockDefinitions.length
    ? blockDefinitions.getBlocks()[0].offsetPx
    : 0
  return (
    <div
      data-testid="Block"
      className={classes.trackBlocks}
      style={{
        left: offsetBlockPx - viewModel.offsetPx,
        width,
      }}
    >
      {blockDefinitions.map(block => {
        if (block instanceof ContentBlock) {
          const state = blockState.get(block.key)
          return (
            <RenderedBlock
              key={`${model.id}-${block.key}`}
              block={block}
              trackId={model.id}
              viewModel={viewModel}
              state={state}
            />
          )
        }
        if (block instanceof ElidedBlock) {
          return (
            <ElidedBlockMarker
              key={`${model.id}-${block.key}`}
              width={block.widthPx}
              offset={block.offsetPx - viewModel.offsetPx}
            />
          )
        }
        return null
      })}
    </div>
  )
}

TrackBlocks.propTypes = {
  blockState: PropTypes.observableMap.isRequired,
  model: PropTypes.observableObject.isRequired,
  viewModel: PropTypes.observableObject.isRequired,
}

export default observer(TrackBlocks)
