/* eslint-disable no-nested-ternary */
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useState, useRef } from 'react'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/util/types/mst'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import MUITooltip from '@material-ui/core/Tooltip'
import './WiggleRendering.scss'

const toP = s => parseFloat(s.toPrecision(6))

function Tooltip({ offsetX, feature }) {
  const info = feature.get('snpinfo') ? feature.get('snpinfo') : null
  const total = info ? info[info.map(e => e.base).indexOf('total')].score : 0
  const condId = info && info.length >= 5 ? 'smallInfo' : 'info' // readjust table size to fit all

  // construct a table with all relevant information
  const renderTableData = info
    ? info.map(mismatch => {
        const { base, score, strands } = mismatch
        return (
          <tr key={base}>
            <td id={condId}>{base.toUpperCase()}</td>
            <td id={condId}>{score}</td>
            <td id={condId}>
              {base === 'total'
                ? '---'
                : `${Math.floor((score / total) * 100)}%`}
            </td>
            <td id={condId}>
              {base === 'total'
                ? '---'
                : (strands['+']
                    ? `+:${strands['+']} ${strands['-'] ? `,\t` : `\t`} `
                    : ``) + (strands['-'] ? `-:${strands['-']}` : ``)}
            </td>
          </tr>
        )
      })
    : null

  const contents = info ? (
    <div id="info">
      <table>
        <thead>
          <tr>
            <th id={condId}>Base</th>
            <th id={condId}>Count</th>
            <th id={condId}>% of Total</th>
            <th id={condId}>Strands</th>
          </tr>
        </thead>
        <tbody>{renderTableData}</tbody>
      </table>
    </div>
  ) : feature.get('maxScore') !== undefined ? (
    <div>
      Summary
      <br />
      Max: {toP(feature.get('maxScore'))}
      <br />
      Avg: {toP(feature.get('score'))}
      <br />
      Min: {toP(feature.get('minScore'))}
    </div>
  ) : (
    toP(feature.get('score'))
  )

  return (
    <>
      <MUITooltip title={contents} placement="right-start" open>
        <div
          className="hoverLabel"
          style={{
            left: `${offsetX}px`,
            zIndex: 10000,
            width: 1,
            height: 100,
          }}
        >
          {' '}
        </div>
      </MUITooltip>
      <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
    </>
  )
}

Tooltip.propTypes = {
  offsetX: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.object.isRequired,
}

function WiggleRendering(props) {
  const {
    trackModel,
    regions,
    features,
    bpPerPx,
    width,
    height,
    onMouseLeave,
    onMouseMove,
  } = props
  const [region] = regions
  const ref = useRef()

  let offset = 0
  if (ref.current) {
    offset = ref.current.getBoundingClientRect().left
  }
  function mouseMove(event) {
    const offsetX = event.clientX - offset
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    let featureIdUnderMouse
    for (const feature of features.values()) {
      if (clientBp <= feature.get('end') && clientBp >= feature.get('start')) {
        featureIdUnderMouse = feature
        break
      }
    }
    console.log('wtf', onMouseMove)

    if (onMouseMove) {
      onMouseMove(event, featureIdUnderMouse)
    }
  }

  function mouseLeave(event) {
    if (onMouseLeave) {
      onMouseLeave(event)
    }
  }

  return (
    <div
      ref={ref}
      onMouseMove={mouseMove}
      onMouseLeave={mouseLeave}
      role="presentation"
      onFocus={() => {}}
      className="WiggleRendering"
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
}

WiggleRendering.propTypes = {
  height: ReactPropTypes.number.isRequired,
  width: ReactPropTypes.number.isRequired,
  regions: ReactPropTypes.arrayOf(CommonPropTypes.Region).isRequired,
  features: ReactPropTypes.instanceOf(Map).isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  trackModel: ReactPropTypes.shape({
    /** id of the currently selected feature, if any */
    selectedFeatureId: ReactPropTypes.string,
  }),
}

WiggleRendering.defaultProps = {
  trackModel: {},
}

export default observer(WiggleRendering)
