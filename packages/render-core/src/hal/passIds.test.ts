import { MockHal } from './mockHal.ts'
import { assertUniquePassIds } from './passIds.ts'

import type { PipelineDescriptor } from './types.ts'

// Only `id` is read, and a real descriptor carries a compiled shader — so the
// fixture states the one field rather than building twenty that say nothing.
function pass(id: string) {
  return { id } as PipelineDescriptor
}

describe('assertUniquePassIds', () => {
  it('accepts a registry whose ids are all distinct', () => {
    expect(() => {
      assertUniquePassIds([pass('read'), pass('gap'), pass('mismatch')])
    }).not.toThrow()
  })

  it('accepts an empty registry', () => {
    expect(() => {
      assertUniquePassIds([])
    }).not.toThrow()
  })

  it('names the duplicated id', () => {
    expect(() => {
      assertUniquePassIds([pass('read'), pass('gap'), pass('read')])
    }).toThrow(/'read'/)
  })

  // One message listing both beats throwing on the first and making the author
  // re-run to find the second.
  it('names every duplicate, once each', () => {
    let message = ''
    try {
      assertUniquePassIds([
        pass('read'),
        pass('gap'),
        pass('read'),
        pass('gap'),
        pass('read'),
      ])
    } catch (e) {
      message = `${e}`
    }
    expect(message).toContain("'read'")
    expect(message).toContain("'gap'")
    expect(message.match(/'read'/g)).toHaveLength(1)
  })

  // The check has to be reachable from a unit test, not just from
  // `createRenderingBackend` — every backend test builds its MockHal from the
  // display's real registry, so this is what turns those into the guard.
  it('fires when a MockHal is built from a colliding registry', () => {
    expect(() => new MockHal([pass('read'), pass('read')])).toThrow(
      /duplicate pass id/,
    )
  })
})
