import React from 'react'

import {
  SimpleFeature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import type { LinearVariantMatrixDisplayModel } from '../../LinearVariantMatrixDisplay/model'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LinesConnectingMatrixToGenomicPosition = observer(function ({
  model,
  features = [],
}: {
  features?: Feature[]
  model: LinearVariantMatrixDisplayModel
}) {
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { width, offsetPx, assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const w = width / features.length
  return assembly ? (
    <svg width={width} height={20}>
      {features.map((f, i) => {
        const f2 = new SimpleFeature({
          // @ts-expect-error
          id: f.uniqueId,
          // @ts-expect-error
          data: f.data,
        })
        const c =
          (view.bpToPx({
            refName:
              assembly.getCanonicalRefName(f2.get('refName')) ||
              f2.get('refName'),
            coord: f2.get('start'),
          })?.offsetPx || 0) - Math.max(offsetPx, 0)
        return (
          <line
            stroke="black"
            key={f2.id()}
            x1={i * w + w / 2}
            x2={c}
            y1={20}
            y2={0}
          />
        )
      })}
    </svg>
  ) : null
})

export default LinesConnectingMatrixToGenomicPosition
