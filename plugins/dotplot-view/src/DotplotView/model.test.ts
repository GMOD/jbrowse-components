import { createTestSession } from '@jbrowse/web/src/rootModel/test_util'
import { getEnv } from 'mobx-state-tree'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { pluginManager } = getEnv(createTestSession() as any)

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
