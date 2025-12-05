import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { getPinnedContentBlock } from '../util'

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

        const pinnedBlock = getPinnedContentBlock(staticBlocks, offsetPx)
        if (pinnedBlock) {
          const prefix = scalebarDisplayPrefix()
          span.style.display = ''
          span.textContent = (prefix ? `${prefix}:` : '') + pinnedBlock.refName
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
