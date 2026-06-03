import { observer } from 'mobx-react'

import { LD_LEGEND } from '../ldBins.ts'

// LocusZoom-style r² key, shown when the display colors points by LD to the
// index SNP. Positioned top-right over the plot, like LocusZoom.
const LdColorLegend = observer(function LdColorLegend({
  offsetTop,
}: {
  offsetTop: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: offsetTop + 2,
        right: 4,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid #ccc',
        borderRadius: 3,
        padding: '2px 5px',
        fontSize: 10,
        lineHeight: 1.4,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 'bold' }}>r² to index</div>
      {LD_LEGEND.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              marginRight: 4,
              background: color,
              border: '1px solid rgba(0,0,0,0.2)',
            }}
          />
          {label}
        </div>
      ))}
    </div>
  )
})

export default LdColorLegend
