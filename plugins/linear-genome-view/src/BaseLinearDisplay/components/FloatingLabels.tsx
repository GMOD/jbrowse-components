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
        .filter(([_key, val]) => !!val![4])
        .map(([key, val]) => {
          // @ts-expect-error
          const [left, , right, bottom, feature] = val!

          // Type assertion to ensure feature is properly typed
          if (!feature) {
            return null
          }

          // @ts-expect-error
          const refName = feature.refName as string
          // @ts-expect-error
          const description = feature.description as string
          // @ts-expect-error
          const label = feature.label as string

          // Get canonical reference name
          const canonicalRefName =
            assembly.getCanonicalRefName(refName) || refName

          // Calculate positions
          const leftPosition = view.bpToPx({
            refName: canonicalRefName,
            coord: left as number,
          })

          const rightPosition = view.bpToPx({
            refName: canonicalRefName,
            coord: right as number,
          })

          // Skip rendering if position is undefined
          if (!leftPosition?.offsetPx) {
            return null
          }

          const leftPx = leftPosition.offsetPx
          const rightPx = rightPosition?.offsetPx
          const labelWidth = measureText(label)
          const bottomPosition = (bottom as number) - 14

          // Calculate the left position with constraints
          const leftPositionClamped = clamp(
            0,
            leftPx - offsetPx,
            rightPx !== undefined
              ? rightPx - offsetPx - labelWidth
              : Number.POSITIVE_INFINITY,
          )

          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                fontSize: 11,
                pointerEvents: 'none',
                left: leftPositionClamped,
                top: bottomPosition,
              }}
            >
              <div>{label}</div>
              <div>{description}</div>
            </div>
          )
        })}
    </div>
  ) : null
})

export default FloatingLabels
