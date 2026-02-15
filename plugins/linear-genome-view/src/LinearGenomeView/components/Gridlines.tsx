import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'

import { makeTicks } from '../util.ts'
import { joinElements } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(() => ({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
  },
}))

const TICK_STYLE = 'position:absolute;height:100%;width:1px'
const BLOCK_STYLE = 'position:absolute;height:100%'
const ELIDED_BG =
  'background-color:#999;background-image:repeating-linear-gradient(90deg,transparent,transparent 1px,rgba(255,255,255,.5) 1px,rgba(255,255,255,.5) 3px)'

function createTickDiv() {
  const el = document.createElement('div')
  el.style.cssText = TICK_STYLE
  return el
}

function createBlockDiv() {
  const el = document.createElement('div')
  el.style.cssText = BLOCK_STYLE
  return el
}

function collectTicks(
  blocks: BaseBlock[],
  bpPerPx: number,
  firstBlockOffset: number,
) {
  const ticks: { x: number; major: boolean }[] = []
  for (const block of blocks) {
    if (block.type === 'ContentBlock') {
      const { start, end, reversed, widthPx } = block
      const blockLeft = block.offsetPx - firstBlockOffset
      for (const { type, base } of makeTicks(start, end, bpPerPx)) {
        const x = blockLeft + (reversed ? end - base : base - start) / bpPerPx
        if (x >= blockLeft && x <= blockLeft + widthPx) {
          ticks.push({
            x,
            major: type === 'major' || type === 'labeledMajor',
          })
        }
      }
    }
  }
  return ticks
}

function getBlockBackground(
  block: BaseBlock,
  disabledBgColor: string,
  textDisabledColor: string,
) {
  if (block.type === 'ElidedBlock') {
    return ELIDED_BG
  }
  if (block.variant === 'boundary') {
    return `background:${disabledBgColor}`
  }
  return `background:${textDisabledColor}`
}

export default function Gridlines({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const innerRef = useRef<HTMLDivElement>(null)
  const tickRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const majorColor = theme.palette.action.disabled
    const minorColor = theme.palette.divider
    const textDisabledColor = theme.palette.text.disabled
    const disabledBgColor = theme.palette.action.disabledBackground

    return autorun(() => {
      const inner = innerRef.current
      const tickContainer = tickRef.current
      const blockContainer = blockRef.current
      if (!inner || !tickContainer || !blockContainer) {
        return
      }
      const { staticBlocks, bpPerPx, offsetPx } = model
      const blocks = staticBlocks.blocks
      const firstBlockOffset = blocks[0]?.offsetPx ?? 0

      inner.style.transform = `translateX(${staticBlocks.offsetPx - offsetPx - offset}px)`
      inner.style.width = `${staticBlocks.totalWidthPx}px`

      const ticks = collectTicks(blocks, bpPerPx, firstBlockOffset)
      const nonContentBlocks = blocks.filter(b => b.type !== 'ContentBlock')

      joinElements(tickContainer, ticks.length, createTickDiv)
      joinElements(blockContainer, nonContentBlocks.length, createBlockDiv)

      for (let i = 0; i < ticks.length; i++) {
        const { x, major } = ticks[i]!
        const el = tickContainer.children[i] as HTMLElement
        el.style.transform = `translateX(${x}px)`
        el.style.background = major ? majorColor : minorColor
      }

      for (let i = 0; i < nonContentBlocks.length; i++) {
        const block = nonContentBlocks[i]!
        const blockLeft = block.offsetPx - firstBlockOffset
        const bg = getBlockBackground(block, disabledBgColor, textDisabledColor)
        const el = blockContainer.children[i] as HTMLElement
        el.style.cssText = `${BLOCK_STYLE};transform:translateX(${blockLeft}px);width:${block.widthPx}px;${bg}`
      }
    })
  }, [model, theme, offset])

  return (
    <div className={classes.verticalGuidesZoomContainer}>
      <div
        ref={innerRef}
        style={{ position: 'absolute', height: '100%', pointerEvents: 'none' }}
      >
        <div ref={tickRef} style={{ position: 'absolute', width: '100%', height: '100%' }} />
        <div ref={blockRef} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
