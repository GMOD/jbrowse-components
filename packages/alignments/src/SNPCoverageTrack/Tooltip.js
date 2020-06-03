import React, { useRef } from 'react'
import { getConf } from '@gmod/jbrowse-core/configuration'
import PropTypes from 'prop-types'
import Popper from '@material-ui/core/Popper'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'

function TooltipContents(props) {
  const { feature } = props
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

  return (
    <Paper>
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
    </Paper>
  )
}

TooltipContents.propTypes = {
  feature: PropTypes.shape({}).isRequired,
}

const Tooltip = observer(props => {
  const { model, mouseCoord } = props
  const { featureUnderMouse } = model
  const ref = useRef()
  return featureUnderMouse ? (
    <>
      {ref.current ? (
        <Popper anchorEl={ref.current} open>
          <TooltipContents
            feature={featureUnderMouse}
            offsetX={mouseCoord[0]}
          />
        </Popper>
      ) : null}

      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: mouseCoord[0],
          top: mouseCoord[1],
        }}
      >
        {' '}
      </div>
    </>
  ) : null
})

export default Tooltip
