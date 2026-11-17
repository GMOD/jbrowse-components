import PluginManager from '../PluginManager.ts'
import { bamIndexSchema } from './bamIndexFields.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { fileLocationSlots } from './fileLocationSlots.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const adapterSchema = ConfigurationSchema('TestBamAdapter', {
  bamLocation: {
    type: 'fileLocation',
    defaultValue: { uri: '/path/to/my.bam', locationType: 'UriLocation' },
  },
  index: bamIndexSchema(),
  fetchSizeLimit: { type: 'number', defaultValue: 5_000_000 },
  subadapters: { type: 'frozen', defaultValue: {} },
})

test('lists the main and index locations by path, and writes through them', () => {
  const adapter = adapterSchema.create(
    {
      bamLocation: { uri: 'reads.bam', locationType: 'UriLocation' },
      index: {
        location: { uri: 'reads.bam.bai', locationType: 'UriLocation' },
      },
      subadapters: {
        bigWigLocation: { uri: 'cov.bw', locationType: 'UriLocation' },
      },
    },
    { pluginManager },
  )
  const slots = fileLocationSlots(adapter)
  expect(slots.map(s => s.path)).toEqual([
    ['bamLocation'],
    ['index', 'location'],
  ])
  expect(slots.map(s => s.slot.value)).toEqual([
    { uri: 'reads.bam', locationType: 'UriLocation' },
    { uri: 'reads.bam.bai', locationType: 'UriLocation' },
  ])

  slots[1]!.slot.set({
    uri: 'moved/reads.bam.bai',
    locationType: 'UriLocation',
  })
  expect(adapter.index.location).toEqual({
    uri: 'moved/reads.bam.bai',
    locationType: 'UriLocation',
  })
})
