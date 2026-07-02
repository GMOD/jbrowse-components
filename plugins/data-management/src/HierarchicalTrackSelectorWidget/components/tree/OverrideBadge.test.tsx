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

// A session with one open FeatureTrack (GPU LinearBasicDisplay, which
// implements sessionDefaultChanges) plus its track selector, so the badge runs
// against real display models.
function openTrackSelector() {
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
  session.addTrackConf({
    trackId: 'genes',
    name: 'Genes',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  view.showTrack('genes')
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  return { session, view, model }
}

describe('OverrideBadge session-default awareness', () => {
  it('shows no badge when no session default affects the track', async () => {
    const { model } = openTrackSelector()
    const { findAllByTestId, queryByTestId } = render(
      theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
    )
    await findAllByTestId(/htsTrackLabel/)
    expect(queryByTestId('track_session_default_badge')).toBeNull()
    expect(queryByTestId('track_edited_badge')).toBeNull()
  })

  it('badges an open track affected by a session-wide default and queues the dialog', async () => {
    const { session, model } = openTrackSelector()
    session.setDisplayTypeDefault('LinearBasicDisplay', 'displayMode', 'compact')

    const { findByTestId } = render(
      theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
    )
    const badge = await findByTestId('track_session_default_badge')
    expect(session.DialogComponent).toBeUndefined()

    fireEvent.click(badge)
    // clicking queues the changes dialog (rendered by the app-level dialog host)
    expect(session.DialogComponent).toBe(TrackSettingsChangesDialog)
  })
})

describe('TrackSettingsChangesDialog session-default section', () => {
  it('renders session defaults separately and clears them via the button', () => {
    const cleared = jest.fn()
    const { getByText, queryByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[]}
          sessionDefaults={[
            { path: ['displayMode'], from: 'normal', to: 'compact' },
          ]}
          trackName="Genes"
          onClearDefaults={() => {
            cleared()
          }}
          handleClose={() => {}}
        />,
      ),
    )
    // framed as a session-wide default, not an edit of this track
    expect(getByText(/session-wide default/)).toBeTruthy()
    expect(getByText('compact')).toBeTruthy()
    // no per-track edit section / reset button when there are no edits
    expect(queryByText('Reset to default')).toBeNull()

    fireEvent.click(getByText('Clear session default'))
    expect(cleared).toHaveBeenCalledTimes(1)
  })
})
