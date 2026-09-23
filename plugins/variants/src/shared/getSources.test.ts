import {
  expandPhasedRows,
  expandSourcesToHaplotypes,
  parseRowName,
  rowAliasOf,
} from './getSources.ts'

describe('expandSourcesToHaplotypes', () => {
  test('expands diploid samples to two haplotypes', () => {
    const sources = [{ name: 'HG001' }, { name: 'HG002' }]
    const sampleInfo = {
      HG001: { isPhased: true, maxPloidy: 2 },
      HG002: { isPhased: true, maxPloidy: 2 },
    }

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result).toEqual([
      { name: 'HG001 HP0', sampleName: 'HG001', HP: 0 },
      { name: 'HG001 HP1', sampleName: 'HG001', HP: 1 },
      { name: 'HG002 HP0', sampleName: 'HG002', HP: 0 },
      { name: 'HG002 HP1', sampleName: 'HG002', HP: 1 },
    ])
  })

  test('handles variable ploidy', () => {
    const sources = [{ name: 'HG001' }, { name: 'HG002' }]
    const sampleInfo = {
      HG001: { isPhased: true, maxPloidy: 2 },
      HG002: { isPhased: true, maxPloidy: 3 },
    }

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result).toHaveLength(5)
    expect(result[2]).toMatchObject({
      name: 'HG002 HP0',
      sampleName: 'HG002',
      HP: 0,
    })
    expect(result[4]).toMatchObject({
      name: 'HG002 HP2',
      sampleName: 'HG002',
      HP: 2,
    })
  })

  test('defaults to ploidy 2 when sampleInfo missing', () => {
    const sources = [{ name: 'HG001' }]
    const sampleInfo = {}

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result).toEqual([
      { name: 'HG001 HP0', sampleName: 'HG001', HP: 0 },
      { name: 'HG001 HP1', sampleName: 'HG001', HP: 1 },
    ])
  })

  // Sources from haplotype clustering already carry HP; they must pass through
  // unchanged rather than being re-expanded. This branch is shared by the worker
  // and the model `sources` getter, which previously hand-rolled it.
  test('passes through sources that already have an HP index', () => {
    const sources = [
      { name: 'HG001 HP0', sampleName: 'HG001', HP: 0 },
      { name: 'HG001 HP1', sampleName: 'HG001', HP: 1 },
    ]
    const sampleInfo = {
      HG001: { isPhased: true, maxPloidy: 2 },
    }

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result).toEqual(sources)
  })

  test('preserves other source properties', () => {
    const sources = [{ name: 'HG001', color: 'red', group: 'family1' }]
    const sampleInfo = {
      HG001: { isPhased: true, maxPloidy: 2 },
    }

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result[0]).toMatchObject({
      name: 'HG001 HP0',
      sampleName: 'HG001',
      HP: 0,
      color: 'red',
      group: 'family1',
    })
  })
})

describe('parseRowName', () => {
  const samples = new Set(['HG001', 'X HP0'])

  test('reads a sample, and a haplotype back to its sample', () => {
    expect(parseRowName('HG001', samples)).toEqual({ sampleName: 'HG001' })
    expect(parseRowName('HG001 HP1', samples)).toEqual({
      sampleName: 'HG001',
      HP: 1,
    })
  })

  // A sample's own name wins over the haplotype reading of it.
  test('a sample called like a haplotype is the sample', () => {
    expect(parseRowName('X HP0', samples)).toEqual({ sampleName: 'X HP0' })
  })

  test('a name no current sample answers to is undefined', () => {
    expect(parseRowName('HG002 HP0', samples)).toBeUndefined()
    expect(parseRowName('HG002', samples)).toBeUndefined()
  })
})

test('rowAliasOf answers as parseRowName does, asked again', () => {
  const alias = rowAliasOf([{ name: 'a', sampleName: 'HG001' }])
  for (let i = 0; i < 2; i++) {
    expect(alias('HG001 HP1')).toBe('HG001')
    expect(alias('HG001')).toBe('HG001')
    expect(alias('a')).toBeUndefined()
  }
})

describe('expandPhasedRows', () => {
  const rows = [
    { name: 'HG001', sampleName: 'HG001', labelColor: 'red' },
    { name: 'HG002', sampleName: 'HG002', label: 'Two' },
    { name: 'HG003', sampleName: 'HG003' },
  ]
  const sampleInfo = {
    HG001: { isPhased: true, maxPloidy: 2 },
    HG002: { isPhased: true, maxPloidy: 2 },
    HG003: { isPhased: true, maxPloidy: 1 },
  }
  const names = (out: { name: string }[]) => out.map(r => r.name)

  test('a row per haplotype by ploidy, each carrying its sample', () => {
    const out = expandPhasedRows({ rows, sampleInfo, domain: [] })
    expect(names(out)).toEqual([
      'HG001 HP0',
      'HG001 HP1',
      'HG002 HP0',
      'HG002 HP1',
      'HG003 HP0',
    ])
    expect(out[1]).toMatchObject({
      sampleName: 'HG001',
      HP: 1,
      labelColor: 'red',
    })
    expect(out[2]).toMatchObject({ label: 'Two' })
  })

  // Until the ploidy lands the names stand for it, so an arranged track keeps
  // its haplotype rows across a refetch; a sample the order names only as a
  // sample waits for the ploidy.
  test('without sampleInfo: the haplotypes the order names', () => {
    const out = expandPhasedRows({
      rows,
      sampleInfo: undefined,
      domain: ['HG002 HP1', 'HG002 HP0', 'HG001'],
    })
    expect(names(out)).toEqual(['HG001', 'HG002 HP0', 'HG002 HP1', 'HG003'])
  })

  test('the rows themselves while no sample expands', () => {
    expect(expandPhasedRows({ rows, sampleInfo: undefined, domain: [] })).toBe(
      rows,
    )
  })
})
