import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { getCachedElements } from '../util'
import ScalebarPinnedLabel from './ScalebarPinnedLabel'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function ScalebarRefNameLabels({ model }: { model: LGV }) {
  const theme = useTheme()
  const innerRef = useRef<HTMLDivElement>(null)
  const lastBpPerPxRef = useRef<number | null>(null)

  // Handle offsetPx changes - update container position
  useEffect(() => {
    return autorun(
      function refNameLabelsOffsetAutorun() {
        const { offsetPx } = model
        const inner = innerRef.current
        if (inner) {
          inner.style.transform = `translateX(${-offsetPx}px)`
        }
      },
      { name: 'RefNameLabelsOffset' },
    )
  }, [model])

  // Handle staticBlocks changes - create/update label elements
  useEffect(() => {
    const bgColor = theme.palette.background.paper

    return autorun(
      function refNameLabelsLayoutAutorun() {
        const { staticBlocks, bpPerPx, scaleBarDisplayPrefix } = model
        const prefix = scaleBarDisplayPrefix()
        const inner = innerRef.current
        if (!inner) {
          return
        }

        const existingKeys = getCachedElements<HTMLSpanElement>(
          inner,
          bpPerPx,
          lastBpPerPxRef,
          'labelKey',
        )

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
            span.textContent = (prefix ? `${prefix}:` : '') + refName
            fragment.append(span)
          }
          index++
        }

        inner.replaceChildren(fragment)
      },
      { name: 'RefNameLabelsLayout' },
    )
  }, [model, theme])

  return (
    <>
      <div ref={innerRef} style={{ position: 'absolute' }} />
      <ScalebarPinnedLabel model={model} />
    </>
  )
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
