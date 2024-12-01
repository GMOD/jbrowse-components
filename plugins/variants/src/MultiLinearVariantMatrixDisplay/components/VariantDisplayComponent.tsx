import React, { useRef, useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LegendBar from '../../shared/LegendBar'

import type { LinearVariantMatrixDisplayModel } from '../model'

const MultiLinearVariantMatrixDisplayComponent = observer(function (props: {
  model: LinearVariantMatrixDisplayModel
}) {
  const { model } = props
  const { sources, rowHeight } = model
  const ref = useRef<HTMLDivElement>(null)
  const [mouseY, setMouseY] = useState<number>()

  return (
    <div
      ref={ref}
      onMouseMove={event => {
        const top = ref.current?.getBoundingClientRect().top || 0
        setMouseY(event.clientY - top)
      }}
      onMouseLeave={() => {
        setMouseY(undefined)
      }}
    >
      {mouseY && mouseY > 20 && sources ? (
        <BaseTooltip>
          <SanitizedHTML
            html={Object.entries(
              sources[Math.floor((mouseY - 20) / rowHeight)] || {},
            )
              .filter(([key]) => key !== 'color')
              .map(([key, value]) => `${key}:${value}`)
              .join('\n')}
          />
        </BaseTooltip>
      ) : null}
      <BaseLinearDisplayComponent {...props} />
      <LegendBar model={model} />
    </div>
  )
})

export default MultiLinearVariantMatrixDisplayComponent
