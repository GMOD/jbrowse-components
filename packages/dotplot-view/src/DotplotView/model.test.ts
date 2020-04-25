import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { pluginManager } = createTestSession() as any

describe('dotplot state model', () => {
  test('can instantiate from an empty object', () => {
    const DotplotModel = pluginManager.jbrequire(require('./model'))
    expect(() =>
      DotplotModel.create({
        type: 'DotplotView',
      }),
    ).not.toThrow()
  })
})
