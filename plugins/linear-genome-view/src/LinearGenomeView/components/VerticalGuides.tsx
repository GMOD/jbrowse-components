import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '@jbrowse/core/util/blockTypes'
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel } from '..'
import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from '../../BaseLinearDisplay/components/Block'

import { makeTicks } from '../util'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    zIndex: 1,
    pointerEvents: 'none',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    zIndex: 1,
    pointerEvents: 'none',
    display: 'flex',
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
const RenderedVerticalGuides = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  return (
    <>
      {model.staticBlocks.map((block, index) => {
        if (block instanceof ContentBlock) {
          const ticks = makeTicks(block.start, block.end, model.bpPerPx)
          return (
            <ContentBlockComponent key={`${block.key}-${index}`} block={block}>
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
                  />
                )
              })}
            </ContentBlockComponent>
          )
        }
        if (block instanceof ElidedBlock) {
          return <ElidedBlockComponent key={block.key} width={block.widthPx} />
        }
        if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockComponent
              key={block.key}
              width={block.widthPx}
              boundary={block.variant === 'boundary'}
            />
          )
        }
        return null
      })}
    </>
  )
})
function VerticalGuides({ model }: { model: LGV }) {
  const classes = useStyles()
  // find the block that needs pinning to the left side for context
  const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
  return (
    <div
      className={classes.verticalGuidesZoomContainer}
      style={{
        transform:
          model.scaleFactor !== 1 ? `scaleX(${model.scaleFactor})` : undefined,
      }}
    >
      <div
        className={classes.verticalGuidesContainer}
        style={{
          left: offsetLeft,
          width: model.staticBlocks.totalWidthPx,
        }}
      >
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
}

export default observer(VerticalGuides)
