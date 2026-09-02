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
// implements displayTypeDefaultChanges) plus its track selector, so the badge runs
// against real display models.
async function openTrackSelector() {
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
  session.addSessionTrackConf({
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
  await view.launchTrack('genes')
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  return { session, view, model }
}

describe('OverrideBadge session-default awareness', () => {
  it('shows no badge when no session default affects the track', async () => {
    const { model } = await openTrackSelector()
    const { findAllByTestId, queryByTestId } = render(
      theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
    )
    await findAllByTestId(/htsTrackLabel/)
    expect(queryByTestId('track_session_default_badge')).toBeNull()
    expect(queryByTestId('track_edited_badge')).toBeNull()
  })

  it('badges an open track affected by a session-wide default and queues the dialog', async () => {
    const { session, model } = await openTrackSelector()
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'subfeatureLabels',
      'below',
    )

    const { findByTestId } = render(
      theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
    )
    const badge = await findByTestId('track_session_default_badge')
    expect(session.DialogComponent).toBeUndefined()

    fireEvent.click(badge)
    // clicking queues the changes dialog (rendered by the app-level dialog host)
    expect(session.DialogComponent).toBe(TrackSettingsChangesDialog)
  })

  it('clears only the session defaults the dialog listed', async () => {
    const { session, model } = await openTrackSelector()
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'subfeatureLabels',
      'below',
    )
    // promoted to the slot's own promotedBase, so it moves this track off
    // nothing and shows up in no row — but it still governs sibling tracks, so
    // clearing it from a dialog that never named it would change tracks other
    // than this one
    session.setDisplayTypeDefault('LinearBasicDisplay', 'displayMode', 'normal')

    const { findByTestId } = render(
      theme(<HierarchicalTrackSelector model={model} toolbarHeight={20} />),
    )
    fireEvent.click(await findByTestId('track_session_default_badge'))

    const { displayTypeDefaults, onClearDefaults } =
      session.DialogProps as unknown as {
        displayTypeDefaults: { path: string[] }[]
        onClearDefaults: () => void
      }
    // display-type-addressed, like the edited-on-this-track rows beside them —
    // and the reason the two tables can't collide on a shared slot name
    expect(displayTypeDefaults.map(c => c.path.join('.'))).toEqual([
      'LinearBasicDisplay.subfeatureLabels',
    ])

    onClearDefaults()
    expect(
      session.getDisplayTypeDefault('LinearBasicDisplay', 'subfeatureLabels'),
    ).toBeUndefined()
    expect(
      session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
    ).toBe('normal')
  })
})

describe('TrackSettingsChangesDialog session-default section', () => {
  it('renders session defaults separately and clears them via the button', () => {
    const cleared = jest.fn()
    const { getByText, queryByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[]}
          displayTypeDefaults={[
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
    expect(getByText(/Session-wide default/)).toBeTruthy()
    expect(getByText('compact')).toBeTruthy()
    // no per-track edit section / reset button when there are no edits
    expect(queryByText('Reset to default')).toBeNull()

    fireEvent.click(getByText('Clear session default'))
    expect(cleared).toHaveBeenCalledTimes(1)
  })

  it('renders a frozen {type} value (e.g. colorBy) as its bare type, not JSON', () => {
    const { getByText, queryByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[]}
          displayTypeDefaults={[
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

  it('renders a per-track edit separately from a session default and wires both resets', () => {
    const reset = jest.fn()
    const cleared = jest.fn()
    const { getByText, getAllByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[{ path: ['name'], from: 'Genes', to: 'My genes' }]}
          displayTypeDefaults={[
            { path: ['displayMode'], from: 'normal', to: 'compact' },
          ]}
          trackName="Genes"
          onReset={() => {
            reset()
          }}
          onClearDefaults={() => {
            cleared()
          }}
          handleClose={() => {}}
        />,
      ),
    )
    // both sources are surfaced, in their own framing
    expect(getByText(/Edited on this track/)).toBeTruthy()
    expect(getByText(/Session-wide default/)).toBeTruthy()
    expect(getByText('My genes')).toBeTruthy()
    expect(getByText('compact')).toBeTruthy()
    // each source has its own reset that fires independently
    expect(getAllByText('Default')).toHaveLength(2)
    fireEvent.click(getByText('Reset to default'))
    fireEvent.click(getByText('Clear session default'))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(cleared).toHaveBeenCalledTimes(1)
  })

  it('shows only the per-track edit section when no session default applies', () => {
    const { getByText, queryByText } = render(
      theme(
        <TrackSettingsChangesDialog
          changes={[{ path: ['name'], from: 'Genes', to: 'My genes' }]}
          trackName="Genes"
          onReset={() => {}}
          handleClose={() => {}}
        />,
      ),
    )
    expect(getByText(/Edited on this track/)).toBeTruthy()
    expect(getByText('Reset to default')).toBeTruthy()
    expect(queryByText(/Session-wide default/)).toBeNull()
    expect(queryByText('Clear session default')).toBeNull()
  })
})
