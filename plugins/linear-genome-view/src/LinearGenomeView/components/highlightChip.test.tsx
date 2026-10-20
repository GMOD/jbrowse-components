import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import TracksContainer from './TracksContainer.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assemblyConf = {
  name: 'volMyt1',
  sequence: {
    trackId: 'sequenceConfigId',
    type: 'ReferenceSequenceTrack',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 10_000,
          seq: 'cattgttgcg'.repeat(1000),
        },
      ],
    },
  },
}

// bpPerPx is 1 here, so the highlight below occupies px 100..200 of the tracks
// container. The narrow one is under CHIP_MIN_WIDTH, where the chip would clip
// into a smudge and the band draws alone.
const HIGHLIGHT = {
  refName: 'ctgA',
  start: 100,
  end: 200,
  assemblyName: 'volMyt1',
  label: 'a region',
}
const NARROW_HIGHLIGHT = { ...HIGHLIGHT, end: 110 }

async function setup(highlight: typeof HIGHLIGHT = HIGHLIGHT) {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', {
    id: 'lgv-highlight-chip',
    bpPerPx: 1,
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volMyt1' },
    ],
  })
  const model = session.views[0] as LinearGenomeViewModel
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  session.setHighlights([highlight])

  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <TracksContainer model={model}>{null}</TracksContainer>
    </ThemeProvider>,
  )
  return { model, session }
}

test('a band draws its chip with no pointer anywhere near it', async () => {
  await setup()
  expect(await screen.findByTestId('highlight-band')).toBeTruthy()
  expect(screen.queryByTestId('highlight-chip')).toBeTruthy()
})

test('a band narrower than its chip still draws it, beside the band', async () => {
  await setup(NARROW_HIGHLIGHT)
  expect(await screen.findByTestId('highlight-chip')).toBeTruthy()
})

// A codon at gene zoom is narrower than its label. The band clips what it
// holds, so the label sits beside it and runs past its right edge.
test("a band's label sits outside the band, which would clip it", async () => {
  await setup(NARROW_HIGHLIGHT)
  const label = await screen.findByText('a region')
  expect(screen.getByTestId('highlight-band').contains(label)).toBe(false)
})

test("the chip's Edit label names the session's highlight", async () => {
  const { session } = await setup()
  fireEvent.click(await screen.findByTestId('highlight-chip'))
  fireEvent.click(await screen.findByText('Edit label...'))
  const [Dialog, props] = session.queueOfDialogs[0]!
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Dialog {...props} />
    </ThemeProvider>,
  )
  fireEvent.change(screen.getByLabelText('Label'), {
    target: { value: '  E6V ' },
  })
  fireEvent.click(screen.getByText('Submit'))
  expect(session.highlights.map(h => h.label)).toEqual(['E6V'])
})
