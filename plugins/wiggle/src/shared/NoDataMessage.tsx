// Centered overlay shown when a wiggle fetch completed but returned no
// features, so an empty region reads as "no data" instead of a flat score-0
// baseline that looks like real measured data.
export default function NoDataMessage({
  width,
  height,
  message = 'No data in this region',
}: {
  width: number
  height: number
  message?: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        color: '#888',
        fontStyle: 'italic',
      }}
    >
      {message}
    </div>
  )
}
