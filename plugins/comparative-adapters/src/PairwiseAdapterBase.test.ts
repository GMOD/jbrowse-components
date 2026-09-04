import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  AssemblyNotInAdapterError,
  PairwiseAdapterBase,
} from './PairwiseAdapterBase.ts'

import type { Feature } from '@jbrowse/core/util'

// The three slots getAssemblyNamesFromConf reads, and nothing else. Declared
// here rather than borrowed from one of the four real adapters: what is under
// test is the contract every pairwise config satisfies, so a schema change in
// PAF or BLAST should not be able to fail this file, and a slot renamed out from
// under the base should.
const TestConfigSchema = ConfigurationSchema('TestPairwiseAdapter', {
  assemblyNames: {
    type: 'stringArray',
    defaultValue: [],
  },
  queryAssembly: {
    type: 'string',
    defaultValue: '',
  },
  targetAssembly: {
    type: 'string',
    defaultValue: '',
  },
})

// The base's two answers are protected, since an adapter reaches for them from
// inside getFeatures rather than a caller reaching in. Exposed here rather than
// inferred from what the four adapters emit: the rule is what the adapters share,
// so it is stated once, and a drift shows up as this file failing rather than as
// one adapter's fixture counting differently.
class TestAdapter extends PairwiseAdapterBase {
  getRefNames() {
    return Promise.resolve([])
  }

  getFeatures() {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }

  sides(assemblyName: string | undefined) {
    return this.facingSides(assemblyName)
  }

  querySides(assemblyName: string | undefined) {
    return this.queriedSides(assemblyName)
  }

  mate(side: 0 | 1) {
    return this.mateAssemblyName(side)
  }

  dedupe(sides: (0 | 1)[]) {
    return this.createSideDedupe(sides)
  }
}

function makeAdapter(conf: Record<string, unknown>) {
  return new TestAdapter(TestConfigSchema.create(conf))
}

