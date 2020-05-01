import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel } from '..'
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
  scaleBarContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  scaleBar: {
    position: 'absolute',
    display: 'flex',
    pointerEvents: 'none',
  },
  majorTickLabel: {
    fontSize: '11px',
    zIndex: 1,
    background: theme.palette.background.paper,
    lineHeight: 'normal',
    pointerEvents: 'none',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  refLabel: {
    fontSize: '11px',
    position: 'absolute',
    left: '2px',
    top: '-1px',
    fontWeight: 'bold',
    lineHeight: 'normal',
    pointerEvents: 'none',
    background: theme.palette.background.paper,
  },
}))

const ScaleBar = React.forwardRef(
  (
    {
      model,
      style,
      className,
      ...other
    }: { model: LGV; style?: React.CSSProperties; className?: string },
    ref,
  ) => {
    const classes = useStyles()

    // find the block that needs pinning to the left side for context
    let lastLeftBlock = 0
    model.staticBlocks.forEach((block, i) => {
      if (block.offsetPx - model.offsetPx < 0) {
        lastLeftBlock = i
      }
    })
    const rulerLabels: JSX.Element[] = []
    const refNameLabels: JSX.Element[] = []
    model.staticBlocks.forEach((block, index) => {
      if (block instanceof ContentBlock) {
        const ticks = makeTicks(
          block.start,
          block.end,
          model.bpPerPx,
          true,
          false,
        )
        rulerLabels.push(
          <Block key={`${block.key}-${index}`} block={block}>
            {ticks.map(tick => {
              if (tick.type === 'labeledMajor') {
                const x =
                  (block.reversed
                    ? block.end - tick.base
                    : tick.base - block.start) / model.bpPerPx
                const baseNumber = (tick.base + 1).toLocaleString()
                return (
                  <div
                    key={tick.base}
                    className={classes.tick}
                    style={{ left: x }}
                  >
                    {baseNumber ? (
                      <Typography className={classes.majorTickLabel}>
                        {baseNumber}
                      </Typography>
                    ) : null}
                  </div>
                )
              }
              return null
            })}
          </Block>,
        )
        if (block.isLeftEndOfDisplayedRegion || index === lastLeftBlock) {
          refNameLabels.push(
            <Typography
              key={`refLabel-${block.key}-${index}`}
              style={{
                left:
                  index === lastLeftBlock
                    ? Math.max(0, -model.offsetPx)
                    : block.offsetPx - model.offsetPx - 1,
                paddingLeft: index === lastLeftBlock ? 0 : 1,
                zIndex: index,
              }}
              className={classes.refLabel}
              data-testid={`refLabel-${block.refName}`}
            >
              {block.refName}
            </Typography>,
          )
        }
      }
      if (block instanceof ElidedBlock) {
        rulerLabels.push(
          <ElidedBlockMarker key={block.key} width={block.widthPx} />,
        )
      }
      if (block instanceof InterRegionPaddingBlock) {
        rulerLabels.push(
          <InterRegionPaddingBlockMarker
            key={block.key}
            width={block.widthPx}
            style={{ background: 'none' }}
            boundary={block.variant === 'boundary'}
          />,
        )
      }
    })

    const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
    return (
      <Paper
        className={clsx(classes.scaleBarContainer, className)}
        variant="outlined"
        ref={ref}
        style={style}
        {...other}
      >
        <div style={{ transform: `scaleX(${model.scaleFactor})` }}>
          <div
            className={classes.scaleBar}
            style={{
              left: offsetLeft - 1,
              width: model.staticBlocks.totalWidthPx,
              ...style,
            }}
          >
            {rulerLabels}
          </div>
        </div>
        {refNameLabels}
      </Paper>
    )
  },
)

export default observer(ScaleBar)
