import {
  expandPhasedRows,
  expandSourcesToHaplotypes,
  parseRowName,
  rowAliasOf,
} from './getSources.ts'

describe('expandSourcesToHaplotypes', () => {
  test('expands diploid samples to two haplotypes', () => {
    const sources = [{ name: 'HG001' }, { name: 'HG002' }]
    const samplePloidy = {
      HG001: 2,
      HG002: 2,
    }

    const result = expandSourcesToHaplotypes({ sources, samplePloidy })

    expect(result).toEqual([
      { name: 'HG001 HP0', sampleName: 'HG001', HP: 0 },
      { name: 'HG001 HP1', sampleName: 'HG001', HP: 1 },
      { name: 'HG002 HP0', sampleName: 'HG002', HP: 0 },
      { name: 'HG002 HP1', sampleName: 'HG002', HP: 1 },
    ])
  })

  test('handles variable ploidy', () => {
    const sources = [{ name: 'HG001' }, { name: 'HG002' }]
    const samplePloidy = {
      HG001: 2,
      HG002: 3,
    }

    const result = expandSourcesToHaplotypes({ sources, samplePloidy })

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

  test("a haploid sample's row is labelled with its own name", () => {
    const sources = [{ name: 'CFT073' }, { name: 'HG001' }]
    const samplePloidy = {
      CFT073: 1,
      HG001: 2,
    }

    const rows = expandSourcesToHaplotypes({ sources, samplePloidy })
    expect(rows.map(s => s.name)).toEqual([
      'CFT073 HP0',
      'HG001 HP0',
      'HG001 HP1',
    ])
    expect(rows.map(s => s.label)).toEqual(['CFT073', undefined, undefined])
  })

  test('defaults to ploidy 2 when samplePloidy missing', () => {
    const sources = [{ name: 'HG001' }]
    const samplePloidy = {}

    const result = expandSourcesToHaplotypes({ sources, samplePloidy })

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
    const samplePloidy = {
      HG001: 2,
    }

    const result = expandSourcesToHaplotypes({ sources, samplePloidy })

    expect(result).toEqual(sources)
  })

  test('preserves other source properties', () => {
    const sources = [{ name: 'HG001', color: 'red', group: 'family1' }]
    const samplePloidy = {
      HG001: 2,
    }

    const result = expandSourcesToHaplotypes({ sources, samplePloidy })

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
    { name: 'HG001', sampleName: 'HG001', rowColor: 'red' },
    { name: 'HG002', sampleName: 'HG002', label: 'Two' },
    { name: 'HG003', sampleName: 'HG003' },
  ]
  const ploidy = { HG001: 2, HG002: 2, HG003: 1 }
  const names = (out: { name: string }[]) => out.map(r => r.name)

  test('a row per haplotype by ploidy, each carrying its sample', () => {
    const out = expandPhasedRows({ rows, ploidy, domain: [] })
    expect(names(out)).toEqual([
      'HG001 HP0',
      'HG001 HP1',
      'HG002 HP0',
      'HG002 HP1',
      'HG003 HP0',
    ])
    expect(out[4]).toMatchObject({ label: 'HG003' })
    expect(out[1]).toMatchObject({
      sampleName: 'HG001',
      HP: 1,
      rowColor: 'red',
    })
    expect(out[2]).toMatchObject({ label: 'Two' })
  })

  // Until the ploidy lands the names stand for it, so an arranged track keeps
  // its haplotype rows across a refetch; a sample the order names only as a
  // sample waits for the ploidy.
  test('without a ploidy: the haplotypes the order names', () => {
    const out = expandPhasedRows({
      rows,
      ploidy: undefined,
      domain: ['HG002 HP1', 'HG002 HP0', 'HG001'],
    })
    expect(names(out)).toEqual(['HG001', 'HG002 HP0', 'HG002 HP1', 'HG003'])
  })

  // 1000G chrX: a male is diploid in the PAR and haploid past it, so a pan
  // across the boundary changes his ploidy under an arrangement naming both
  // haplotypes. The HP0 row keeps the name the arrangement holds.
  test("a sample's rows keep their names when its ploidy drops", () => {
    const domain = ['HG003 HP0', 'HG003 HP1']
    const diploid = expandPhasedRows({
      rows,
      ploidy: { ...ploidy, HG003: 2 },
      domain,
    })
    const haploid = expandPhasedRows({ rows, ploidy, domain })
    expect(names(diploid).slice(-2)).toEqual(['HG003 HP0', 'HG003 HP1'])
    expect(names(haploid).slice(-2)).toEqual(['HG003 HP0', 'HG003 HP1'])
    // beside its HP1 row, HP0 is not the whole sample
    expect(haploid.slice(-2).map(r => r.label)).toEqual([undefined, undefined])
  })

  test('the rows themselves while no sample expands', () => {
    expect(expandPhasedRows({ rows, ploidy: undefined, domain: [] })).toBe(rows)
  })
})
