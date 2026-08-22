import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'

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
  await model.launchTrack('genes')
  return model
}

// WCAG 4.1.2, on the surface that is 95% of what is on screen. Every LGV display
// is mounted through TrackRenderingContainer, so the name and role live there
// once rather than in each display type — and the name has to carry the two
// things a canvas cannot say for itself: which track this is, and what part of
// the genome it is showing.
test('a track display carries a name and a role', async () => {
  const model = await setup()
  const { findByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeView model={model} />
    </ThemeProvider>,
  )

  const region = await findByRole('figure', { name: /Volvox genes/ })
  expect(region.getAttribute('aria-label')).toContain('Volvox genes')

  // ...and the "what is on screen" half, which arrives with the coarse blocks
  // the debounced autorun writes rather than per frame
  await waitFor(() => {
    expect(model.coarseVisibleLocStrings).toBeTruthy()
  })
  await waitFor(() => {
    expect(region.getAttribute('aria-label')).toContain(
      model.coarseVisibleLocStrings,
    )
  })
}, 20000)
