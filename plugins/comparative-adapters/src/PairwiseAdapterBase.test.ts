import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import PAFConfigSchema from './PAFAdapter/configSchema.ts'
import { PairwiseAdapterBase } from './PairwiseAdapterBase.ts'

import type { Feature } from '@jbrowse/core/util'

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

  side(assemblyName: string | undefined) {
    return this.sideFor(assemblyName)
  }

  mate(side: 0 | 1) {
    return this.mateAssemblyName(side)
  }
}

function makeAdapter(conf: Record<string, unknown>) {
  return new TestAdapter(
    PAFConfigSchema.create({
      pafLocation: {
        localPath: 'unused.paf',
        locationType: 'LocalPathLocation',
      },
      ...conf,
    }),
  )
}

describe('PairwiseAdapterBase', () => {
  describe('sideFor', () => {
    const adapter = makeAdapter({ assemblyNames: ['query', 'target'] })

    it('puts the first assemblyNames entry on side 0, the file query columns', () => {
      expect(adapter.side('query')).toBe(0)
    })

    it('puts the second on side 1, the file target columns', () => {
      expect(adapter.side('target')).toBe(1)
    })

    it('answers -1 for an assembly this adapter does not carry', () => {
      expect(adapter.side('mouse')).toBe(-1)
    })

    // getRefNames is called with no assemblyName by callers that have not
    // resolved one yet. -1 is the "not ours" answer, which every pairwise
    // adapter turns into [] rather than a throw or a download.
    it('answers -1 for no assembly name at all', () => {
      expect(adapter.side(undefined)).toBe(-1)
    })

    // A pairwise file has two sides however many names the config lists, so a
    // third entry reads as the target rather than as a side of its own. This is
    // what the positional indexOf has always done, and it is why the side is a
    // 0/1 index into a two-element structure and not the raw indexOf.
    it('reads anything past the second name as the target side', () => {
      const three = makeAdapter({ assemblyNames: ['query', 'target', 'extra'] })
      expect(three.side('extra')).toBe(1)
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
    expect(adapter.side('hg19')).toBe(0)
    expect(adapter.side('hg38')).toBe(1)
    expect(adapter.mate(0)).toBe('hg38')
  })
})
