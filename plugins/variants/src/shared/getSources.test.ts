import { expandSourcesToHaplotypes, getSources } from './getSources.ts'

describe('expandSourcesToHaplotypes', () => {
  test('expands diploid samples to two haplotypes', () => {
    const sources = [{ name: 'HG001' }, { name: 'HG002' }]
    const sampleInfo = {
      HG001: { isPhased: true, maxPloidy: 2 },
      HG002: { isPhased: true, maxPloidy: 2 },
    }

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result).toEqual([
      { name: 'HG001 HP0', baseName: 'HG001', HP: 0 },
      { name: 'HG001 HP1', baseName: 'HG001', HP: 1 },
      { name: 'HG002 HP0', baseName: 'HG002', HP: 0 },
      { name: 'HG002 HP1', baseName: 'HG002', HP: 1 },
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
      baseName: 'HG002',
      HP: 0,
    })
    expect(result[4]).toMatchObject({
      name: 'HG002 HP2',
      baseName: 'HG002',
      HP: 2,
    })
  })

  test('defaults to ploidy 2 when sampleInfo missing', () => {
    const sources = [{ name: 'HG001' }]
    const sampleInfo = {}

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result).toEqual([
      { name: 'HG001 HP0', baseName: 'HG001', HP: 0 },
      { name: 'HG001 HP1', baseName: 'HG001', HP: 1 },
    ])
  })

  test('preserves other source properties', () => {
    const sources = [{ name: 'HG001', color: 'red', group: 'family1' }]
    const sampleInfo = {
      HG001: { isPhased: true, maxPloidy: 2 },
    }

    const result = expandSourcesToHaplotypes({ sources, sampleInfo })

    expect(result[0]).toMatchObject({
      name: 'HG001 HP0',
      baseName: 'HG001',
      HP: 0,
      color: 'red',
      group: 'family1',
    })
  })
})

describe('getSources', () => {
  const baseSources = [{ name: 'HG001' }, { name: 'HG002' }, { name: 'HG003' }]

  const sampleInfo = {
    HG001: { isPhased: true, maxPloidy: 2 },
    HG002: { isPhased: true, maxPloidy: 2 },
    HG003: { isPhased: true, maxPloidy: 2 },
  }

  test('non-phased mode returns sources as-is', () => {
    const result = getSources({
      sources: baseSources,
      renderingMode: 'alleleCount',
      sampleInfo,
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ name: 'HG001' })
  })

  test('phased mode expands samples to haplotypes', () => {
    const result = getSources({
      sources: baseSources,
      renderingMode: 'phased',
      sampleInfo,
    })

    expect(result).toHaveLength(6)
    expect(result[0]).toMatchObject({
      name: 'HG001 HP0',
      baseName: 'HG001',
      HP: 0,
    })
    expect(result[1]).toMatchObject({
      name: 'HG001 HP1',
      baseName: 'HG001',
      HP: 1,
    })
  })

  test('phased mode with haplotype layout preserves order', () => {
    const haplotypeLayout = [
      { name: 'HG001 HP0', baseName: 'HG001', HP: 0 },
      { name: 'HG002 HP1', baseName: 'HG002', HP: 1 },
      { name: 'HG001 HP1', baseName: 'HG001', HP: 1 },
      { name: 'HG002 HP0', baseName: 'HG002', HP: 0 },
    ]

    const result = getSources({
      sources: baseSources,
      layout: haplotypeLayout,
      renderingMode: 'phased',
      sampleInfo,
    })

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ name: 'HG001 HP0', HP: 0 })
    expect(result[1]).toMatchObject({ name: 'HG002 HP1', HP: 1 })
    expect(result[2]).toMatchObject({ name: 'HG001 HP1', HP: 1 })
    expect(result[3]).toMatchObject({ name: 'HG002 HP0', HP: 0 })
  })

  test('phased mode with sample layout expands each sample', () => {
    const sampleLayout = [{ name: 'HG002' }, { name: 'HG001' }]

    const result = getSources({
      sources: baseSources,
      layout: sampleLayout,
      renderingMode: 'phased',
      sampleInfo,
    })

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ name: 'HG002 HP0', baseName: 'HG002' })
    expect(result[1]).toMatchObject({ name: 'HG002 HP1', baseName: 'HG002' })
    expect(result[2]).toMatchObject({ name: 'HG001 HP0', baseName: 'HG001' })
    expect(result[3]).toMatchObject({ name: 'HG001 HP1', baseName: 'HG001' })
  })

  test('filters out samples not in sources', () => {
    const layout = [{ name: 'HG001' }, { name: 'UNKNOWN' }, { name: 'HG002' }]

    const result = getSources({
      sources: baseSources,
      layout,
      renderingMode: 'alleleCount',
      sampleInfo,
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ name: 'HG001' })
    expect(result[1]).toMatchObject({ name: 'HG002' })
  })

  test('haplotype entries use baseName for source lookup', () => {
    const haplotypeLayout = [{ name: 'HG001 HP0', baseName: 'HG001', HP: 0 }]

    const result = getSources({
      sources: baseSources,
      layout: haplotypeLayout,
      renderingMode: 'phased',
      sampleInfo,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'HG001 HP0',
      baseName: 'HG001',
      HP: 0,
    })
  })
})
