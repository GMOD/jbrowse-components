import { resolvePalette } from '@jbrowse/core/ui/palette'

import { getMafColorPalette } from '../util.ts'
import { drawMafDeletionLabels } from './deletions.ts'

import type { DeletionMarker } from '../../LinearMafDisplay/components/computeVisibleDeletions.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function mockCtx() {
  const texts: { text: string; fillStyle: string }[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillText(text: string) {
      texts.push({ text, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, texts }
}

// Wide and tall enough to clear both the `measureText` and MIN_HEIGHT_FOR_TEXT
// gates, so the label actually draws.
const marker: DeletionMarker = {
  xLeft: 100,
  width: 80,
  rowTop: 20,
  h: 12,
  length: 42,
}

function draw(mode: 'light' | 'dark') {
  const { ctx, texts } = mockCtx()
  drawMafDeletionLabels(
    ctx,
    [marker],
    getMafColorPalette(resolvePalette({ configTheme: { palette: { mode } } })),
  )
  return texts
}

// The gap cells the count sits on are filled with `palette.gapColor`, which is
// `palette.deletion` — and that is the one MAF cell color with a dark-mode
// override, lightened from #808080 to #c8c8c8 so the run reads against a dark
// track. A hardcoded white count was therefore invisible on every dark-mode MAF
// (and on every dark-theme SVG export, whatever the session's own theme).
test('the deleted-base count reads against the run it sits in, in both themes', () => {
  expect(draw('light')).toEqual([{ text: '42', fillStyle: '#fff' }])
  expect(draw('dark')).toEqual([
    { text: '42', fillStyle: 'rgba(0, 0, 0, 0.87)' },
  ])
})

// The two gates the label is subject to, kept here so a geometry change can't
// silently stop the color above from ever being exercised.
test('draws nothing where the run is too short or too narrow for the text', () => {
  const { ctx, texts } = mockCtx()
  const palette = getMafColorPalette(resolvePalette())
  drawMafDeletionLabels(ctx, [{ ...marker, h: 2 }], palette)
  drawMafDeletionLabels(ctx, [{ ...marker, width: 1 }], palette)
  expect(texts).toEqual([])
})
