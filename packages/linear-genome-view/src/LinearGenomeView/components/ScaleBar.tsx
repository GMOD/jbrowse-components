import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import Block from '../../BasicTrack/components/Block'
import Ruler from './Ruler'
import { LinearGenomeViewStateModel } from '..'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '../../BasicTrack/util/blockTypes'

import {
  ElidedBlockMarker,
  InterRegionPaddingBlockMarker,
} from '../../BasicTrack/components/MarkerBlocks'

const useStyles = makeStyles((/* theme */) => ({
  scaleBarContainer: {
    position: 'relative',
    display: 'block',
  },
  scaleBar: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    position: 'absolute',
    display: 'flex',
    overflow: 'hidden',
  },
  refLabel: {
    fontSize: '16px',
    position: 'absolute',
    left: '2px',
    top: '-1px',
    fontWeight: 'bold',
    background: 'white',
  },
}))

type LGV = Instance<LinearGenomeViewStateModel>
const RenderedScaleBar = observer(
  ({ model, height }: { model: LGV; height: number }) => {
    return (
      <>
        {model.staticBlocks.map((block, index) => {
          if (block instanceof ContentBlock) {
            return (
              <Block key={block.key} block={block}>
                <svg height={height} width={block.widthPx}>
                  <Ruler
                    start={block.start}
                    end={block.end}
                    bpPerPx={model.bpPerPx}
                    flipped={model.horizontallyFlipped}
                  />
                </svg>
              </Block>
            )
          }
          if (block instanceof ElidedBlock) {
            return <ElidedBlockMarker key={block.key} width={block.widthPx} />
          }
          if (block instanceof InterRegionPaddingBlock) {
            return (
              <InterRegionPaddingBlockMarker
                key={block.key}
                width={block.widthPx}
              />
            )
          }
          return null
        })}
      </>
    )
  },
)
function ScaleBar({ model, height }: { model: LGV; height: number }) {
  const classes = useStyles()

  // find the block that needs pinning to the left side for context
  let lastLeftBlock = 0
  model.staticBlocks.forEach((block, i) => {
    if (block.offsetPx - model.offsetPx < 0) lastLeftBlock = i
  })
  const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
  return (
    <div className={classes.scaleBarContainer}>
      <div
        className={classes.scaleBar}
        style={{
          left: offsetLeft,
          width: model.staticBlocks.totalWidthPx,
          height,
        }}
      >
        <RenderedScaleBar model={model} height={height} />
      </div>
      {model.staticBlocks.map((block, index) => {
        if (block instanceof ContentBlock) {
          if (block.isLeftEndOfDisplayedRegion || index === lastLeftBlock) {
            return (
              <div
                key={`refLabel-${block.key}`}
                style={{
                  left:
                    index === lastLeftBlock
                      ? Math.max(0, -model.offsetPx)
                      : block.offsetPx - model.offsetPx,
                  zIndex: index,
                }}
                className={classes.refLabel}
                data-testid={`refLabel-${block.refName}`}
              >
                {block.refName}
              </div>
            )
          }
        }
        return null
      })}
    </div>
  )
}
ScaleBar.defaultProps = {
  style: {},
}
ScaleBar.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  height: PropTypes.number.isRequired,
}

export default observer(ScaleBar)
