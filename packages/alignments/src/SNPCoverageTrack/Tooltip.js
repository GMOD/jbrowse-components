export default function Tooltip({ offsetX, feature }) {
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
