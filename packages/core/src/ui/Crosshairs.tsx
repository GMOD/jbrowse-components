const Crosshairs = ({
  width,
  height,
  mouseX,
  mouseY,
  top = 0,
  zIndex,
}: {
  width: number
  height: number
  mouseX: number
  mouseY: number
  top?: number
  zIndex?: number
}) => (
  <svg
    style={{
      position: 'absolute',
      top,
      left: 0,
      width,
      height,
      pointerEvents: 'none',
      zIndex,
    }}
  >
    <line x1={0} x2={width} y1={mouseY} y2={mouseY} stroke="currentColor" />
    <line x1={mouseX} x2={mouseX} y1={0} y2={height} stroke="currentColor" />
  </svg>
)

export default Crosshairs
