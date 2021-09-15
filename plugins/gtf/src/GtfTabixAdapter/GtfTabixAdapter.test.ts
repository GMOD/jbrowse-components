import configSchema from './configSchema'
import GtfTabixAdapter from './GtfTabixAdapter'
import path from 'path'

test('adapter can fetch variants form demo.gtf', async () => {
  const adapter = new GtfTabixAdapter(
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
  // console.log(adapter)
})
