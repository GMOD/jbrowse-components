import {
  createRenderConfigContext,
  readCachedConfig,
} from './renderConfig.ts'

import type { CachedConfig } from './renderConfig.ts'

function mockFeature(data: Record<string, unknown>) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
  } as any
}

describe('readCachedConfig', () => {
  it('returns cached value when isCallback is false', () => {
    const cached: CachedConfig<string> = {
      value: 'cachedColor',
      isCallback: false,
    }
    const result = readCachedConfig(
      cached,
      {} as any,
      'color1',
      mockFeature({}),
    )
    expect(result).toBe('cachedColor')
  })

  it('evaluates JEXL expression from plain object when isCallback is true', () => {
    const cached: CachedConfig<string> = {
      value: 'goldenrod',
      isCallback: true,
    }
    const config = {
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    }
    const snvFeature = mockFeature({ type: 'SNV' })
    const indelFeature = mockFeature({ type: 'insertion' })

    expect(readCachedConfig(cached, config as any, 'color1', snvFeature)).toBe(
      'green',
    )
    expect(
      readCachedConfig(cached, config as any, 'color1', indelFeature),
    ).toBe('purple')
  })

  it('returns non-jexl value from plain object when isCallback is true', () => {
    const cached: CachedConfig<string> = {
      value: 'goldenrod',
      isCallback: true,
    }
    const config = { color1: 'red' }
    expect(
      readCachedConfig(cached, config as any, 'color1', mockFeature({})),
    ).toBe('red')
  })
})

describe('createRenderConfigContext', () => {
  it('creates context from plain object with defaults', () => {
    const ctx = createRenderConfigContext({})
    expect(ctx.displayMode).toBe('normal')
    expect(ctx.color1.value).toBe('goldenrod')
    expect(ctx.color1.isCallback).toBe(false)
    expect(ctx.featureHeight.value).toBe(10)
    expect(ctx.labelAllowed).toBe(true)
    expect(ctx.heightMultiplier).toBe(1)
  })

  it('reads explicit color values from plain object', () => {
    const ctx = createRenderConfigContext({ color1: 'red', color2: 'blue' })
    expect(ctx.color1.value).toBe('red')
    expect(ctx.color1.isCallback).toBe(false)
    expect(ctx.color2.value).toBe('blue')
    expect(ctx.color2.isCallback).toBe(false)
  })

  it('detects JEXL callback in color value', () => {
    const ctx = createRenderConfigContext({
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    })
    expect(ctx.color1.isCallback).toBe(true)
    expect(ctx.color1.value).toBe('goldenrod')
  })

  it('handles compact display mode', () => {
    const ctx = createRenderConfigContext({ displayMode: 'compact' })
    expect(ctx.displayMode).toBe('compact')
    expect(ctx.heightMultiplier).toBe(0.6)
    expect(ctx.labelAllowed).toBe(true)
  })

  it('handles collapse display mode', () => {
    const ctx = createRenderConfigContext({ displayMode: 'collapse' })
    expect(ctx.labelAllowed).toBe(false)
  })

  it('reads nested labels config', () => {
    const ctx = createRenderConfigContext({
      labels: { fontSize: 14, nameColor: 'red' },
    })
    expect(ctx.fontHeight.value).toBe(14)
    expect(ctx.nameColor.value).toBe('red')
  })

  it('end-to-end: JEXL color evaluated per-feature', () => {
    const config = {
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    }
    const ctx = createRenderConfigContext(config)

    const snvResult = readCachedConfig(
      ctx.color1,
      ctx.config,
      'color1',
      mockFeature({ type: 'SNV' }),
    )
    expect(snvResult).toBe('green')

    const indelResult = readCachedConfig(
      ctx.color1,
      ctx.config,
      'color1',
      mockFeature({ type: 'insertion' }),
    )
    expect(indelResult).toBe('purple')
  })
})
