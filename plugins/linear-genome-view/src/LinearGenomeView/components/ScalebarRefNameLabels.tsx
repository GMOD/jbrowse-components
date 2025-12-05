import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { getCachedElements, getPinnedContentBlock } from '../util'
import ScalebarPinnedLabel from './ScalebarPinnedLabel'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function updateFirstLabelPrefix(
  firstLabel: HTMLSpanElement | null,
  model: LGV,
) {
  if (!firstLabel) {
    return
  }
  const { staticBlocks, offsetPx, scalebarDisplayPrefix } = model
  const pinnedBlock = getPinnedContentBlock(staticBlocks, offsetPx)
  const prefix = scalebarDisplayPrefix()
  const refName = firstLabel.dataset.refname || ''
  const showPrefix = prefix && !pinnedBlock
  firstLabel.textContent = (showPrefix ? `${prefix}:` : '') + refName
}

function ScalebarRefNameLabels({ model }: { model: LGV }) {
  const theme = useTheme()
  const innerRef = useRef<HTMLDivElement>(null)
  const lastBpPerPxRef = useRef<number | null>(null)
  const firstLabelRef = useRef<HTMLSpanElement | null>(null)

  // Fast path: update transform and prefix on scroll
  useEffect(() => {
    return autorun(
      function refNameLabelsOffsetAutorun() {
        const { offsetPx } = model
        const inner = innerRef.current
        if (inner) {
          inner.style.transform = `translateX(${-offsetPx}px)`
        }
        updateFirstLabelPrefix(firstLabelRef.current, model)
      },
      { name: 'RefNameLabelsOffset' },
    )
  }, [model])

  // Slow path: rebuild labels when blocks change
  useEffect(() => {
    const bgColor = theme.palette.background.paper

    return autorun(
      function refNameLabelsLayoutAutorun() {
        const { staticBlocks, bpPerPx } = model
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
        firstLabelRef.current = null

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
            span.dataset.refname = refName
            span.style.left = `${blockOffsetPx - 1}px`
            span.style.paddingLeft = '1px'
            span.textContent = refName
            fragment.append(span)
            if (!firstLabelRef.current) {
              firstLabelRef.current = span
            }
          }
          index++
        }

        inner.replaceChildren(fragment)
        updateFirstLabelPrefix(firstLabelRef.current, model)
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
