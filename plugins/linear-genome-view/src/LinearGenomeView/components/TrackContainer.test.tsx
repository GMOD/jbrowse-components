import { createJBrowseTheme } from '@jbrowse/core/ui'
import { colord } from '@jbrowse/core/util/colord'
import { getRoot, onAction } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, waitFor } from '@testing-library/react'

import { RESIZE_HANDLE_HEIGHT } from '../consts.ts'
import LinearGenomeView from './LinearGenomeView.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          ],
          tracks: [],
          configuration: {},
        },
      ],
    },
  }) as any
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
            end: 1000,
            seq: 'A'.repeat(1000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: {
      type: 'FromConfigAdapter',
      features: [{ refName: 'ctgA', uniqueId: 'f1', start: 10, end: 100 }],
    },
  })
  const model = session.views[0]
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  model.showTrack('genes')
  return model
}

/**
 * The divider at the bottom of a track is invisible until the pointer is over
 * it: a line drawn under every track read as a band of its own down the view.
 * What has to survive is the rest of the arrangement — it still occupies its
 * RESIZE_HANDLE_HEIGHT of space, so there is something to hit, and it still
 * reveals itself under the pointer, so the height reads as draggable at all.
 *
 * The `bar` word at this call site has been dropped once by accident, in a
 * commit titled "Update snaps", and the suite stayed green for two months:
 * everything else asserted about this handle is about the drag gesture, which
 * works whether or not you can see what to drag.
 */
function hoverBackgrounds(el: Element) {
  const selectors = [...el.classList].map(c => `.${c}`)
  const out: string[] = []
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        'selectorText' in rule &&
        'style' in rule &&
        (rule as CSSStyleRule).selectorText.includes(':hover') &&
        selectors.some(s => (rule as CSSStyleRule).selectorText.includes(s)) &&
        (rule as CSSStyleRule).style.background
      ) {
        out.push((rule as CSSStyleRule).style.background)
      }
    }
  }
  return out
}

test('the track resize divider is transparent at rest, visible on hover', async () => {
  const model = await setup()
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeView model={model} />
    </ThemeProvider>,
  )

  const handles = await waitFor(() => {
    const found = [...container.querySelectorAll('div')].filter(
      el => getComputedStyle(el).cursor === 'row-resize',
    )
    expect(found.length).toBeGreaterThan(0)
    return found
  })

  for (const handle of handles) {
    const { backgroundColor, height } = getComputedStyle(handle)
    expect(colord(backgroundColor).alpha()).toBe(0)
    expect(height).toBe(`${RESIZE_HANDLE_HEIGHT}px`)
    const hovered = hoverBackgrounds(handle)
    expect(hovered.length).toBeGreaterThan(0)
    for (const background of hovered) {
      expect(colord(background).alpha()).toBeGreaterThan(0)
    }
  }
}, 20000)

// The expand itself is pinned on the mixin (TrackHeightMixin.test.ts, which
// can give a display real hidden content); what this one is for is the wiring —
// the handle's own drag gesture calls `preventDefault` on the pointerdown, and
// a dblclick that no longer arrives would leave the model's action correct and
// unreachable.
test('double-clicking the divider asks the display to expand', async () => {
  const model = await setup()
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeView model={model} />
    </ThemeProvider>,
  )

  const handle = await waitFor(() => {
    const found = [...container.querySelectorAll('div')].find(
      el => getComputedStyle(el).cursor === 'row-resize',
    )
    expect(found).toBeTruthy()
    return found!
  })

  const display = model.tracks[0]!.displays[0]!
  const calls: string[] = []
  // on the root: MST warns that a listener lower down misses actions initiated
  // above it, and the display is not a root
  const dispose = onAction(getRoot(display), call => {
    calls.push(call.name)
  })

  fireEvent.doubleClick(handle)
  dispose()

  expect(calls).toContain('expandToContentHeight')
}, 20000)
