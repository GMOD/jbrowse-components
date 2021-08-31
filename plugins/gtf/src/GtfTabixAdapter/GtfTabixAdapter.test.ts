import configSchema from './configSchema'
import Adapter from './GtfTabixAdapter'
import path from 'path'

test('adapter can fetch variants form demo.gtf', async () => {
  const adapter = new Adapter(
    configSchema.create({
      gtfGzLocation: {
        localPath: path.join(
          __dirname,
          '..',
          '..',
          '..',
          'test_data',
          'demo.gtf',
        ),
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: path.join(
            __dirname,
            '..',
            '..',
            '..',
            'test_data',
            'demo.gtf.tbi',
          ),
        },
      },
    }),
  )
})
