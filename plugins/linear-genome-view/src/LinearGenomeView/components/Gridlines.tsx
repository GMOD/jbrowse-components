import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(() => ({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
    display: 'flex',
  },
}))

function joinElements(container: HTMLElement, count: number) {
  while (container.childElementCount > count) {
    container.lastElementChild!.remove()
  }
  while (container.childElementCount < count) {
    container.appendChild(document.createElement('div'))
  }
}

const Gridlines = observer(function Gridlines({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const { staticBlocks, offsetPx } = model
  const offsetLeft = staticBlocks.offsetPx - offsetPx
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const majorColor = theme.palette.action.disabled
    const minorColor = theme.palette.divider
    const textDisabledColor = theme.palette.text.disabled
    const disabledBgColor = theme.palette.action.disabledBackground

    return autorun(() => {
      const container = containerRef.current
      if (!container) {
        return
      }
      const { staticBlocks, bpPerPx } = model
      const blocks = staticBlocks.blocks
      const firstBlockOffset = blocks[0]?.offsetPx ?? 0

      let totalChildren = 0
      for (const block of blocks) {
        if (block.type === 'ContentBlock') {
          totalChildren += makeTicks(block.start, block.end, bpPerPx).length
        } else {
          totalChildren++
        }
      }

      joinElements(container, totalChildren)

      let childIdx = 0
      for (const block of blocks) {
        const blockLeft = block.offsetPx - firstBlockOffset
        if (block.type === 'ContentBlock') {
          const { start, end, reversed } = block
          const ticks = makeTicks(start, end, bpPerPx)
          for (const { type, base } of ticks) {
            const el = container.children[childIdx] as HTMLElement
            const x =
              blockLeft + (reversed ? end - base : base - start) / bpPerPx
            el.style.cssText = `position:absolute;height:100%;width:1px;left:${x}px;background:${type === 'major' || type === 'labeledMajor' ? majorColor : minorColor}`
            childIdx++
          }
        } else if (block.type === 'ElidedBlock') {
          const el = container.children[childIdx] as HTMLElement
          el.style.cssText = `position:absolute;height:100%;left:${blockLeft}px;width:${block.widthPx}px;background-color:#999;background-image:repeating-linear-gradient(90deg,transparent,transparent 1px,rgba(255,255,255,.5) 1px,rgba(255,255,255,.5) 3px)`
          childIdx++
        } else if (block.type === 'InterRegionPaddingBlock') {
          const el = container.children[childIdx] as HTMLElement
          const bg =
            block.variant === 'boundary'
              ? disabledBgColor
              : textDisabledColor
          el.style.cssText = `position:absolute;height:100%;left:${blockLeft}px;width:${block.widthPx}px;background:${bg}`
          childIdx++
        }
      }
    })
  }, [model, theme])

  return (
    <div className={classes.verticalGuidesZoomContainer}>
      <div
        className={classes.verticalGuidesContainer}
        style={{
          left: offsetLeft - offset,
          width: staticBlocks.totalWidthPx,
        }}
      >
        <div ref={containerRef} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      </div>
    </div>
  )
})

export default Gridlines
