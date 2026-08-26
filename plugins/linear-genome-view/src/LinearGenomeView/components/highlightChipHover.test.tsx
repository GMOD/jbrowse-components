import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
// container, and a clientX is a container x — jsdom measures every box as a
// zero rect, which puts the container's left edge at 0.
const HIGHLIGHT = {
  refName: 'ctgA',
  start: 100,
  end: 200,
  assemblyName: 'volMyt1',
  label: 'a region',
}
const INSIDE = 150
const OUTSIDE = 600

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', {
    id: 'lgv-highlight-hover',
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
  model.setHighlight([HIGHLIGHT])

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <TracksContainer model={model}>{null}</TracksContainer>
    </ThemeProvider>,
  )
  const tracksContainer = container.querySelector(
    '[data-testid="tracksContainer"]',
  )!
  return { model, container, tracksContainer }
}

// the tracked position is published in a frame, so give that frame back before
// asking what the band drew
async function movePointerTo(element: Element, clientX: number) {
  await act(async () => {
    fireEvent.mouseMove(element, { clientX, clientY: 10 })
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        resolve(undefined)
      })
    })
  })
}

// by test id rather than by role: an open menu is a modal, and MUI marks the
// rest of the app aria-hidden while it is up, which is exactly the moment this
// asks whether the chip is still there
function chip() {
  return screen.queryByTestId('highlight-chip')
}

test('a band reveals its chip while the pointer is in its column', async () => {
  const { tracksContainer } = await setup()
  expect(await screen.findByTestId('highlight-band')).toBeTruthy()
  expect(chip()).toBeNull()

  await movePointerTo(tracksContainer, INSIDE)
  expect(chip()).toBeTruthy()

  await movePointerTo(tracksContainer, OUTSIDE)
  expect(chip()).toBeNull()

  await movePointerTo(tracksContainer, INSIDE)
  expect(chip()).toBeTruthy()
  fireEvent.mouseLeave(tracksContainer)
  await waitFor(() => {
    expect(chip()).toBeNull()
  })
})

test('showHighlightChips pins the chip with no pointer anywhere near it', async () => {
  const { model } = await setup()
  expect(chip()).toBeNull()
  act(() => {
    model.setShowHighlightChips(true)
  })
  expect(chip()).toBeTruthy()
})

// The menu is portalled out of the band, so opening it moves the pointer off
// the column that revealed the chip. Unmounting the chip there would take the
// menu's own anchor with it, and the menu would close on the way to being read.
test('an open menu keeps its chip through a pointer that has left the band', async () => {
  const { tracksContainer } = await setup()
  await movePointerTo(tracksContainer, INSIDE)
  fireEvent.click(chip()!)
  expect(await screen.findByText('Dismiss highlight')).toBeTruthy()

  await movePointerTo(tracksContainer, OUTSIDE)
  expect(chip()).toBeTruthy()
  expect(screen.getByText('Dismiss highlight')).toBeTruthy()
})
