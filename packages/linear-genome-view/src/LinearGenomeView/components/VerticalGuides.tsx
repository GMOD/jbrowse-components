import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel, SCALE_BAR_HEIGHT } from '..'
import Block from '../../BasicTrack/components/Block'
import {
  ElidedBlockMarker,
  InterRegionPaddingBlockMarker,
} from '../../BasicTrack/components/MarkerBlocks'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '../../BasicTrack/util/blockTypes'
import { makeTicks } from '../util'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    zIndex: 1,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    display: 'flex',
  },
  majorTickLabel: {
    marginTop: 1,
    fontSize: '11px',
    color: theme.palette.text.primary,
    height: SCALE_BAR_HEIGHT,
    zIndex: 1,
    background: theme.palette.background.paper,
  },
  tick: {
    position: 'absolute',
    height: '100%',
    width: 1,
  },
  majorTick: {
    background: theme.palette.text.hint,
  },
  minorTick: {
    background: theme.palette.divider,
  },
}))

function VerticalGuides({
  model,
  children,
}: {
  model: LGV
  children: React.ReactNode
}) {
  const classes = useStyles()
  // find the block that needs pinning to the left side for context
  const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
  return (
    <>
      <div
        className={classes.verticalGuidesContainer}
        style={{
          left: offsetLeft,
          width: model.staticBlocks.totalWidthPx,
        }}
      >
        {model.staticBlocks.map((block, index) => {
          if (block instanceof ContentBlock) {
            const ticks = makeTicks(block.start, block.end, model.bpPerPx)
            return (
              <Block key={`${block.key}-${index}`} block={block}>
                {ticks.map(tick => {
                  const x =
                    (block.reversed
                      ? block.end - tick.base
                      : tick.base - block.start) / model.bpPerPx
                  return (
                    <div
                      key={tick.base}
                      className={clsx(
                        classes.tick,
                        tick.type === 'major' || tick.type === 'labeledMajor'
                          ? classes.majorTick
                          : classes.minorTick,
                      )}
                      style={{ left: x }}
                    ></div>
                  )
                })}
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
                boundary={block.variant === 'boundary'}
              />
            )
          }
          return null
        })}
      </div>
      {children}
    </>
  )
}

export default observer(VerticalGuides)
