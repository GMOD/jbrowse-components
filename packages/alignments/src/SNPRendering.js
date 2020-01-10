import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'
import './SNPRendering.scss'

const toP = s => parseFloat(s.toPrecision(6))

function Tooltip({ offsetX, feature }) {
  const { info } = feature
  const total = info ? info[info.map(e => e.base).indexOf('total')].score : 0
  const condId = info.length >= 5 ? 'smallInfo' : 'info' // readjust table size to fit all

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

  return (
    <>
      <div
        className="hoverLabel"
        style={{ left: `${offsetX}px`, zIndex: 10000 }}
      >
        {info ? (
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
        ) : (
          toP(37)
        )}
      </div>
      <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
    </>
  )
}

Tooltip.propTypes = {
  offsetX: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.object.isRequired,
}

class SNPRendering extends Component {
  static propTypes = {
    height: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    region: CommonPropTypes.Region.isRequired,
    features: ReactPropTypes.instanceOf(Map).isRequired,
    bpPerPx: ReactPropTypes.number.isRequired,
    horizontallyFlipped: ReactPropTypes.bool,
    trackModel: ReactPropTypes.shape({
      /** id of the currently selected feature, if any */
      selectedFeatureId: ReactPropTypes.string,
    }),
    featureList: ReactPropTypes.array,
  }

  static defaultProps = {
    horizontallyFlipped: false,
    trackModel: {},
    featureList: [],
  }

  constructor(props) {
    super(props)
    this.state = {}
    this.ref = React.createRef()
  }

  onMouseMove(evt) {
    const {
      region,
      bpPerPx,
      horizontallyFlipped,
      width,
      featureList,
    } = this.props

    const { clientX } = evt
    let offset = 0
    if (this.ref.current) {
      offset = this.ref.current.getBoundingClientRect().left
    }
    const offsetX = clientX - offset
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px

    for (const feature of featureList) {
      if (Math.floor(clientBp) === feature.position) {
        this.setState({ clientX, featureUnderMouse: feature })
      }
    }
  }

  onMouseLeave() {
    this.setState({ featureUnderMouse: undefined })
  }

  /**
   * @param {string} handlerName
   * @param {*} event - the actual mouse event
   * @param {bool} always - call this handler even if there is no feature
   */
  callMouseHandler(handlerName, event, always = false) {
    // eslint-disable-next-line react/destructuring-assignment
    const featureHandler = this.props[`onFeature${handlerName}`]
    // eslint-disable-next-line react/destructuring-assignment
    const canvasHandler = this.props[`on${handlerName}`]
    const { featureUnderMouse } = this.state
    if (featureHandler && (always || featureUnderMouse)) {
      featureHandler(event, featureUnderMouse)
    } else if (canvasHandler) {
      canvasHandler(event, featureUnderMouse)
    }
  }

  render() {
    const { featureUnderMouse, clientX } = this.state
    const { height } = this.props
    let offset = 0
    if (this.ref.current) {
      offset = this.ref.current.getBoundingClientRect().left
    }

    return (
      <div
        ref={this.ref}
        onMouseMove={this.onMouseMove.bind(this)}
        onMouseLeave={this.onMouseLeave.bind(this)}
        role="presentation"
        onFocus={() => {}}
        className="SNPRendering"
        style={{
          overflow: 'visible',
          position: 'relative',
          height,
        }}
      >
        <PrerenderedCanvas {...this.props} />
        {featureUnderMouse ? (
          <Tooltip feature={featureUnderMouse} offsetX={clientX - offset} />
        ) : null}
      </div>
    )
  }
}

export default observer(SNPRendering)
