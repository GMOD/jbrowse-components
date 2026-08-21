import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import HierarchicalTree from './HierarchicalTree.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const VIEWPORT = 100

function setup(trackCount: number) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  for (let i = 0; i < trackCount; i++) {
    session.addSessionTrackConf({
      trackId: `track${i}`,
      // only one track matches a "zzz" filter, so filtering shrinks the tree
      // below the viewport height
      name: i === 0 ? 'zzz unique' : `track ${i}`,
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
  }
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTree height={VIEWPORT} model={model} />
    </ThemeProvider>,
  )
  return { model, ...utils }
}

// The scroll container is the tree's own root div; jsdom reports 0 for
// scrollTop, so drive it explicitly the way a browser would.
function scrollTo(container: HTMLElement, top: number) {
  Object.defineProperty(container, 'scrollTop', {
    value: top,
    writable: true,
    configurable: true,
  })
  fireEvent.scroll(container)
}

test('a filter that shrinks then restores the tree leaves the top rendered', () => {
  const { model, container } = setup(200)
  const scroller = container.querySelector('div')!

  // scroll near the bottom of the full list
  act(() => {
    scrollTo(scroller, model.treeHeight - VIEWPORT)
  })
  expect(container.textContent).not.toContain('zzz unique')

  // filter down to a single track: the tree is now shorter than the viewport,
  // so the browser pins the real scrollTop to 0
  act(() => {
    model.setFilterText('zzz')
  })
  act(() => {
    scrollTo(scroller, 0)
  })
  expect(container.textContent).toContain('zzz unique')

  // clearing the filter restores the full list. The DOM is still scrolled to
  // the top, so the rendered window must be too
  act(() => {
    model.clearFilterText()
  })
  expect(container.textContent).toContain('zzz unique')
})
