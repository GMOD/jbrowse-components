import JBrowse from '../../JBrowse'

import configSchemaFactory from './configSchema'

const jbrowse = new JBrowse().configure()

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(jbrowse)
  const config = configSchema.create({
    type: 'AlignmentsTrack',
    name: 'Zonker Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
