import {
  type FeatureLabelData,
  calculateFloatingLabelPosition,
} from '../components/util.ts'

interface Props {
  featureLabels: Map<string, FeatureLabelData>
  offsetPx: number
  viewWidth: number
}

export function SvgFloatingLabels({
  featureLabels,
  offsetPx,
  viewWidth,
}: Props) {
  const viewportLeft = Math.max(0, offsetPx)
  const elements: React.ReactElement[] = []

  for (const [
    key,
    { leftPx, topPx, totalFeatureHeight, floatingLabels, featureWidth },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureRightPx = leftPx + featureWidth

    for (const [
      i,
      { text, relativeY, color, textWidth, isOverlay },
    ] of floatingLabels.entries()) {
      const y = featureVisualBottom + relativeY
      const x = calculateFloatingLabelPosition(
        leftPx,
        featureRightPx,
        textWidth,
        offsetPx,
        viewportLeft,
      )

      if (x < 0 || x > viewWidth) {
        continue
      }

      const fontSize = 11
      elements.push(
        <g key={`${key}-${i}`} transform={`translate(${x}, ${y})`}>
          {isOverlay ? (
            <rect
              x={-1}
              y={0}
              width={textWidth + 2}
              height={fontSize + 1}
              fill="rgba(255, 255, 255, 0.8)"
            />
          ) : null}
          <text
            x={0}
            y={fontSize}
            fontSize={fontSize}
            fill={color}
            style={{ pointerEvents: 'none' }}
          >
            {text}
          </text>
        </g>,
      )
    }
  }

  return <>{elements}</>
}
