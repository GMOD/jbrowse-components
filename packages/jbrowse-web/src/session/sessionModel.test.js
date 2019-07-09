import { getSnapshot } from 'mobx-state-tree'
import { createTestSession } from '../jbrowseModel'

jest.mock('shortid', () => ({ generate: () => 'testid' }))

test('can load configuration with the configure() action and resolve references to view configurations', () => {
  const session = createTestSession({ configId: 'fogbat' })

  expect(getSnapshot(session.configuration)).toMatchSnapshot()
})

test('can load configuration from a config object', () => {
  const session = createTestSession({
    assemblies: [
      {
        assemblyName: 'volvox',
        sequence: {
          type: 'ReferenceSequenceTrack',
          adapter: {
            configId: 'Zd0NLmtxPZ3',
            type: 'FromConfigAdapter',
            features: [],
          },
        },
        aliases: ['vvx'],
      },
    ],
  })

  expect(getSnapshot(session.configuration)).toMatchSnapshot()
})

// TODO: figure out how to wait for an MST flow
xtest('can load configuration from a file', () => {
  const session = createTestSession({
    localPath: require.resolve('../../test_data/config_volvox.json'),
  })

  expect(getSnapshot(session.configuration)).toMatchSnapshot()
})
