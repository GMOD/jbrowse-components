import React from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { generateTooltipContent } from '../util'

import type { LinearMafDisplayModel } from '../stateModel'
import type { HoveredInfo } from '../util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const MAFTooltip = observer(function ({
  model,
  mouseX,
  origMouseX,
}: {
  mouseX: number
  model: LinearMafDisplayModel
  origMouseX?: number
}) {
  const { hoveredInfo } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const p1 = origMouseX ? view.pxToBp(origMouseX) : undefined
  const p2 = view.pxToBp(mouseX)

  return hoveredInfo ? (
    <BaseTooltip>
      <SanitizedHTML
        html={generateTooltipContent(hoveredInfo as HoveredInfo, p1, p2)}
      />
    </BaseTooltip>
  ) : null
})

export default MAFTooltip
