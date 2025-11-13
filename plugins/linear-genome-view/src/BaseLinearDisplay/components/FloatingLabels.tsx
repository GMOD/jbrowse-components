import { useMemo } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { calculateLabelPositions } from '../models/util'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../model'

const FloatingLabels = observer(function FloatingLabels({
  model,
}: {
  model: BaseLinearDisplayModel
}): React.ReactElement | null {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const { offsetPx } = view
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  // Calculate label positions using shared utility
  const labelData = useMemo(
    () => calculateLabelPositions(model, view, assembly, offsetPx),
    [model, view, assembly, offsetPx],
  )

  if (labelData.length === 0) {
    return null
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    >
      {labelData.map(({ key, label, description, leftPos, topPos }) => (
        <g key={key} transform={`translate(${leftPos}, ${topPos})`}>
          <text
            x={0}
            y={11}
            fontSize={11}
            fill="currentColor"
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
          {description ? (
            <text
              x={0}
              y={25}
              fontSize={11}
              fill="blue"
              style={{ pointerEvents: 'none' }}
            >
              {description}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
})

export default FloatingLabels
