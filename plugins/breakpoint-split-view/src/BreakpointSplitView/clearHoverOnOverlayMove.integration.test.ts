import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: ['ctgA', 'ctgB'].map(refName => ({
        refName,
        uniqueId: `volvox-${refName}`,
        start: 0,
        end: 100_000,
        seq: 'a'.repeat(100_000),
      })),
    },
  },
}

const hit = { trackId: 'someTrack', id: 'feat1-feat2' }

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  const view = (await session.launchView('BreakpointSplitView', {
    views: [
      { assembly: 'volvox', loc: 'ctgA:1-10000' },
      { assembly: 'volvox', loc: 'ctgB:1-10000' },
    ],
  })) as unknown as BreakpointViewModel
  view.setWidth(800)
  await when(() => view.initialized)
  return view
}

// The overlay is one SVG over every row, and a row moving under a stationary
// cursor fires no pointer event — so the pointer handlers cannot be the only
// thing that clears the hover. Each case below moves the picture without a
// pointer, which is what `overlayTransformKey` exists to notice.
test('a pan clears the overlay hover', async () => {
  const view = await setup()
  view.setHoveredOverlay(hit)

  view.views[0]!.horizontalScroll(100)

  expect(view.hoveredOverlay).toBeUndefined()
})

// Zooming IN, and asserting it landed: the row displays one 10kb region over
// 800px, so it is already at `maxBpPerPx` and a zoom out clamps back to where
// it started — a no-op the hover is right not to react to, and one that would
// leave this test passing over a key that watched nothing.
test('a zoom clears the overlay hover', async () => {
  const view = await setup()
  const lgv = view.views[0]!
  const before = lgv.bpPerPx
  view.setHoveredOverlay(hit)

  lgv.zoomTo(before / 4)

  expect(lgv.bpPerPx).toBeLessThan(before)
  expect(view.hoveredOverlay).toBeUndefined()
})

// The second row, because a hover on a cross-row connector is anchored to a
// curve both rows position, and only row 0 used to be reachable from the
// wheel listener that stood here.
test('a pan of the second row clears it too', async () => {
  const view = await setup()
  view.setHoveredOverlay(hit)

  view.views[1]!.horizontalScroll(100)

  expect(view.hoveredOverlay).toBeUndefined()
})

// The negative that keeps the key honest: it watches what moves the picture,
// not every write to the view. A settings toggle redraws the same curves in the
// same places, and dropping the hover for it would read as a flicker.
test('a setting that moves nothing leaves the hover alone', async () => {
  const view = await setup()
  view.setHoveredOverlay(hit)

  view.setShowIntraviewLinks(!view.showIntraviewLinks)

  expect(view.hoveredOverlay).toEqual(hit)
})

function featureTrack(trackId: string, type = 'FeatureTrack') {
  return {
    trackId,
    type,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        { uniqueId: `${trackId}1`, refName: 'ctgA', start: 10, end: 20 },
      ],
    },
  }
}

// A track above the overlay's pushes the overlay down; one below it in the last
// row moves nothing the overlay draws on.
test('a track above the overlay track growing clears it, one below does not', async () => {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  for (const conf of [
    featureTrack('above'),
    featureTrack('calls', 'VariantTrack'),
    featureTrack('below'),
  ]) {
    session.addSessionTrackConf(conf)
  }
  const view = (await session.launchView('BreakpointSplitView', {
    views: [
      { assembly: 'volvox', loc: 'ctgA:1-10000', tracks: ['calls'] },
      {
        assembly: 'volvox',
        loc: 'ctgB:1-10000',
        tracks: ['above', 'calls', 'below'],
      },
    ],
  })) as unknown as BreakpointViewModel
  view.setWidth(800)
  await when(() => view.initialized && view.overlayTracks.length === 1)
  const display = (level: number, trackId: string) =>
    view.views[level]!.getTrack(trackId)!.displays[0]! as {
      height: number
      setHeight: (n: number) => void
    }

  view.setHoveredOverlay(hit)
  display(1, 'below').setHeight(display(1, 'below').height + 50)
  expect(view.hoveredOverlay).toEqual(hit)

  display(1, 'above').setHeight(display(1, 'above').height + 50)
  expect(view.hoveredOverlay).toBeUndefined()
}, 30000)
