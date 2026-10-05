import { setConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { AboutDialog } from '@jbrowse/product-core'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { createViewState } from './index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const TRACK_ID = 'testtrack'
const DISPLAY_ID = `${TRACK_ID}-LinearBasicDisplay`

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'f',
          start: 0,
          end: 10,
          seq: 'cattgttgcg',
        },
      ],
    },
  },
}

const track = {
  type: 'FeatureTrack',
  trackId: TRACK_ID,
  name: 'Track',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
  textSearching: { indexingAttributes: ['Name'] },
}

const writeText = jest.fn<Promise<void>, [string]>(async () => {})

beforeAll(() => {
  Object.defineProperty(window, 'isSecureContext', { value: true })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText } })
})

afterEach(() => {
  cleanup()
  writeText.mockClear()
})

async function editedColor() {
  const state = createViewState({ assembly, tracks: [track] })
  const { view } = state.session
  await view.launchTrack(TRACK_ID)
  await waitFor(() => {
    expect(view.getTrack(TRACK_ID)).toBeTruthy()
  })
  const shown = view.getTrack(TRACK_ID)
  setConf(shown.displays[0], 'color', 'rgb(1,2,3)')
  return { session: state.session, shown }
}

function copyConfig(
  session: Parameters<typeof AboutDialog>[0]['session'],
  config: Parameters<typeof AboutDialog>[0]['config'],
) {
  const { getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AboutDialog session={session} config={config} handleClose={() => {}} />
    </ThemeProvider>,
  )
  fireEvent.click(getByText('Copy config'))
  expect(writeText).toHaveBeenCalledTimes(1)
  return JSON.parse(writeText.mock.calls[0]![0]) as {
    displays: { displayId: string; color?: { value: string } }[]
    textSearching?: { indexingAttributes?: string[] }
  }
}

function expectEditedWhole(copied: ReturnType<typeof copyConfig>) {
  const display = copied.displays.find(d => d.displayId === DISPLAY_ID)
  expect(display?.color?.value).toBe('rgb(1,2,3)')
  expect(copied.textSearching?.indexingAttributes).toEqual(['Name'])
}

describe('Copy config in the About dialog after a display edit', () => {
  test('from the in-view track label', async () => {
    const { session, shown } = await editedColor()
    expectEditedWhole(copyConfig(session, shown.configuration))
  })

  test('from the track selector', async () => {
    const { session } = await editedColor()
    const entry = () => session.tracks.find(t => t.trackId === TRACK_ID)!
    await waitFor(() => {
      expect(JSON.stringify(entry())).toContain('rgb(1,2,3)')
    })
    expectEditedWhole(copyConfig(session, entry()))
  })
})
