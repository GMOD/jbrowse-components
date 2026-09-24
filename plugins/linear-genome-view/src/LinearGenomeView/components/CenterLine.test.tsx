import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, screen, waitFor } from '@testing-library/react'

import CenterLine from './CenterLine.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function region(start: number, end: number) {
  return { refName: 'ctgA', start, end, assemblyName: 'volMyt1' }
}

// An odd width puts the center half a base into a column, clear of the
// boundary between two bases.
async function setup(displayedRegions: ReturnType<typeof region>[]) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 10_000,
            seq: 'cattgttgcg'.repeat(1000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'genes',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addView('LinearGenomeView', {
    id: 'lgv-center-line',
    bpPerPx: 1,
    displayedRegions,
  })
  const model = session.views[0] as LinearGenomeViewModel
  model.setWidth(801)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  model.showTrack('genes')
  model.scrollTo(0)
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CenterLine model={model} />
    </ThemeProvider>,
  )
  return model
}

async function label() {
  return (await screen.findByTestId('centerline_text')).textContent
}

test('labels the base under the center line', async () => {
  await setup([region(0, 10_000)])
  expect(await label()).toBe('ctgA: 401')
})

test('a flipped view labels the same base it did before the flip', async () => {
  const model = await setup([region(0, 10_000)])
  model.horizontallyFlip()
  expect(await label()).toBe('ctgA: 401')
})

test('a region that does not start at 0 labels its own coordinate', async () => {
  const model = await setup([region(1000, 2000), region(5000, 6000)])
  expect(await label()).toBe('ctgA: 1,401')
  model.scrollTo(1000)
  await waitFor(async () => {
    expect(await label()).toBe('ctgA: 5,401')
  })
})
