import React from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getBpDisplayStr,
  getContainingView,
  toLocale,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MAFTooltipProps {
  mouseY: number
  mouseX: number
  rowHeight: number
  sources: Record<string, any>[]
  model: LinearMafDisplayModel
  origMouseX?: number
}

const MAFTooltip = observer(function ({
  model,
  mouseY,
  mouseX,
  origMouseX,
  rowHeight,
  sources,
}: MAFTooltipProps) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const ret = Object.entries(sources[Math.floor(mouseY / rowHeight)] || {})
    .filter(([key]) => key !== 'color' && key !== 'id')
    .map(([key, value]) => `${key}:${value}`)
    .join('\n')
  const p1 = origMouseX ? view.pxToBp(origMouseX) : undefined
  const p2 = view.pxToBp(mouseX)
  return ret ? (
    <BaseTooltip>
      <SanitizedHTML
        html={[
          ret,
          ...(p1
            ? [
                `Start: ${p1.refName}:${toLocale(p1.coord)}`,
                `End: ${p2.refName}:${toLocale(p2.coord)}`,
                `Length: ${getBpDisplayStr(Math.abs(p1.coord - p2.coord))}`,
              ]
            : [`${p2.refName}:${toLocale(p2.coord)}`]),
        ]
          .filter(f => !!f)
          .join('<br/>')}
      />
    </BaseTooltip>
  ) : null
})

export default MAFTooltip
