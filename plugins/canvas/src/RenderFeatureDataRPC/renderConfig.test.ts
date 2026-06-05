import { isLabelAllowed, readConfigValue } from './renderConfig.ts'
import { mockDisplayConfig } from './testUtils.ts'

function mockFeature(data: Record<string, unknown> = {}) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
  } as any
}

const anyFeature = mockFeature()

describe('readConfigValue', () => {
  it('returns value when present', () => {
    expect(readConfigValue({ color: 'red' }, 'color', anyFeature)).toBe('red')
  })

  it('returns undefined when key is missing', () => {
    expect(readConfigValue({}, 'color', anyFeature)).toBeUndefined()
  })

  it('evaluates JEXL expression per-feature', () => {
    const config = {
      color: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    }
    expect(readConfigValue(config, 'color', mockFeature({ type: 'SNV' }))).toBe(
      'green',
    )
    expect(
      readConfigValue(config, 'color', mockFeature({ type: 'insertion' })),
    ).toBe('purple')
  })

  it('resolves nested keys', () => {
    expect(
      readConfigValue(
        { labels: { name: 'myGene' } },
        ['labels', 'name'],
        anyFeature,
      ),
    ).toBe('myGene')
  })
})

describe('isLabelAllowed', () => {
  it('returns true when suppressLabels is false', () => {
    expect(isLabelAllowed(mockDisplayConfig())).toBe(true)
  })

  it('returns false when suppressLabels is true (collapse mode)', () => {
    expect(isLabelAllowed(mockDisplayConfig({ suppressLabels: true }))).toBe(
      false,
    )
  })
})
