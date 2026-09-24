import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'

import Header from './Header.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const TOUCH_ONLY = 'not all and (any-pointer: fine)'

// jsdom has no matchMedia, so without this every render is the desktop header
function installPointer(touchOnly: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: query === TOUCH_ONLY && touchOnly,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

async function renderHeader() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 5000 },
          ],
          tracks: [],
        },
      ],
    },
  }) as {
    views: LinearGenomeViewModel[]
    addAssemblyConf: (conf: unknown) => void
  }
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 5000,
            seq: 'A'.repeat(5000),
          },
        ],
      },
    },
  })
  const model = session.views[0]!
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Header model={model} />
    </ThemeProvider>,
  )
}

test('a mouse gets the pan buttons and the scroll-zoom toggle', async () => {
  installPointer(false)
  const { getByLabelText, container } = await renderHeader()
  expect(getByLabelText('Pan left')).toBeTruthy()
  expect(container.querySelector('button[value="scrollZoom"]')).toBeTruthy()
})

// A swipe pans, and there is no wheel for the toggle to govern
test('a touch-only device gets neither', async () => {
  installPointer(true)
  const { queryByLabelText, container } = await renderHeader()
  expect(queryByLabelText('Pan left')).toBeNull()
  expect(container.querySelector('button[value="scrollZoom"]')).toBeNull()
})
