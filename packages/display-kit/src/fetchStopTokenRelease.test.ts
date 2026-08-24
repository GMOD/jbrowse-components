import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { destroy, types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'

import type { FetchContext } from './FetchMixin.ts'

// The leak this guards against — a stop token never released when a fetch ends,
// so the token keeps holding the AbortSignal controllers taken against it until
// some later fetch supersedes it — is invisible functionally, so assert the
// release call directly. Wrap the real stopStopToken so behavior is unchanged
// and only observable. (Before the message path this was a blob-URL leak; the
// release is still required, for a different resource.)
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

describe('FetchMixin: stop-token release', () => {
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
