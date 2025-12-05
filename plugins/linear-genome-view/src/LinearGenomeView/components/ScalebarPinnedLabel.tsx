import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

function ScalebarPinnedLabel({ model }: { model: LGV }) {
  const theme = useTheme()
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    return autorun(
      function pinnedLabelAutorun() {
        const { staticBlocks, offsetPx, scalebarDisplayPrefix } = model

        const span = spanRef.current
        if (!span) {
          return
        }

        // Find which block should be pinned (one that's off-screen left)
        let pinnedBlockIndex = -1
        let i = 0
        for (const block of staticBlocks) {
          if (block.offsetPx - offsetPx < 0) {
            pinnedBlockIndex = i
          } else {
            break
          }
          i++
        }

        const pinnedBlock = staticBlocks.blocks[pinnedBlockIndex]
        if (pinnedBlockIndex >= 0 && pinnedBlock?.type === 'ContentBlock') {
          const val = scalebarDisplayPrefix()
          span.style.display = ''
          span.textContent = (val ? `${val}:` : '') + pinnedBlock.refName
        } else {
          span.style.display = 'none'
        }
      },
      { name: 'ScalebarPinnedLabel' },
    )
  }, [model])

  return (
    <span
      ref={spanRef}
      style={{
        fontSize: '11px',
        position: 'absolute',
        left: 0,
        top: '-1px',
        fontWeight: 'bold',
        lineHeight: 'normal',
        zIndex: 2,
        background: theme.palette.background.paper,
      }}
    />
  )
}

export default ScalebarPinnedLabel
