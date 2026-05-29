import { probeAssembliesSwapped, refNamesLookSwapped } from './index.ts'

describe('refNamesLookSwapped', () => {
  const xEntries = new Set(['chrA'])
  const yEntries = new Set(['chrB'])

  it('flags swap when reported X-axis names belong to the Y assembly', () => {
    expect(refNamesLookSwapped({ reported: ['chrB'], xEntries, yEntries })).toBe(
      true,
    )
  })

  it('does not flag when reported names belong to the X assembly', () => {
    expect(refNamesLookSwapped({ reported: ['chrA'], xEntries, yEntries })).toBe(
      false,
    )
  })

  it('does not flag names absent from both axes', () => {
    expect(refNamesLookSwapped({ reported: ['chrZ'], xEntries, yEntries })).toBe(
      false,
    )
  })

  it('uses the majority when names are mixed', () => {
    expect(
      refNamesLookSwapped({
        reported: ['chrB', 'chrB', 'chrA'],
        xEntries,
        yEntries,
      }),
    ).toBe(true)
  })

  it('canonicalizes reported names per axis before comparing', () => {
    // File uses "1"/"2"; assemblies use "chrA"/"chrB"
    expect(
      refNamesLookSwapped({
        reported: ['2'],
        xEntries,
        yEntries,
        canonicalizeX: n => (n === '1' ? 'chrA' : n),
        canonicalizeY: n => (n === '2' ? 'chrB' : n),
      }),
    ).toBe(true)
  })
})

describe('probeAssembliesSwapped', () => {
  const xEntries = new Set(['chrA'])
  const yEntries = new Set(['chrB'])
  const base = {
    topAssembly: 'asmA',
    bottomAssembly: 'asmB',
    xEntries,
    yEntries,
  }

  it('flags swap when nothing rendered and top names are the bottom assembly', async () => {
    expect(
      await probeAssembliesSwapped({
        ...base,
        rendered: 0,
        getReportedRefNames: () => Promise.resolve(['chrB']),
      }),
    ).toBe(true)
  })

  it('does not probe when something rendered', async () => {
    expect(
      await probeAssembliesSwapped({
        ...base,
        rendered: 5,
        getReportedRefNames: () => Promise.resolve(['chrB']),
      }),
    ).toBe(false)
  })

  it('does not flag a single self-comparison assembly', async () => {
    expect(
      await probeAssembliesSwapped({
        ...base,
        bottomAssembly: 'asmA',
        rendered: 0,
        getReportedRefNames: () => Promise.resolve(['chrB']),
      }),
    ).toBe(false)
  })

  it('does not flag a missing assembly name', async () => {
    expect(
      await probeAssembliesSwapped({
        ...base,
        topAssembly: undefined,
        rendered: 0,
        getReportedRefNames: () => Promise.resolve(['chrB']),
      }),
    ).toBe(false)
  })

  it('yields no signal when getRefNames rejects', async () => {
    expect(
      await probeAssembliesSwapped({
        ...base,
        rendered: 0,
        getReportedRefNames: () => Promise.reject(new Error('not implemented')),
      }),
    ).toBe(false)
  })
})
