import { LEGEND_ROW_HEIGHT } from '@jbrowse/core/ui'
import { cleanup, render } from '@testing-library/react'

import { LD_LEGEND, LD_LEGEND_TITLE } from '../ldBins.ts'
import SvgLdLegend from './SvgLdLegend.tsx'

afterEach(cleanup)

function renderLegend(props: {
  maxHeight: number
  indexSnpMissing?: boolean
  indexSnpOffscreen?: boolean
}) {
  return render(
    <svg>
      <SvgLdLegend
        canvasWidth={800}
        indexSnpMissing={false}
        indexSnpOffscreen={false}
        {...props}
      />
    </svg>,
  )
}

test('a tall track shows the title and every r² bin', () => {
  const { getByText } = renderLegend({ maxHeight: 400 })
  getByText(LD_LEGEND_TITLE)
  for (const { label } of LD_LEGEND) {
    getByText(label)
  }
})

// The hand-rolled box this replaced was a fixed 116px tall and drew past the
// per-track clip rect in SVGTracks, so at the default 100px track height the
// bottom bins were cut through the middle of a swatch. Rows must stay inside
// maxHeight, with the remainder named rather than silently dropped.
test('a default-height track folds the overflow into a "+N more" row', () => {
  const { getByText, container } = renderLegend({ maxHeight: 95 })
  // every row, including the trailing summary, fits inside maxHeight
  const rows = container.querySelectorAll('svg > g > g')
  expect(rows.length * LEGEND_ROW_HEIGHT).toBeLessThanOrEqual(95)
  const total = LD_LEGEND.length + 1
  getByText(`+${total - (rows.length - 1)} more`)
})

test('a missing index SNP says why every point is grey', () => {
  const { getByText } = renderLegend({
    maxHeight: 400,
    indexSnpMissing: true,
    indexSnpOffscreen: false,
  })
  getByText('Index SNP not in LD data: all grey')
})

test('an off-screen index SNP names the benign case instead', () => {
  const { getByText } = renderLegend({
    maxHeight: 400,
    indexSnpMissing: true,
    indexSnpOffscreen: true,
  })
  getByText('Index SNP off-screen: all grey')
})
