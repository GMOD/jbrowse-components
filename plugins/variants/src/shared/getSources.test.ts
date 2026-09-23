import {
  arrangeRows,
  expandSourcesToHaplotypes,
  keptRowsOf,
  parseRowName,
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

describe('arrangeRows', () => {
  const sources = [
    { name: 'HG001', color: 'red' },
    { name: 'HG002', label: 'Two' },
    { name: 'HG003' },
  ]
  const sampleInfo = {
    HG001: { isPhased: true, maxPloidy: 2 },
    HG002: { isPhased: true, maxPloidy: 2 },
    HG003: { isPhased: true, maxPloidy: 1 },
  }
  const none = { domain: [], labels: {}, rowColors: new Map() }
  const names = (rows: { name: string }[]) => rows.map(r => r.name)

  test('allele count: one row per sample, samplesTsv color as the tint', () => {
    const rows = arrangeRows({
      sources,
      renderingMode: 'alleleCount',
      sampleInfo,
      arrangement: none,
    })
    expect(names(rows)).toEqual(['HG001', 'HG002', 'HG003'])
    expect(rows[0]).toMatchObject({ sampleName: 'HG001', labelColor: 'red' })
  })

  test('the listed rows lead, and a sample the order omits is appended', () => {
    const rows = arrangeRows({
      sources,
      renderingMode: 'alleleCount',
      arrangement: { ...none, domain: ['HG003', 'UNKNOWN', 'HG001'] },
    })
    expect(names(rows)).toEqual(['HG003', 'HG001', 'HG002'])
  })

  test('phased: haplotypes by ploidy, a sample name ordering all of them', () => {
    const rows = arrangeRows({
      sources,
      renderingMode: 'phased',
      sampleInfo,
      arrangement: { ...none, domain: ['HG003', 'HG002 HP1'] },
    })
    expect(names(rows)).toEqual([
      'HG003 HP0',
      'HG002 HP1',
      'HG001 HP0',
      'HG001 HP1',
      'HG002 HP0',
    ])
  })

  // Until the ploidy lands the names stand for it, so an arranged track keeps
  // its haplotype rows across a refetch; a sample the order names only as a
  // sample waits for the ploidy.
  test('phased without sampleInfo: the haplotypes the order names', () => {
    const rows = arrangeRows({
      sources,
      renderingMode: 'phased',
      arrangement: { ...none, domain: ['HG002 HP1', 'HG002 HP0', 'HG001'] },
    })
    expect(names(rows)).toEqual(['HG002 HP1', 'HG002 HP0', 'HG001', 'HG003'])
  })

  test('a label or tint by row name, then by sample name, over the adapter', () => {
    const rows = arrangeRows({
      sources,
      renderingMode: 'phased',
      sampleInfo,
      arrangement: {
        domain: [],
        labels: { 'HG001 HP1': 'One, second', HG002: 'Second' },
        rowColors: new Map([
          ['HG001', 'blue'],
          ['HG002 HP0', 'green'],
        ]),
      },
    })
    expect(
      rows.map(({ name, label, labelColor }) => ({ name, label, labelColor })),
    ).toEqual([
      { name: 'HG001 HP0', label: undefined, labelColor: 'blue' },
      { name: 'HG001 HP1', label: 'One, second', labelColor: 'blue' },
      { name: 'HG002 HP0', label: 'Second', labelColor: 'green' },
      { name: 'HG002 HP1', label: 'Second', labelColor: undefined },
      { name: 'HG003 HP0', label: undefined, labelColor: undefined },
    ])
  })

  test('a sample called constructor reads no inherited label', () => {
    const [row] = arrangeRows({
      sources: [{ name: 'constructor' }],
      renderingMode: 'alleleCount',
      arrangement: none,
    })
    expect(row!.label).toBeUndefined()
  })
})

describe('keptRowsOf', () => {
  const samples = [{ name: 'HG001' }, { name: 'HG002' }, { name: 'HG003' }]
  const haplotypes = ['HG001', 'HG002'].flatMap(sampleName => [
    { name: `${sampleName} HP0`, sampleName, HP: 0 },
    { name: `${sampleName} HP1`, sampleName, HP: 1 },
  ])
  const names = (rows: { name: string }[]) => rows.map(r => r.name)

  test('a focus on a haplotype keeps its sample, for the fetch', () => {
    expect(names(keptRowsOf(samples, ['HG002 HP1']))).toEqual(['HG002'])
  })

  test('and only that haplotype among the rows drawn', () => {
    expect(names(keptRowsOf(haplotypes, ['HG002 HP1']))).toEqual(['HG002 HP1'])
  })

  test('a sample name keeps all of its haplotypes', () => {
    expect(names(keptRowsOf(haplotypes, ['HG001']))).toEqual([
      'HG001 HP0',
      'HG001 HP1',
    ])
  })

  test('a focus naming no current row keeps every row', () => {
    expect(keptRowsOf(samples, ['NA0001'])).toBe(samples)
    expect(keptRowsOf(samples, undefined)).toBe(samples)
  })
})
