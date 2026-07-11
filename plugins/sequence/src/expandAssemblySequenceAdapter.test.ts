import PluginManager from '@jbrowse/core/PluginManager'
import { expandAssemblySequenceAdapter } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'

import ThisPlugin from './index.ts'

// exercises the real Core-guessAdapterForLocation guesser this plugin registers,
// so the assembly `sequence: { adapter: { uri } }` shorthand resolves to the
// right ReferenceSequenceTrack adapter without any adapter-type table in a host
function expand(sequence: unknown) {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return expandAssemblySequenceAdapter(sequence, pluginManager) as {
    adapter: Record<string, unknown>
  }
}

test('infers IndexedFastaAdapter from a .fa uri', () => {
  const { adapter } = expand({ adapter: { uri: 'https://x.test/volvox.fa' } })
  expect(adapter.type).toBe('IndexedFastaAdapter')
  expect(adapter.fastaLocation).toMatchObject({
    uri: 'https://x.test/volvox.fa',
  })
  expect(adapter.faiLocation).toMatchObject({
    uri: 'https://x.test/volvox.fa.fai',
  })
})

test('infers BgzipFastaAdapter (with .gzi) from a .fa.gz uri', () => {
  const { adapter } = expand({ adapter: { uri: 'https://x.test/hg38.fa.gz' } })
  expect(adapter.type).toBe('BgzipFastaAdapter')
  expect(adapter.gziLocation).toMatchObject({
    uri: 'https://x.test/hg38.fa.gz.gzi',
  })
})

test('infers TwoBitAdapter from a .2bit uri', () => {
  const { adapter } = expand({ adapter: { uri: 'https://x.test/hg38.2bit' } })
  expect(adapter.type).toBe('TwoBitAdapter')
  expect(adapter.twoBitLocation).toMatchObject({
    uri: 'https://x.test/hg38.2bit',
  })
})

test('an explicit non-sibling faiLocation overrides the guessed sibling', () => {
  const { adapter } = expand({
    adapter: {
      uri: 'https://x.test/volvox.fa',
      faiLocation: { uri: 'https://x.test/custom.fai' },
    },
  })
  expect(adapter.type).toBe('IndexedFastaAdapter')
  expect(adapter.faiLocation).toEqual({ uri: 'https://x.test/custom.fai' })
})

test('leaves a fully-typed adapter untouched (same reference)', () => {
  const sequence = {
    adapter: { type: 'TwoBitAdapter', uri: 'https://x.test/hg38.2bit' },
  }
  expect(expandAssemblySequenceAdapter(sequence, boot())).toBe(sequence)
})

test('leaves a uri matching no sequence adapter untouched', () => {
  const sequence = { adapter: { uri: 'https://x.test/reads.bam' } }
  expect(expandAssemblySequenceAdapter(sequence, boot())).toBe(sequence)
})

test('propagates baseUri onto the fasta location and its derived .fai/.gzi', () => {
  const { adapter } = expand({
    adapter: { uri: 'hg38.fa.gz', baseUri: 'https://x.test/sub/config.json' },
  })
  expect(adapter.type).toBe('BgzipFastaAdapter')
  expect(adapter.fastaLocation).toEqual({
    uri: 'hg38.fa.gz',
    locationType: 'UriLocation',
    baseUri: 'https://x.test/sub/config.json',
  })
  expect(adapter.faiLocation).toMatchObject({
    uri: 'hg38.fa.gz.fai',
    baseUri: 'https://x.test/sub/config.json',
  })
  expect(adapter.gziLocation).toMatchObject({
    uri: 'hg38.fa.gz.gzi',
    baseUri: 'https://x.test/sub/config.json',
  })
  // baseUri belongs on the locations, not stray at the adapter top level
  expect(adapter.baseUri).toBeUndefined()
})

function boot() {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}
