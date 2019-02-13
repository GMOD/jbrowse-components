import { getSnapshot } from 'mobx-state-tree'
import JBrowse from './JBrowse'

jest.mock('shortid', () => ({ generate: 'testid' }))

test('can load configuration with the configure() action and resolve references to view configurations', async () => {
  const jbrowse = await new JBrowse().configure()
  const { model } = jbrowse
  model.configure({ configId: 'fogbat' })

  expect(getSnapshot(model.configuration)).toMatchSnapshot()
})

test('can load configuration from a config object', async () => {
  const jbrowse = await new JBrowse().configure({
    assemblies: {
      volvox: {
        aliases: ['vvx'],
        seqNameAliases: {
          A: ['ctgA', 'contigA'],
          B: ['ctgB', 'contigB'],
        },
      },
    },
  })
  const { model } = jbrowse

  expect(getSnapshot(model.configuration)).toMatchSnapshot()
})

test('can load configuration from a file', async () => {
  const jbrowse = await new JBrowse().configure({
    localPath: require.resolve('../test_data/config.json'),
  })
  const { model } = jbrowse

  expect(getSnapshot(model.configuration)).toMatchSnapshot()
})
