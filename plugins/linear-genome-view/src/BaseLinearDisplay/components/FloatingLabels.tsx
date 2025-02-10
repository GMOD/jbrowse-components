import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../models/BaseLinearDisplayModel'

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

        // @ts-expect-error
        .filter(f => !!f[1]?.feature)
        .map(([key, val]) => {
          // @ts-expect-error
          const [left, , right, bottom, feature] = val!
          const { refName, description, label } = feature!
          console.log({ label, description, feature })
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
                top: bottom - 14,
              }}
            >
              <div>{label}</div>
              <div>{description}</div>
            </div>
          ) : null
        })}
    </div>
  ) : null
})

export default FloatingLabels
