import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'

const { pluginManager } = createTestSession()

describe('dotplot state model', () => {
  test('can instantiate from an empty object', () => {
    const DotplotModel = pluginManager.jbrequire(require('./model'))
    const model = DotplotModel.create({ type: 'DotplotView' })
  })
})
