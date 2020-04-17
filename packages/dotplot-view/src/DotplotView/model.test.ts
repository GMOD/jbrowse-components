import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'

const { pluginManager } = createTestSession() as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
describe('dotplot state model', () => {
  test('can instantiate from an empty object', () => {
    const DotplotModel = pluginManager.jbrequire(require('./model'))
    expect(() =>
      DotplotModel.create({ type: 'DotplotView', hview: {}, vview: {} }),
    ).not.toThrow()
  })
})
