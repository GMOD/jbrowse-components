import React from 'react'
import { observer } from 'mobx-react'

// locals
import { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'
import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '../../LinearGenomeView'

const FloatingLabels = observer(function ({
  model,
}: {
  model: BaseLinearDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const { offsetPx } = view
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  return assembly ? (
    <svg id="wow" style={{ width: '100%', height: '100%' }}>
      {[...model.layoutFeatures.entries()]
        .filter(f => !!f[1])
        .map(([key, val]) => {
          // @ts-expect-error
          const [left, , right, bottom, feature] = val!
          const { refName, label } = feature!
          const r0 = assembly.getCanonicalRefName(refName) || refName
          const r = view.bpToPx({
            refName: r0,
            coord: left,
          })?.offsetPx
          const r2 = view.bpToPx({
            refName: r0,
            coord: right,
          })?.offsetPx
          return r !== undefined ? (
            <text
              key={key}
              fontSize={10}
              x={clamp(
                0,
                r - offsetPx,
                r2 !== undefined
                  ? r2 - offsetPx - measureText(label)
                  : Number.POSITIVE_INFINITY,
              )}
              y={bottom}
            >
              {label}
            </text>
          ) : null
        })}
    </svg>
  ) : null
})

export default FloatingLabels
