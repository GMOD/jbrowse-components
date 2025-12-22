import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'

import { getFlatbushItemLabel } from '../types'

import type { FlatbushItem } from '../types'

export default function PileupTooltip({
  item,
  featureName,
  refName,
  mousePosition,
}: {
  item?: FlatbushItem
  featureName?: string
  refName: string
  mousePosition: { x: number; y: number }
}) {
  return (
    <BaseTooltip
      placement="bottom-start"
      clientPoint={{
        x: mousePosition.x,
        y: mousePosition.y + 20,
      }}
    >
      <div>
        <div>{featureName}</div>
        {item ? (
          <>
            <div
              style={{
                whiteSpace: 'pre-line',
              }}
            >
              {getFlatbushItemLabel(item)}
            </div>
            <div>
              Position: {refName}:{toLocale(item.start + 1)}
            </div>
          </>
        ) : null}
      </div>
    </BaseTooltip>
  )
}
