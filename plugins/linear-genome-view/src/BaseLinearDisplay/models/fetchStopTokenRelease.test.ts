import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { destroy, types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'

import type { FetchContext } from './FetchMixin.ts'

// The leak this guards against — a blob-URL stop token (the non-SAB fallback)
// never revoked when a fetch ends — is invisible functionally, so assert the
// release call directly. Wrap the real stopStopToken so behavior is unchanged
// and only observable.
jest.mock('@jbrowse/core/util/stopToken', () => {
  const actual = jest.requireActual('@jbrowse/core/util/stopToken')
  return {
    __esModule: true,
    ...actual,
    stopStopToken: jest.fn(actual.stopStopToken),
  }
})

const released = stopStopToken as jest.Mock

beforeEach(() => released.mockClear())

const TestModel = types.compose('Test', FetchMixin(), types.model({}))
const tick = () => Promise.resolve()

describe('FetchMixin: stop-token release (blob-URL leak guard)', () => {
  it('releases the stop token when a fetch completes normally', async () => {
    const m = TestModel.create({})
    let token: unknown
    await m.runFetch(async (ctx: FetchContext) => {
      token = ctx.stopToken
    })
    await tick()
    expect(released).toHaveBeenCalledWith(token)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('releases an in-flight token on beforeDestroy (teardown mid-fetch)', () => {
    const m = TestModel.create({})
    void m.runFetch(() => new Promise<void>(() => {})) // never resolves
    const token = m.activeStopToken
    destroy(m)
    expect(released).toHaveBeenCalledWith(token)
  })
})
