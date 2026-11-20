import { ExportFontFamilyContext } from '@jbrowse/core/svg/constants'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGRuler from './SVGRuler.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// A stacked export gives each row SVGRowHeader — assembly name, ruler, refName
// labels — and no locstring, so a flipped row's only evidence of being flipped
// was its numbers counting down. On screen the search box says `[rev]`; a
// figure has no search box. The marker rides the ruler's refName labels for
// exactly this reason, which makes `orientation` reaching SVGRuler the wiring
// this pins.

function rulerTexts(flip: boolean) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 800 },
          ],
          tracks: [],
        },
      ],
    },
  }) as any
  const model = session.views[0]
  model.setWidth(800)
  if (flip) {
    model.horizontallyFlip()
  }
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGRuler model={model} rulerHeight={30} />
      </svg>
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('text')].map(t => t.textContent)
}

test('a forward row exports its bare chromosome name and no caption', () => {
  const texts = rulerTexts(false)
  expect(texts).toContain('ctgA')
  expect(texts).not.toContain('[rev]')
})

test('a flipped row exports the row caption beside the name', () => {
  const texts = rulerTexts(true)
  // the marker is the row's, drawn as its own caption — a marker ON a name
  // would be the mixed case saying that one region is flipped
  expect(texts).toContain('[rev]')
  expect(texts).toContain('ctgA')
  expect(texts).not.toContain('ctgA [rev]')
})

function rulerTextsIn({
  fontFamily,
  ctgAEnd,
  offsetPx = 0,
}: {
  fontFamily?: string
  ctgAEnd: number
  offsetPx?: number
}) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: ctgAEnd },
            { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 800 },
          ],
          tracks: [],
        },
      ],
    },
  }) as any
  const model = session.views[0]
  model.setWidth(800)
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <ExportFontFamilyContext value={fontFamily}>
          <SVGRuler model={model} rulerHeight={30} />
        </ExportFontFamilyContext>
      </svg>
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('text')].map(t => t.textContent)
}

// A monospace face advances every glyph 0.6em, and the Helvetica table puts
// `ctgA` and `600` narrower, so measured there both pass a fit they fail as drawn

test('a chromosome name its run has no room for in the export font is dropped, not clipped', () => {
  // 'ctgA' in bold 11px: ~23px in Helvetica, 4 × 0.6 × 11 = 26.4px in monospace
  const names = (fontFamily?: string) =>
    rulerTextsIn({ fontFamily, ctgAEnd: 26 })
  expect(names(undefined)).toContain('ctgA')
  expect(names('monospace')).not.toContain('ctgA')
  expect(names('monospace')).toContain('ctgB')
})

test('a tick number at the right edge is dropped when the export font runs it past', () => {
  // '600' is centred at 788.5 of 800: half of 3 × 0.6 × 11 + 4 reaches 800.4
  // in monospace, 799.7 in Helvetica
  const numbers = (fontFamily?: string) =>
    rulerTextsIn({ fontFamily, ctgAEnd: 190, offsetPx: 0.5 })
  expect(numbers(undefined)).toContain('600')
  expect(numbers('monospace')).not.toContain('600')
  expect(numbers('monospace')).toContain('400')
})