describe('PairwiseAdapterBase', () => {
  describe('facingSides', () => {
    const adapter = makeAdapter({ assemblyNames: ['query', 'target'] })

    it('puts the first assemblyNames entry on side 0, the file query columns', () => {
      expect(adapter.sides('query')).toEqual([0])
    })

    it('puts the second on side 1, the file target columns', () => {
      expect(adapter.sides('target')).toEqual([1])
    })

    it('answers no side for an assembly this adapter does not carry', () => {
      expect(adapter.sides('mouse')).toEqual([])
    })

    // getRefNames is called with no assemblyName by callers that have not
    // resolved one yet. No side is the "not ours" answer, which every pairwise
    // adapter turns into [] rather than a throw or a download.
    it('answers no side for no assembly name at all', () => {
      expect(adapter.sides(undefined)).toEqual([])
    })

    // A pairwise file has two sides however many names the config lists, so a
    // third entry reads as the target rather than as a side of its own. This is
    // what the positional lookup has always done, and it is why a side is a 0/1
    // index into a two-element structure and not a position in the name list.
    it('reads anything past the second name as the target side', () => {
      const three = makeAdapter({ assemblyNames: ['query', 'target', 'extra'] })
      expect(three.sides('extra')).toEqual([1])
    })

    // The defect this replaced an indexOf for: a whole-genome-duplication PAF
    // names one assembly twice, the first match answered the query columns for
    // every query, and every row anchored on the target columns went undrawn.
    it('faces both sides of a self-alignment', () => {
      const self = makeAdapter({ assemblyNames: ['vvx', 'vvx'] })
      expect(self.sides('vvx')).toEqual([0, 1])
    })

    it('faces both sides of a self-alignment written with the named slots', () => {
      const self = makeAdapter({ queryAssembly: 'vvx', targetAssembly: 'vvx' })
      expect(self.sides('vvx')).toEqual([0, 1])
    })
  })

  // A feature query names an assembly the main thread has already respelled
  // into this adapter's namespace, so one it does not carry is a caller that
  // skipped that step — and an empty answer there drew an empty band with
  // nothing to say why.
  describe('queriedSides', () => {
    const adapter = makeAdapter({ assemblyNames: ['query', 'target'] })

    it('answers the facing sides for an assembly this adapter carries', () => {
      expect(adapter.querySides('target')).toEqual([1])
    })

    it('refuses an assembly this adapter does not carry, naming both', () => {
      expect(() => adapter.querySides('mouse')).toThrow(
        AssemblyNotInAdapterError,
      )
      expect(() => adapter.querySides('mouse')).toThrow(
        'assembly mouse is not one this adapter aligns (query, target)',
      )
    })
  })

  describe('mateAssemblyName', () => {
    const adapter = makeAdapter({ assemblyNames: ['query', 'target'] })

    it('gives the target as the mate of the query side', () => {
      expect(adapter.mate(0)).toBe('target')
    })

    it('gives the query as the mate of the target side', () => {
      expect(adapter.mate(1)).toBe('query')
    })
  })

  // The three cases the side dedupe has to tell apart, stated on the gate
  // itself: they reach it from three different adapters and each one has a
  // format's worth of orientation code in between.
  describe('createSideDedupe', () => {
    const drawn = {
      refName: 'ctgA',
      start: 0,
      end: 6079,
      strand: 1,
      mateRefName: 'ctgB',
      mateStart: 0,
      mateEnd: 6079,
    }

    // A file that writes each alignment from both ends reaches one of them
    // twice; the ribbon was painted on top of itself.
    it('lets one drawn alignment through once', () => {
      const gate = makeAdapter({ assemblyNames: ['vvx', 'vvx'] }).dedupe([0, 1])
      expect(gate(drawn)).toBe(true)
      expect(gate(drawn)).toBe(false)
    })

    // The two ends of a tandem duplication are the same pair of loci read the
    // other way round, and both have to draw — that is what serving both sides
    // is for, so the key cannot normalize the anchor and mate together.
    it('lets both ends of a duplication through', () => {
      const gate = makeAdapter({ assemblyNames: ['vvx', 'vvx'] }).dedupe([0, 1])
      const oneEnd = {
        refName: 'ctgC',
        start: 0,
        end: 100,
        strand: 1,
        mateRefName: 'ctgC',
        mateStart: 500,
        mateEnd: 600,
      }
      expect(gate(oneEnd)).toBe(true)
      expect(
        gate({
          ...oneEnd,
          start: 500,
          end: 600,
          mateStart: 0,
          mateEnd: 100,
        }),
      ).toBe(true)
    })

    // tblastx reports a region's forward and reverse frames as separate hits
    // over one interval pair, and BLAST's min/max orientation leaves them
    // indistinguishable by geometry alone.
    it('lets two hits on one geometry through when they differ in identity', () => {
      const gate = makeAdapter({ assemblyNames: ['vvx', 'vvx'] }).dedupe([0, 1])
      expect(gate({ ...drawn, identity: 0.81 })).toBe(true)
      expect(gate({ ...drawn, identity: 0.6 })).toBe(true)
      expect(gate({ ...drawn, identity: 0.81 })).toBe(false)
    })

    // A two-genome track cannot reach one alignment twice, so it neither builds
    // the set nor hashes into it — the gate is the same call either way.
    it('never withholds anything on a one-sided query', () => {
      const gate = makeAdapter({ assemblyNames: ['q', 't'] }).dedupe([0])
      expect(gate(drawn)).toBe(true)
      expect(gate(drawn)).toBe(true)
    })
  })

  // The named slots are the documented alternative to the positional array,
  // whose order is the reverse of the one minimap2 takes its inputs in. The
  // side rule has to read the same either way, or a config written the safe way
  // would draw its mates against the wrong genome.
  it('reads the named query/target slots when assemblyNames is empty', () => {
    const adapter = makeAdapter({
      queryAssembly: 'hg19',
      targetAssembly: 'hg38',
    })
    expect(adapter.getAssemblyNames()).toEqual(['hg19', 'hg38'])
    expect(adapter.sides('hg19')).toEqual([0])
    expect(adapter.sides('hg38')).toEqual([1])
    expect(adapter.mate(0)).toBe('hg38')
  })
})
