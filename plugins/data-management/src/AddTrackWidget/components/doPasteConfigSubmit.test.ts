import { createTestSession } from '@jbrowse/web/testUtils'

import { doPasteConfigSubmit } from './doPasteConfigSubmit.ts'

import type { AddTrackModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// a view's `tracks` is loosely typed, so the track is annotated rather than cast
const openTrackIds = (view: {
  tracks: { configuration: { trackId: string } }[]
}) => view.tracks.map(t => t.configuration.trackId)

function trackConf(trackId: string, assemblyName = 'volMyt1') {
  return {
    trackId,
    name: trackId,
    type: 'FeatureTrack',
    assemblyNames: [assemblyName],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  }) as AddTrackModel
  return { session, view, widget }
}

test('adds a single pasted config and shows it on the view', async () => {
  const { session, view, widget } = setup()
  await doPasteConfigSubmit({
    model: widget,
    jsonText: JSON.stringify(trackConf('pasted1')),
  })
  expect(session.getTrackById('pasted1')).toBeTruthy()
  expect(openTrackIds(view)).toEqual(['pasted1'])
})

test('adds every config in a pasted array', async () => {
  const { session, view, widget } = setup()
  await doPasteConfigSubmit({
    model: widget,
    jsonText: JSON.stringify([trackConf('pasted1'), trackConf('pasted2')]),
  })
  expect(session.getTrackById('pasted1')).toBeTruthy()
  expect(session.getTrackById('pasted2')).toBeTruthy()
  expect(openTrackIds(view).toSorted()).toEqual(['pasted1', 'pasted2'])
})

// addTrackConf silently returns the existing track on a trackId collision, so
// pasting a config that reuses an id would otherwise be a confusing no-op
test('rejects a config reusing an existing trackId, adding nothing', async () => {
  const { session, widget } = setup()
  session.addSessionTrackConf(trackConf('taken'))
  await expect(
    doPasteConfigSubmit({
      model: widget,
      jsonText: JSON.stringify([trackConf('taken'), trackConf('fresh')]),
    }),
  ).rejects.toThrow(/already exists/)
  // the whole paste is refused up front, so the valid sibling is not added
  expect(session.getTrackById('fresh')).toBeUndefined()
})

test('reports unparseable JSON', async () => {
  const { widget } = setup()
  await expect(
    doPasteConfigSubmit({ model: widget, jsonText: '{not json' }),
  ).rejects.toThrow(/Could not parse JSON/)
})

test('reports a config missing trackId or type', async () => {
  const { widget } = setup()
  await expect(
    doPasteConfigSubmit({ model: widget, jsonText: '{"type":"FeatureTrack"}' }),
  ).rejects.toThrow(/missing a "trackId" string/)
  await expect(
    doPasteConfigSubmit({ model: widget, jsonText: '{"trackId":"x"}' }),
  ).rejects.toThrow(/missing a "type" string/)
})

// a track for an assembly the view isn't on is still added to the session; it
// just can't be opened here, and saying nothing looks like the paste failed
test('adds but does not show a track for an assembly the view is not on', async () => {
  const { session, view, widget } = setup()
  const notify = jest.fn()
  session.notify = notify
  await doPasteConfigSubmit({
    model: widget,
    jsonText: JSON.stringify(trackConf('otherAsm', 'someOtherAssembly')),
  })
  expect(session.getTrackById('otherAsm')).toBeTruthy()
  expect(view.tracks.length).toBe(0)
  expect(notify.mock.calls[0]?.[0]).toMatch(/not displayed/)
})

test('closes the widget after a successful paste', async () => {
  const { session, widget } = setup()
  await doPasteConfigSubmit({
    model: widget,
    jsonText: JSON.stringify(trackConf('pasted1')),
  })
  expect([...session.activeWidgets.keys()]).not.toContain('addTrackWidget')
})
