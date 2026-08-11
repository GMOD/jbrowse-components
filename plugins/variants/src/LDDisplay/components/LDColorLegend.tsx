import { GRADIENT_LEGEND_HEIGHT, GRADIENT_LEGEND_WIDTH } from '@jbrowse/core/ui'

import LDColorLegendContent from './LDColorLegendContent.tsx'

export default function LDColorLegend({
  ldMetric,
  signedLD = false,
  idSuffix,
}: {
  ldMetric: string
  signedLD?: boolean
  idSuffix: string
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: GRADIENT_LEGEND_WIDTH,
        height: GRADIENT_LEGEND_HEIGHT,
        zIndex: 10,
        overflow: 'visible',
      }}
      // A plain positioned box in the display's own tree, so unlike the portaled
      // chrome it gets no marker from the overlay node — it needs its own, or a
      // drag across the ramp's `0`/`R²`/`1` labels pans the view underneath
      // instead of selecting them (see `useSideScroll`).
      data-gesture-owner="true"
    >
      <LDColorLegendContent
        ldMetric={ldMetric}
        signedLD={signedLD}
        idSuffix={idSuffix}
      />
    </svg>
  )
}
