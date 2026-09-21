import PluginManager from '@jbrowse/core/PluginManager'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GWASAdapter from './GWASAdapter.ts'
import GWASAdapterConfigSchema from './configSchema.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const file = require.resolve('../../../../test_data/volvox/volvox.gwas.tsv.gz')

async function scores(scoreTransform: string) {
  const adapter = new GWASAdapter(
    GWASAdapterConfigSchema.create(
      {
        bedGzLocation: { localPath: file, locationType: 'LocalPathLocation' },
        index: {
          location: {
            localPath: `${file}.tbi`,
            locationType: 'LocalPathLocation',
          },
        },
        scoreTransform,
      },
      { pluginManager },
    ),
    undefined,
    pluginManager,
  )
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
  return features.map(f => f.get('score')!)
}

test('a jexl: scoreTransform is evaluated per score', async () => {
  const raw = await scores('none')
  expect(raw.length).toBeGreaterThan(0)
  expect(await scores('jexl:score * 10')).toEqual(raw.map(s => s * 10))
})
