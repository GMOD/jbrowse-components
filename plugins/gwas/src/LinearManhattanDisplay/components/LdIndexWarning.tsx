import { observer } from 'mobx-react'

// Shown over the plot when LD coloring is on but the index SNP wasn't found in
// the LD data for the loaded region, so every point is grey.
const LdIndexWarning = observer(function LdIndexWarning({
  offsetTop,
}: {
  offsetTop: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: offsetTop + 2,
        left: 4,
        background: 'rgba(255,243,205,0.95)',
        border: '1px solid #e0c265',
        borderRadius: 3,
        padding: '2px 6px',
        fontSize: 11,
        pointerEvents: 'none',
      }}
    >
      Index SNP not found in LD data — try “Set index SNP to top hit” in the
      track menu
    </div>
  )
})

export default LdIndexWarning
