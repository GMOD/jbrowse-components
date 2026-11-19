import PluginManager from '@jbrowse/core/PluginManager'
import { expandAssemblySequenceAdapter } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'

import ThisPlugin from '../index.ts'

function expand(uri: string) {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return expandAssemblySequenceAdapter({ adapter: { uri } }, pluginManager)
}

test.each(['https://x.test/pUC19.gbk', 'https://x.test/genomic.gbff.gz'])(
  'an assembly given %s reads its sequence, not its features',
  uri => {
    expect(expand(uri)).toMatchObject({
      adapter: { type: 'GenbankSequenceAdapter', genbankLocation: { uri } },
    })
  },
)
