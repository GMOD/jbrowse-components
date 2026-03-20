import { observer } from 'mobx-react'

const buttonStyle = {
  fontSize: 10,
  padding: '2px 6px',
  cursor: 'pointer',
  border: '1px solid rgba(0,0,0,0.2)',
  borderRadius: 3,
  background: 'rgba(255,255,255,0.85)',
  color: '#555',
} as const

const OverflowIndicator = observer(function OverflowIndicator({
  expanded,
  showScrollHint,
  onExpand,
  onRestore,
}: {
  expanded: boolean
  showScrollHint: boolean
  onExpand: () => void
  onRestore: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 999,
        pointerEvents: 'auto',
      }}
    >
      {showScrollHint ? (
        <span
          style={{
            fontSize: 9,
            color: '#888',
            background: 'rgba(255,255,255,0.75)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          shift+wheel to scroll
        </span>
      ) : null}
      {expanded ? (
        <button
          title="Restore previous track height"
          style={buttonStyle}
          onClick={e => {
            e.stopPropagation()
            onRestore()
          }}
        >
          ↕ Restore height
        </button>
      ) : (
        <button
          title="Expand track to fit all features"
          style={buttonStyle}
          onClick={e => {
            e.stopPropagation()
            onExpand()
          }}
        >
          ↕ Expand
        </button>
      )}
    </div>
  )
})

export default OverflowIndicator
