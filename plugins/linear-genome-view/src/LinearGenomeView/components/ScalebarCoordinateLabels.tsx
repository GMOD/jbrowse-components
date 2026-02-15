import { useEffect, useRef } from 'react'

import { getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(() => ({
  elidedBlock: {
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
}))

const ScalebarCoordinateLabels = observer(function ScalebarCoordinateLabels({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const labelBg = theme.palette.background.paper
    const elidedClass = classes.elidedBlock

    return autorun(() => {
      const container = containerRef.current
      if (!container) {
        return
      }
      const { staticBlocks, bpPerPx } = model
      const blocks = staticBlocks.blocks

      // sync block wrapper count
      while (container.childElementCount > blocks.length) {
        container.lastElementChild!.remove()
      }
      while (container.childElementCount < blocks.length) {
        container.appendChild(document.createElement('div'))
      }

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        const wrapper = container.children[i] as HTMLElement

        wrapper.style.position = 'relative'
        wrapper.style.flexShrink = '0'
        wrapper.style.overflow = 'hidden'
        wrapper.style.height = '13px'
        wrapper.style.width = `${block.widthPx}px`

        if (block.type === 'ContentBlock') {
          wrapper.className = ''
          const { start, end, reversed } = block
          const ticks = makeTicks(start, end, bpPerPx, true, false)
          const majorTicks = ticks.filter(t => t.type === 'major')

          // sync tick children count
          while (wrapper.childElementCount > majorTicks.length) {
            wrapper.lastElementChild!.remove()
          }
          while (wrapper.childElementCount < majorTicks.length) {
            const tick = document.createElement('div')
            tick.style.position = 'absolute'
            tick.style.width = '0'
            tick.style.display = 'flex'
            tick.style.justifyContent = 'center'
            tick.style.pointerEvents = 'none'
            const label = document.createElement('div')
            label.style.fontSize = '11px'
            label.style.zIndex = '1'
            label.style.lineHeight = 'normal'
            label.style.pointerEvents = 'none'
            tick.appendChild(label)
            wrapper.appendChild(tick)
          }

          for (let j = 0; j < majorTicks.length; j++) {
            const { base } = majorTicks[j]!
            const tick = wrapper.children[j] as HTMLElement
            const x = (reversed ? end - base : base - start) / bpPerPx
            tick.style.left = `${x}px`
            const label = tick.firstElementChild as HTMLElement
            label.style.background = labelBg
            label.textContent = getTickDisplayStr(base + 1, bpPerPx)
          }
        } else if (block.type === 'ElidedBlock') {
          wrapper.className = elidedClass
          while (wrapper.firstChild) {
            wrapper.firstChild.remove()
          }
        } else {
          wrapper.className = ''
          while (wrapper.firstChild) {
            wrapper.firstChild.remove()
          }
        }
      }
    })
  }, [model, theme, classes.elidedBlock])

  return <div ref={containerRef} style={{ display: 'flex' }} />
})

export default ScalebarCoordinateLabels
