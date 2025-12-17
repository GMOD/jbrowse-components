import { useEffect, useRef, useState } from 'react'

import { CascadingMenu } from '@jbrowse/core/ui'
import { usePopupState } from '@jbrowse/core/ui/hooks'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { getCachedElements, getPinnedContentBlock } from '../util'

import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function ScalebarRefNameLabels({ model }: { model: LGV }) {
  const theme = useTheme()
  const innerRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef<HTMLSpanElement>(null)
  const lastBpPerPxRef = useRef<number | null>(null)
  const firstLabelRef = useRef<HTMLSpanElement | null>(null)
  const blockMapRef = useRef<Map<string, BaseBlock>>(new Map())
  const [clickedBlock, setClickedBlock] = useState<BaseBlock>()
  const popupState = usePopupState()

  // Fast path: update transform and labels on scroll
  useEffect(() => {
    return autorun(
      function refNameLabelsOffsetAutorun() {
        const { staticBlocks, offsetPx, scalebarDisplayPrefix } = model
        const inner = innerRef.current
        const pinned = pinnedRef.current
        const firstLabel = firstLabelRef.current
        if (inner) {
          inner.style.transform = `translateX(${Math.round(-offsetPx)}px)`
        }

        const pinnedBlock = getPinnedContentBlock(staticBlocks, offsetPx)
        const prefix = scalebarDisplayPrefix()

        // Update pinned label
        if (pinned) {
          if (pinnedBlock) {
            pinned.style.display = ''
            pinned.textContent =
              (prefix ? `${prefix}:` : '') + pinnedBlock.refName
            pinned.dataset.blockKey = pinnedBlock.key
          } else {
            pinned.style.display = 'none'
            pinned.dataset.blockKey = ''
          }
        }

        // Update first label prefix (only show if no pinned block)
        if (firstLabel) {
          const refName = firstLabel.dataset.refname || ''
          const showPrefix = prefix && !pinnedBlock
          firstLabel.textContent = (showPrefix ? `${prefix}:` : '') + refName
        }
      },
      { name: 'RefNameLabelsOffset' },
    )
  }, [model])

  // Slow path: rebuild labels when blocks change
  useEffect(() => {
    const bgColor = theme.palette.background.paper

    return autorun(
      function refNameLabelsLayoutAutorun() {
        const { staticBlocks, bpPerPx, offsetPx, scalebarDisplayPrefix } = model
        const inner = innerRef.current
        const pinned = pinnedRef.current
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
        blockMapRef.current.clear()

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
            span.dataset.blockKey = block.key
            span.style.left = `${blockOffsetPx - 1}px`
            span.style.paddingLeft = '1px'
            span.style.cursor = 'pointer'
            span.textContent = refName
            fragment.append(span)
            blockMapRef.current.set(block.key, block)
            if (!firstLabelRef.current) {
              firstLabelRef.current = span
            }
          }
          index++
        }

        inner.replaceChildren(fragment)

        // Update labels with prefix info
        const pinnedBlock = getPinnedContentBlock(staticBlocks, offsetPx)
        const prefix = scalebarDisplayPrefix()
        if (pinned) {
          if (pinnedBlock) {
            pinned.style.display = ''
            pinned.textContent =
              (prefix ? `${prefix}:` : '') + pinnedBlock.refName
            pinned.dataset.blockKey = pinnedBlock.key
            blockMapRef.current.set(pinnedBlock.key, pinnedBlock)
          } else {
            pinned.style.display = 'none'
            pinned.dataset.blockKey = ''
          }
        }
        if (firstLabelRef.current) {
          const refName = firstLabelRef.current.dataset.refname || ''
          const showPrefix = prefix && !pinnedBlock
          firstLabelRef.current.textContent =
            (showPrefix ? `${prefix}:` : '') + refName
        }
      },
      { name: 'RefNameLabelsLayout' },
    )
  }, [model, theme])

  const bgColor = theme.palette.background.paper

  function handleLabelClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement
    const blockKey = target.dataset.blockKey
    if (blockKey) {
      const block = blockMapRef.current.get(blockKey)
      if (block) {
        setClickedBlock(block)
        popupState.open(event)
      }
    }
  }

  function getMenuItems() {
    if (!clickedBlock) {
      return []
    }
    const { refName, assemblyName } = clickedBlock

    return [
      {
        label: `Show only ${refName}`,
        onClick: () => {
          model.navToLocString(refName, assemblyName)
        },
      },
    ]
  }

  return (
    <>
      <div
        ref={innerRef}
        onClick={handleLabelClick}
        style={{ position: 'absolute' }}
      />
      <span
        ref={pinnedRef}
        onClick={handleLabelClick}
        style={{
          fontSize: '11px',
          position: 'absolute',
          left: 0,
          top: '-1px',
          fontWeight: 'bold',
          lineHeight: 'normal',
          zIndex: 2,
          background: bgColor,
          cursor: 'pointer',
        }}
      />
      <CascadingMenu
        menuItems={getMenuItems()}
        onMenuItemClick={(
          _event: React.MouseEvent,
          callback: () => void,
        ) => {
          callback()
        }}
        popupState={popupState}
      />
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
