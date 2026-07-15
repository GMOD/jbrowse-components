import { readConfObject } from '@jbrowse/core/configuration'

import { createTestSession } from '../rootModel/index.ts'

jest.mock('../makeWorkerInstance', () => () => {})

function adapterOf(uri: string) {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: [{ name: 'test', sequence: { adapter: { uri } } }],
    },
  })
  const asm = session.jbrowse.assemblies[0]
  return readConfObject(asm.sequence.adapter)
}

function assemblyFrom(assembly: Record<string, unknown>) {
  const session = createTestSession({
    jbrowseConfig: { assemblies: [assembly] },
  })
  return session.jbrowse.assemblies[0]
}

test('minimal { adapter: { uri } } resolves the right sequence adapter', () => {
  expect(adapterOf('https://x.test/hg38.fa').type).toBe('IndexedFastaAdapter')
  expect(adapterOf('https://x.test/hg38.fa.gz').type).toBe('BgzipFastaAdapter')
  expect(adapterOf('https://x.test/hg38.2bit').type).toBe('TwoBitAdapter')

  const bgzip = adapterOf('https://x.test/hg38.fa.gz')
  expect(bgzip.gziLocation.uri).toBe('https://x.test/hg38.fa.gz.gzi')
  expect(bgzip.fastaLocation.uri).toBe('https://x.test/hg38.fa.gz')
})

test('flat { name, uri } fills in the sequence track and adapter', () => {
  const asm = assemblyFrom({ name: 'test', uri: 'https://x.test/hg38.fa.gz' })
  expect(readConfObject(asm.sequence, 'type')).toBe('ReferenceSequenceTrack')
  expect(readConfObject(asm.sequence, 'trackId')).toBe(
    'test-ReferenceSequenceTrack',
  )
  const adapter = readConfObject(asm.sequence.adapter)
  expect(adapter.type).toBe('BgzipFastaAdapter')
  expect(adapter.fastaLocation.uri).toBe('https://x.test/hg38.fa.gz')
})

test('refNameAliases/cytobands accept a bare { uri } shorthand', () => {
  const asm = assemblyFrom({
    name: 'test',
    uri: 'https://x.test/hg38.fa.gz',
    refNameAliases: { uri: 'https://x.test/hg38.aliases.txt' },
    cytobands: { uri: 'https://x.test/hg38.cytoBand.txt' },
  })
  const aliases = readConfObject(asm.refNameAliases.adapter)
  expect(aliases.type).toBe('RefNameAliasAdapter')
  expect(aliases.location.uri).toBe('https://x.test/hg38.aliases.txt')

  const cytobands = readConfObject(asm.cytobands.adapter)
  expect(cytobands.type).toBe('CytobandAdapter')
  expect(cytobands.cytobandLocation.uri).toBe(
    'https://x.test/hg38.cytoBand.txt',
  )
})

test('refNameAliases { uri } carries baseUri to the alias location', () => {
  const base = 'https://x.test/sub/config.json'
  const asm = assemblyFrom({
    name: 'test',
    uri: 'hg38.fa',
    baseUri: base,
    refNameAliases: { uri: 'hg38.aliases.txt', baseUri: base },
  })
  expect(readConfObject(asm.refNameAliases.adapter).location.baseUri).toBe(base)
})

test('baseUri stamped next to a flat uri resolves the sequence locations', () => {
  const base = 'https://x.test/sub/config.json'
  const asm = assemblyFrom({
    name: 'test',
    uri: 'hg38.fa',
    baseUri: base,
  })
  const adapter = readConfObject(asm.sequence.adapter)
  expect(adapter.type).toBe('IndexedFastaAdapter')
  expect(adapter.fastaLocation.baseUri).toBe(base)
  expect(adapter.faiLocation.baseUri).toBe(base)
})
