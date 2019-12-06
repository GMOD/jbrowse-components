import { getConf } from '@gmod/jbrowse-core/configuration'
import BlockBasedTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/BlockBasedTrack'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { Axis, axisPropsFromTickScale, RIGHT } from 'react-d3-axis'
import { getScale } from '../../util'
import { SNPTrackModel } from '../model'

const powersOfTen: number[] = []
for (let i = -20; i < 20; i += 1) {
  powersOfTen.push(10 ** i)
}
const YScaleBar = observer(
  ({ model }: { model: Instance<SNPTrackModel> }) => {
    const { domain, height } = model
    const scaleType = getConf(model, 'scaleType')
    const scale = getScale({
      scaleType,
      domain,
      range: [height, 0],
      inverted: getConf(model, 'inverted'),
      bounds: {
        min: getConf(model, 'minScore'),
        max: getConf(model, 'maxScore'),
      },
    })
    const axisProps = axisPropsFromTickScale(scale, 4)
    const values =
      scaleType === 'log'
        ? axisProps.values.filter((s: number) => powersOfTen.includes(s))
        : axisProps.values
    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 300,
          pointerEvents: 'none',
          height: '100%',
        }}
      >
        <Axis
          {...axisProps}
          values={values}
          format={(n: number) => n}
          style={{ orient: RIGHT }}
        />
      </svg>
    )
  },
)
function WiggleTrackComponent(props: { model: Instance<SNPTrackModel> }) {
  const { model } = props
  const { ready } = model

  const needsScalebar =
    model.rendererTypeName === 'XYPlotRenderer' ||
    model.rendererTypeName === 'LinePlotRenderer'

  return (
    <BlockBasedTrack {...props}>
      {ready && needsScalebar ? <YScaleBar model={model} /> : null}
    </BlockBasedTrack>
  )
}

WiggleTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(WiggleTrackComponent)
