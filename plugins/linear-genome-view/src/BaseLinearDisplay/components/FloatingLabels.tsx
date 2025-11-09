import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../model'

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
    <div style={{ position: 'relative' }}>
      {[...model.layoutFeatures.entries()]

        .filter(f => !!f[1]?.[4])
        .map(([key, val]) => {
          const [left, , right, bottom, feature] = val!
          const { refName = '', description, label } = feature || {}
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
            <div
              key={key}
              style={{
                position: 'absolute',
                fontSize: 11,
                pointerEvents: 'none',
                left: clamp(
                  0,
                  r - offsetPx,
                  r2 !== undefined
                    ? r2 - offsetPx - measureText(label)
                    : Number.POSITIVE_INFINITY,
                ),
                top: bottom - 14 * (+!!label + +!!description),
              }}
            >
              <div>{label}</div>
              <div style={{ color: 'blue' }}>{description}</div>
            </div>
          ) : null
        })}
    </div>
  ) : null
})

export default FloatingLabels
