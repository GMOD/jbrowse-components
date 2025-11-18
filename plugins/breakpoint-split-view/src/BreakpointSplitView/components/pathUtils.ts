export function getInteractivePathProps({
  interactiveOverlay,
  isHovered,
  strokeWidth = 5,
  hoverStrokeWidth = 10,
}: {
  interactiveOverlay?: boolean
  isHovered: boolean
  strokeWidth?: number
  hoverStrokeWidth?: number
}) {
  return {
    pointerEvents: interactiveOverlay ? ('auto' as const) : undefined,
    strokeWidth: isHovered ? hoverStrokeWidth : strokeWidth,
  }
}
