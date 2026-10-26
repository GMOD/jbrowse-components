import { getContrastText, resolvePalette } from '@jbrowse/core/ui/palette'

import { buildBaseCssMap } from '../../features/mismatch/baseColors.ts'
import { buildColorPaletteFromPalette } from './alignmentComponentUtils.ts'
import { drawAlignmentLabels } from './drawAlignmentLabels.ts'

import type { VisibleLabel } from './computeVisibleLabels.ts'

// The fill each letter was drawn with
function fillsOf(labels: VisibleLabel[]) {
  const palette = resolvePalette()
  const baseColors = {
    colors: buildColorPaletteFromPalette(palette),
    showModifications: false,
  }
  const fills = new Map<string, unknown>()
  const ctx: Parameters<typeof drawAlignmentLabels>[0] = {
    fillStyle: '',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    fillText(text: string) {
      fills.set(text, this.fillStyle)
    },
  }
  drawAlignmentLabels(ctx, labels, baseColors, palette)
  return { fills, box: buildBaseCssMap(baseColors) }
}

function mismatch(text: string): VisibleLabel {
  return {
    type: 'mismatch',
    text,
    x: 0,
    y: 0,
    font: '10px sans-serif',
    opacity: 1,
  }
}

// The lookup listed A/C/G/T alone, so N and an IUPAC code fell back to black
// over N's dark box, where white reads at twice the contrast
test('a mismatch letter takes the contrast of the box under it', () => {
  const { fills, box } = fillsOf(['A', 'N', 'R'].map(mismatch))
  for (const base of ['A', 'N', 'R']) {
    expect(fills.get(base)).toBe(getContrastText(box[base.charCodeAt(0)]!))
  }
  expect(fills.get('N')).toBe('#fff')
})
