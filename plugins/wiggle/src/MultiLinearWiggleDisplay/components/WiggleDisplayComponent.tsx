import React from 'react'
import {
  measureText,
  getContainingView,
  getContainingTrack,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import { WiggleDisplayModel } from '../models/model'
import YScaleBar from './YScaleBar'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Wrapper = observer(
  ({
    children,
    model,
    exportSVG,
  }: {
    model: WiggleDisplayModel
    children: React.ReactNode
    exportSVG?: boolean
  }) => {
    if (exportSVG) {
      return <>{children}</>
    } else {
      const { height } = model
      const { trackLabels } = getContainingView(model) as LGV
      const track = getContainingTrack(model)
      const left =
        trackLabels === 'overlapping'
          ? measureText(getConf(track, 'name'), 12.8) + 100
          : 10
      return (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left,
            pointerEvents: 'none',
            height,
            width: 1800,
          }}
        >
          {children}
        </svg>
      )
    }
  },
)

export const StatBars = observer(
  (props: {
    model: WiggleDisplayModel
    orientation?: string
    exportSVG?: boolean
  }) => {
    const { model, orientation } = props
    const { stats, height, needsScalebar, needsScaleSmall, sources, ticks } =
      model

    return (
      <>
        {stats ? (
          <>
            {needsScalebar ? (
              <Wrapper {...props}>
                <YScaleBar model={model} orientation={orientation} />
              </Wrapper>
            ) : null}

            {needsScaleSmall && sources ? (
              <Wrapper {...props}>
                {sources.map((source, idx) => {
                  const label = `[${ticks.values[0]}-${ticks.values[1]}] ${source}`
                  const smheight = height / sources.length

                  return (
                    <React.Fragment key={JSON.stringify(ticks) + '-' + idx}>
                      <rect
                        y={idx * smheight + 1}
                        x={0}
                        width={measureText(label, 14) + 6}
                        height={16}
                        fill="rgb(255,255,255,0.8)"
                        rx={3}
                      />
                      <text y={idx * smheight + 13} x={2}>
                        {label}
                      </text>
                    </React.Fragment>
                  )
                })}
              </Wrapper>
            ) : null}
          </>
        ) : null}
      </>
    )
  },
)

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <StatBars model={model} />
    </div>
  )
})

export default LinearWiggleDisplay

export { YScaleBar }
