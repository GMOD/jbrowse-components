import { buildCanonicalRows } from './getSources.ts'

import type { SampleInfo } from './types.ts'

// A mixed-ploidy set, since that is where the haplotype expansion has anything
// to decide: HG002 is haploid (a pangenome assembly path, or chrX non-PAR).
const sampleInfo: Record<string, SampleInfo> = {
  HG001: { maxPloidy: 2, isPhased: true },
  HG002: { maxPloidy: 1, isPhased: true },
  HG003: { maxPloidy: 2, isPhased: true },
}

describe('buildCanonicalRows', () => {
  test('takes every sample the data mentions when no filter is sent', () => {
    expect(
      buildCanonicalRows({
        sampleInfo,
        sampleFilter: undefined,
        renderingMode: 'alleleCount',
      }).map(s => s.name),
    ).toEqual(['HG001', 'HG002', 'HG003'])
  })

  test('an empty filter means no rows, not every row', () => {
    // The two are different answers and collapsing them costs a whole cell
    // matrix: `undefined` is the client's pre-sources state, `[]` is a filter
    // that resolved to nothing and must compute nothing.
    expect(
      buildCanonicalRows({
        sampleInfo,
        sampleFilter: [],
        renderingMode: 'alleleCount',
      }),
    ).toEqual([])
  })

  test('narrows to the filter, and ignores its order', () => {
    const forward = buildCanonicalRows({
      sampleInfo,
      sampleFilter: ['HG001', 'HG003'],
      renderingMode: 'alleleCount',
    })
    const reversed = buildCanonicalRows({
      sampleInfo,
      sampleFilter: ['HG003', 'HG001'],
      renderingMode: 'alleleCount',
    })
    // Order-independence is the whole point: the client sends a set, so two
    // spellings of the same set must produce byte-identical row assignments or
    // a reorder would still change the payload.
    expect(forward.map(s => s.name)).toEqual(['HG001', 'HG003'])
    expect(reversed).toEqual(forward)
  })

  test('expands to haplotype rows in phased mode, per-sample ploidy', () => {
    const rows = buildCanonicalRows({
      sampleInfo,
      sampleFilter: undefined,
      renderingMode: 'phased',
    })
    // haploid HG002 gets one row, not a phantom HP1 it has no allele for
    expect(rows.map(s => s.name)).toEqual([
      'HG001 HP0',
      'HG001 HP1',
      'HG002 HP0',
      'HG003 HP0',
      'HG003 HP1',
    ])
    expect(rows.map(s => s.HP)).toEqual([0, 1, 0, 0, 1])
    // filtered by SAMPLE name, expanded after — the client narrows the
    // haplotypes it draws when it places these
    expect(rows.every(s => sampleInfo[s.sampleName])).toBe(true)
  })

  test('names haplotype rows the way the client expands them', () => {
    // Both sides go through expandSourcesToHaplotypes, so the strings the
    // worker ships in `rowNames` are the strings `sources` produces. If these
    // ever drift, every phased row silently places at HIDDEN_ROW.
    const rows = buildCanonicalRows({
      sampleInfo: { HG001: { maxPloidy: 2, isPhased: true } },
      sampleFilter: ['HG001'],
      renderingMode: 'phased',
    })
    expect(rows.map(s => s.name)).toEqual(['HG001 HP0', 'HG001 HP1'])
  })
})
