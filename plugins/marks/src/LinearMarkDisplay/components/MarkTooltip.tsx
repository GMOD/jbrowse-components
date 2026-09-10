import HoverTooltip from '@jbrowse/core/ui/HoverTooltip'
import { assembleLocString } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { valueField } from '@jbrowse/core/util/markEncoding'
import { toP } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { categoryLabel, colorSection } from '../legend.ts'

import type { MarkShapeName } from '../configSchema.ts'
import type { MarkHitInfo } from '../findMarkHit.ts'
import type { MarkLegendSection } from '../legend.ts'
import type { MouseState } from '@jbrowse/core/ui'
import type { MarkEncoding } from '@jbrowse/core/util/markEncoding'

export interface MarkTooltipModel {
  hoveredFeature: MarkHitInfo | undefined
  encodings: MarkEncoding[]
  markShapes: MarkShapeName[]
  legendSections: MarkLegendSection[]
}

const MarkTooltip = observer(function MarkTooltip({
  model,
  mouseState,
}: {
  model: MarkTooltipModel
  mouseState: MouseState | undefined
}) {
  const { hoveredFeature: hit, encodings, markShapes, legendSections } = model
  const encoding = hit ? encodings[hit.markIndex] : undefined
  const scale = hit ? colorSection(legendSections, hit.markIndex) : undefined
  const label =
    hit?.color === undefined ? undefined : categoryLabel(scale, hit.color)
  const swatch = hit?.color === undefined ? undefined : abgrToCssRgba(hit.color)
  return (
    <HoverTooltip hit={hit} mouseState={mouseState}>
      {hit ? (
        <div>
          {assembleLocString(hit)}
          <br />
          {markShapes[hit.markIndex]}
          {hit.y === undefined || !encoding?.y ? null : (
            <>
              <br />
              {valueField(encoding.y)}: {toP(hit.y, 4)}
            </>
          )}
          {scale && (swatch !== undefined || hit.colorValue !== undefined) ? (
            <>
              <br />
              {swatch === undefined ? null : (
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    marginRight: 4,
                    background: swatch,
                  }}
                />
              )}
              {scale.field}
              {hit.colorValue !== undefined
                ? `: ${toP(hit.colorValue, 4)}`
                : label === undefined
                  ? ''
                  : `: ${label}`}
            </>
          ) : null}
        </div>
      ) : null}
    </HoverTooltip>
  )
})

export default MarkTooltip
