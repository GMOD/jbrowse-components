const Crosshairs = ({
  width,
  height,
  mouseX,
  mouseY,
  top = 0,
  zIndex,
  // The vertical (genomic-position) guide is dropped when the cursor is left of
  // this, e.g. over a tree sidebar where it has no meaning and clutters the
  // resize handle. The horizontal row guide is kept.
  minLeft = 0,
}: {
  width: number
  height: number
  mouseX: number
  // Omit for a vertical-only guide. The single-source score plots do that: their
  // y is a value axis they already draw gridlines on, so a second horizontal
  // line at the cursor reads as another threshold.
  mouseY?: number
  top?: number
  zIndex?: number
  minLeft?: number
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
    {mouseY === undefined ? null : (
      <line x1={0} x2={width} y1={mouseY} y2={mouseY} stroke="currentColor" />
    )}
    {mouseX >= minLeft ? (
      <line x1={mouseX} x2={mouseX} y1={0} y2={height} stroke="currentColor" />
    ) : null}
  </svg>
)

export default Crosshairs
