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
    expect(readConfigValue({ color1: 'red' }, 'color1', anyFeature)).toBe('red')
  })

  it('returns undefined when key is missing', () => {
    expect(readConfigValue({}, 'color1', anyFeature)).toBeUndefined()
  })

  it('evaluates JEXL expression per-feature', () => {
    const config = {
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    }
    expect(
      readConfigValue(config, 'color1', mockFeature({ type: 'SNV' })),
    ).toBe('green')
    expect(
      readConfigValue(config, 'color1', mockFeature({ type: 'insertion' })),
    ).toBe('purple')
  })

  it('resolves nested keys', () => {
    expect(
      readConfigValue(
        { labels: { fontSize: 14 } },
        ['labels', 'fontSize'],
        anyFeature,
      ),
    ).toBe(14)
  })
})

describe('isLabelAllowed', () => {
  it('returns true for normal mode', () => {
    expect(isLabelAllowed(mockDisplayConfig())).toBe(true)
  })

  it('returns false for collapse mode', () => {
    expect(isLabelAllowed(mockDisplayConfig({ displayMode: 'collapse' }))).toBe(
      false,
    )
  })
})
