import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import HierarchicalTrackSelector from '../HierarchicalTrackSelector.tsx'
import TrackSettingsChangesDialog from '../dialogs/TrackSettingsChangesDialog.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function theme(node: React.ReactNode) {
  return <ThemeProvider theme={createJBrowseTheme()}>{node}</ThemeProvider>
}

const genes = {
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['volMyt1'],
  type: 'FeatureTrack',
  adapter: { type: 'FromConfigAdapter', features: [] },
}

// A session with one open FeatureTrack plus its track selector, so the badge
// runs against real display models.
async function openTrackSelector(kind: 'session' | 'config' = 'session') {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  })
  if (kind === 'session') {
    session.addSessionTrackConf(genes)
  } else {
    session.jbrowse.addTrackConf(genes)
  }
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  await view.launchTrack('genes')
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  return { session, view, model }
}

describe('OverrideBadge', () => {
  it('shows no badge when the track has no per-track edit', async () => {
    const { model } = await openTrackSelector()
    const { findAllByTestId, queryByTestId } = render(
      theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
    )
    await findAllByTestId(/htsTrackLabel/)
    expect(queryByTestId('track_edited_badge')).toBeNull()
  })

  it.each(['session', 'config'] as const)(
    'badges an edited open %s track',
    async kind => {
      const { session, model } = await openTrackSelector(kind)
      session.updateTrackConfiguration({ ...genes, name: 'Edited' })
      const { findByTestId } = render(
        theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
      )
      expect(await findByTestId('track_edited_badge')).toBeTruthy()
    },
  )
})

describe('TrackSettingsChangesDialog', () => {
  it('renders a frozen {type} value (e.g. colorBy) as its bare type, not JSON', () => {
    const { getByText, queryByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[
            {
              path: ['colorBy'],
              from: { type: 'normal' },
              to: { type: 'methylation' },
            },
          ]}
          trackName="reads"
          handleClose={() => {}}
        />,
      ),
    )
    expect(getByText('methylation')).toBeTruthy()
    expect(getByText('normal')).toBeTruthy()
    expect(queryByText(/\{.*type.*\}/)).toBeNull()
  })

  it('lists the per-track edits and wires the reset', () => {
    const reset = jest.fn()
    const { getByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[{ path: ['name'], from: 'Genes', to: 'My genes' }]}
          trackName="Genes"
          onReset={() => {
            reset()
          }}
          handleClose={() => {}}
        />,
      ),
    )
    expect(getByText(/Edited on this track/)).toBeTruthy()
    expect(getByText('My genes')).toBeTruthy()
    fireEvent.click(getByText('Reset to default'))
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
