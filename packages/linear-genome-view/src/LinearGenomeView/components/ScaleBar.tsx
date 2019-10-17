import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { Fragment } from 'react'
import Block from '../../BasicTrack/components/Block'
import Ruler from './Ruler'
import { LinearGenomeViewStateModel } from '..'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
  BlockSet,
} from '../../BasicTrack/util/blockTypes'

import {
  ElidedBlockMarker,
  InterRegionPaddingBlockMarker,
} from '../../BasicTrack/components/MarkerBlocks'

const useStyles = makeStyles((/* theme */) => ({
  scaleBar: {
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    position: 'relative',
    background: '#555',
    // background: theme.palette.background.default,
    overflow: 'hidden',
    height: 32,
  },
  refLabel: {
    fontSize: '16px',
    position: 'absolute',
    left: '2px',
    top: '-1px',
    fontWeight: 'bold',
    background: 'white',
    // color: theme.palette.text.primary,
  },
}))

type LGV = Instance<LinearGenomeViewStateModel>

function ScaleBar({ model, height }: { model: LGV; height: number }) {
  const classes = useStyles()

  return (
    <div className={classes.scaleBar}>
      {model.staticBlocks.map((block, i) => {
        if (block instanceof ContentBlock) {
          return (
            <Fragment key={block.offsetPx}>
              <Block block={block} model={model}>
                <svg height={height} width={block.widthPx}>
                  <Ruler
                    region={block}
                    bpPerPx={model.bpPerPx}
                    flipped={model.horizontallyFlipped}
                  />
                </svg>
              </Block>
              {block.isLeftEndOfDisplayedRegion ? (
                <div
                  style={{
                    left: Math.max(0, block.offsetPx - model.offsetPx),
                    zIndex: i, // this makes it so the refLabel "to the right" lives on top of the refLabel on the left
                  }}
                  className={classes.refLabel}
                >
                  {block.refName}
                </div>
              ) : null}
            </Fragment>
          )
        }
        if (block instanceof ElidedBlock) {
          return (
            <ElidedBlockMarker
              key={block.key}
              width={block.widthPx}
              offset={block.offsetPx - model.offsetPx}
            />
          )
        }
        if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockMarker
              key={block.key}
              block={block}
              model={model}
            />
          )
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
