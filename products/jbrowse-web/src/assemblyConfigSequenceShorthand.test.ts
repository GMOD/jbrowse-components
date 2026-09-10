import PluginManager from '@jbrowse/core/PluginManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'

function getAssemblyConfigSchema() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()
  return assemblyConfigSchemaFactory(pluginManager)
}

test('sequence.type/trackId can be omitted, filled in from the assembly name', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'BgzipFastaAdapter',
        uri: 'volvox.fa.gz',
      },
    },
  })

  expect(model.sequence.type).toBe('ReferenceSequenceTrack')
  expect(model.sequence.trackId).toBe('volvox-ReferenceSequenceTrack')
  expect(getSnapshot(model.sequence.adapter)).toMatchObject({
    type: 'BgzipFastaAdapter',
  })
})

// the shape config_guides/from_config.md documents: an adapter that names its
// own type and carries no `uri` at all, so the uri-based adapter-type guess is
// skipped entirely and only the sequence.type/trackId fill-in has to fire
test('sequence.type/trackId are filled in for a uri-less inline adapter', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'inline_assembly',
    sequence: {
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'SEQUENCE_1',
            uniqueId: 'firstId',
            start: 0,
            end: 33,
            seq: 'CCAAGATCTAAGATGTCAACACCTATCTGCTCA',
          },
        ],
      },
    },
  })

  expect(model.sequence.type).toBe('ReferenceSequenceTrack')
  expect(model.sequence.trackId).toBe('inline_assembly-ReferenceSequenceTrack')
  expect(getSnapshot(model.sequence.adapter)).toMatchObject({
    type: 'FromConfigSequenceAdapter',
  })
})

// the flattest form there is, for a genome that has no sequence to point at.
// An unguessable uri does not fail here — it falls to whichever adapter
// registered first — so this pins the guess, not just the absence of a throw
test('the flat uri shorthand takes a .chrom.sizes', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'hg38',
    uri: 'hg38.chrom.sizes',
  })

  expect(model.sequence.type).toBe('ReferenceSequenceTrack')
  expect(model.sequence.trackId).toBe('hg38-ReferenceSequenceTrack')
  expect(getSnapshot(model.sequence.adapter)).toMatchObject({
    type: 'ChromSizesAdapter',
    chromSizesLocation: { uri: 'hg38.chrom.sizes' },
  })
})

// end to end through the schema, where the drop happened: the expansion runs
// as preProcessSnapshot, and MST discards an undeclared key without a word
test('a 2bit keeps its chromSizes through the whole config build', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'hg38',
    uri: 'hg38.2bit',
    sequence: {
      adapter: { uri: 'hg38.2bit', chromSizes: 'hg38.chrom.sizes' },
    },
  })

  expect(getSnapshot(model.sequence.adapter)).toMatchObject({
    type: 'TwoBitAdapter',
    twoBitLocation: { uri: 'hg38.2bit' },
    chromSizesLocation: { uri: 'hg38.chrom.sizes' },
  })
})

test('a named index survives the uri shorthand on a typed adapter', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'IndexedFastaAdapter',
        uri: 'volvox.fa',
        faiLocation: { uri: 'indexes/volvox.fa.fai' },
      },
    },
  })

  expect(getSnapshot(model.sequence.adapter)).toMatchObject({
    fastaLocation: { uri: 'volvox.fa' },
    faiLocation: { uri: 'indexes/volvox.fa.fai' },
  })
})

test('an explicit sequence.type/trackId is left untouched', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox-custom-id',
      adapter: {
        type: 'BgzipFastaAdapter',
        uri: 'volvox.fa.gz',
      },
    },
  })

  expect(model.sequence.trackId).toBe('volvox-custom-id')
})
