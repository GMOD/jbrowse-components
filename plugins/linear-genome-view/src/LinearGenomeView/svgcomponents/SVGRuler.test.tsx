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
          configuration: {},
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
