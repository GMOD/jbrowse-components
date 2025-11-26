import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function ScalebarRefNameLabels({ model }: { model: LGV }) {
  const theme = useTheme()
  const innerRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef<HTMLSpanElement | null>(null)

  // Handle offsetPx changes - update container position and pinned label
  useEffect(() => {
    return autorun(() => {
      const { staticBlocks, offsetPx, scaleBarDisplayPrefix } = model

      const inner = innerRef.current
      if (!inner) {
        return
      }

      // Translate container to account for scroll position
      inner.style.transform = `translateX(${-offsetPx}px)`

      // Find which block should be pinned
      let lastLeftBlock = 0
      let i = 0
      for (const block of staticBlocks) {
        if (block.offsetPx - offsetPx < 0) {
          lastLeftBlock = i
        } else {
          break
        }
        i++
      }

      const pinned = pinnedRef.current
      const pinnedBlock = staticBlocks.blocks[lastLeftBlock]
      if (pinned && pinnedBlock?.type === 'ContentBlock') {
        const val = scaleBarDisplayPrefix()
        pinned.style.transform = `translateX(${Math.max(0, offsetPx)}px)`
        pinned.textContent = (val ? `${val}:` : '') + pinnedBlock.refName
      }
    })
  }, [model])

  // Handle staticBlocks changes - create/update label elements
  useEffect(() => {
    const bgColor = theme.palette.background.paper

    return autorun(() => {
      const { staticBlocks } = model
      const inner = innerRef.current
      if (!inner) {
        return
      }

      const existingKeys = new Map<string, HTMLSpanElement>()
      for (const child of inner.children) {
        const key = (child as HTMLElement).dataset.labelKey
        if (key) {
          existingKeys.set(key, child as HTMLSpanElement)
        }
      }

      const fragment = document.createDocumentFragment()

      let index = 0
      for (const block of staticBlocks) {
        const {
          offsetPx: blockOffsetPx,
          isLeftEndOfDisplayedRegion,
          type,
          refName,
        } = block

        if (type === 'ContentBlock' && isLeftEndOfDisplayedRegion) {
          const key = `refLabel-${block.key}-${index}`
          let span = existingKeys.get(key)
          if (!span) {
            span = createLabelElement(bgColor)
            span.dataset.labelKey = key
            span.dataset.testid = `refLabel-${refName}`
          }
          span.style.left = `${blockOffsetPx - 1}px`
          span.style.paddingLeft = '1px'
          span.textContent = refName
          fragment.append(span)
        }
        index++
      }

      // Create pinned label
      const key = 'pinned-label'
      let pinned = existingKeys.get(key)
      if (!pinned) {
        pinned = createLabelElement(bgColor)
        pinned.dataset.labelKey = key
        pinned.style.zIndex = '2'
      }
      pinned.style.left = '0px'
      pinned.style.paddingLeft = '0px'
      pinnedRef.current = pinned
      fragment.append(pinned)

      inner.replaceChildren(fragment)
    })
  }, [model, theme])

  return <div ref={innerRef} style={{ position: 'absolute', willChange: 'transform' }} />
}

function createLabelElement(bgColor: string) {
  const span = document.createElement('span')
  span.style.fontSize = '11px'
  span.style.position = 'absolute'
  span.style.left = '2px'
  span.style.top = '-1px'
  span.style.fontWeight = 'bold'
  span.style.lineHeight = 'normal'
  span.style.zIndex = '1'
  span.style.background = bgColor
  return span
}

export default ScalebarRefNameLabels
