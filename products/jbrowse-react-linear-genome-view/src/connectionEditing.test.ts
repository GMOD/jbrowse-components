import { isSessionModelWithConnectionEditing } from '@jbrowse/core/util'

import createViewState from './createViewState.ts'

import type { HierarchicalTrackSelectorModel } from '@jbrowse/plugin-data-management'

// The track selector offers "Add connection" wherever this guard passes, so the
// embedded config has to hold the connection it then adds.
test('an embedded session adds and deletes a connection in its config', () => {
  const { session } = createViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  })
  expect(isSessionModelWithConnectionEditing(session)).toBe(true)

  const conf = session.addConnectionConf({
    type: 'UCSCTrackHubConnection',
    connectionId: 'hub',
    name: 'hub',
  })
  expect(session.jbrowse.connections.map(c => c.connectionId)).toEqual(['hub'])

  session.deleteConnection(conf)
  expect(session.jbrowse.connections).toHaveLength(0)
})

test('the track selector offers to delete a connection an embedded session added', () => {
  const { session } = createViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  })
  const conf = session.addConnectionConf({
    type: 'UCSCTrackHubConnection',
    connectionId: 'hub',
    name: 'hub',
  })
  const selector =
    session.view.activateTrackSelector() as HierarchicalTrackSelectorModel

  expect(selector.removableConnection('connection-hub')).toBe(conf)
  expect(selector.removableConnection('Tracks')).toBeUndefined()
})
