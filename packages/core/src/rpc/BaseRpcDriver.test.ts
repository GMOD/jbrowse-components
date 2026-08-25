import PluginManagerCtor from '../PluginManager.ts'
import { makeAbortError } from '../util/aborting.ts'
import { createStopToken, isStopped, stopStopToken } from '../util/stopToken.ts'
import BaseRpcDriver from './BaseRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import type { StatusCallback } from '../util/progress.ts'
import type { StopToken } from '../util/stopToken.ts'

// captures exactly what the call() envelope hands to a driver's transport, so
// we can assert the serialize/statusCallback/deserialize behavior without any
// worker or in-band machinery
class CapturingDriver extends BaseRpcDriver {
  name = 'CapturingDriver'
  transportCalls: {
    rpcMethod: RpcMethodType
    serializedArgs: Record<string, unknown>
    statusCallback: StatusCallback | undefined
  }[] = []

  constructor(pm: PluginManager = pluginManager) {
    super(pm, rpcConfigSchema.create({}))
  }

  protected async transport(
    _sessionId: string,
    rpcMethod: RpcMethodType,
    serializedArgs: Record<string, unknown>,
    statusCallback: StatusCallback | undefined,
  ) {
    this.transportCalls.push({ rpcMethod, serializedArgs, statusCallback })
    return { raw: serializedArgs }
  }
}

const rpcMethod = {
  name: 'SomeMethod',
  serializeArguments: async (args: Record<string, unknown>) => ({
    ...args,
    serialized: true,
  }),
  deserializeReturn: (ret: unknown) => ({ deserialized: ret }),
}
const pluginManager = {
  getRpcMethodType: () => rpcMethod,
} as unknown as PluginManager

describe('BaseRpcDriver.call envelope', () => {
  test('splits statusCallback out of the payload and passes it to transport', async () => {
    const driver = new CapturingDriver()
    const statusCallback = () => {}
    await driver.call('sid', 'SomeMethod', {
      sessionId: 'sid',
      data: 1,
      statusCallback,
    })
    const { serializedArgs, statusCallback: cb } = driver.transportCalls[0]!
    // statusCallback travels out-of-band, the rest is run through serialize
    expect(serializedArgs).toEqual({
      sessionId: 'sid',
      data: 1,
      serialized: true,
    })
    expect(cb).toBe(statusCallback)
  })

  test('deserializes the transport result before returning', async () => {
    const driver = new CapturingDriver()
    const result = await driver.call('sid', 'SomeMethod', {
      sessionId: 'sid',
    })
    expect(result).toEqual({
      deserialized: { raw: { sessionId: 'sid', serialized: true } },
    })
  })

  test('throws without a sessionId', async () => {
    const driver = new CapturingDriver()
    await expect(driver.call('', 'SomeMethod', {})).rejects.toThrow(
      'sessionId is required',
    )
  })

  // An RPC method is addressed by string, so a removed or renamed one fails
  // here and nowhere earlier — and the message has to identify it, since the
  // caller is a bare string in some plugin. `TypeRecord.get` is what answers,
  // and this is the assertion that it still reaches the RPC path.
  test('names the method, and the build, when nothing registers it', async () => {
    const real = new PluginManagerCtor([])
    real.createPluggableElements()
    await expect(
      new CapturingDriver(real).call(
        'sid',
        'MultiVariantGetGenotypeMatrix',
        {},
      ),
    ).rejects.toThrow(
      /RpcMethodType 'MultiVariantGetGenotypeMatrix' is not registered/,
    )
  })

  test('refuses to dispatch a call whose stop token is already stopped', async () => {
    const driver = new CapturingDriver()
    const stopToken = createStopToken()
    stopStopToken(stopToken)
    await expect(
      driver.call('sid', 'SomeMethod', {
        sessionId: 'sid',
        stopToken,
      }),
    ).rejects.toThrow('aborted')
    // nothing serialized, no worker woken, and no stop notification racing the
    // call it was meant to cancel
    expect(driver.transportCalls).toHaveLength(0)
  })

  test('refuses to dispatch when the stop lands during serialization', async () => {
    const stopToken = createStopToken()
    // serializeArguments is where the refName map is resolved, so it is the one
    // long await in call(); a stop arriving here used to wake a worker anyway
    const slowMethod = {
      ...rpcMethod,
      serializeArguments: async (args: Record<string, unknown>) => {
        stopStopToken(stopToken)
        return { ...args, serialized: true }
      },
    }
    const driver = new CapturingDriver({
      getRpcMethodType: () => slowMethod,
    } as unknown as PluginManager)
    await expect(
      driver.call('sid', 'SomeMethod', { sessionId: 'sid', stopToken }),
    ).rejects.toThrow('aborted')
    expect(driver.transportCalls).toHaveLength(0)
  })

  test('dispatches normally for a live stop token', async () => {
    const driver = new CapturingDriver()
    await driver.call('sid', 'SomeMethod', {
      sessionId: 'sid',
      stopToken: createStopToken(),
    })
    expect(driver.transportCalls).toHaveLength(1)
  })

  test('destroy is a no-op by default', () => {
    const driver = new CapturingDriver()
    expect(() => {
      driver.destroy()
    }).not.toThrow()
  })

  // A call the caller put a bound on. The bound is opt-in and there is no
  // default, so the first test here is the one that matters most: an ordinary
  // call must be byte-for-byte what it was.
  describe('the caller-supplied timeout', () => {
    // A blob-URL string is what a deployment actually gets — SharedArrayBuffer
    // needs COOP/COEP that an embeddable library cannot require of its host
    // page, and jest is cross-origin isolated where the browser is not. So the
    // composition below is asserted on the path that ships.
    const stringToken = () => `test-token-${Math.random()}`

    test('no timeout leaves the caller token as the one on the wire', async () => {
      const driver = new CapturingDriver()
      const stopToken = stringToken()
      await driver.call('sid', 'SomeMethod', { sessionId: 'sid', stopToken })
      expect(driver.transportCalls[0]!.serializedArgs.stopToken).toBe(stopToken)
    })

    test('a timeout swaps in its own token and is not itself sent', async () => {
      const driver = new CapturingDriver()
      const stopToken = stringToken()
      await driver.call('sid', 'SomeMethod', {
        sessionId: 'sid',
        stopToken,
        timeout: 30_000,
      })
      const { serializedArgs } = driver.transportCalls[0]!
      expect(serializedArgs.stopToken).not.toBe(stopToken)
      expect(serializedArgs.stopToken).toBeDefined()
      // the worker has nothing to do with the number, and a value it can read
      // is a second place to interpret one
      expect(serializedArgs).not.toHaveProperty('timeout')
    })

    // The whole of "composes with, never replaces". Sending the deadline's
    // token instead of the caller's would take cancellation off the call: a
    // superseded fetch stops its token and the worker would never hear.
    test('a caller stop still reaches the token the worker is watching', async () => {
      let release = () => {}
      const held = new Promise<void>(resolve => {
        release = resolve
      })
      const driver = new (class extends CapturingDriver {
        protected override async transport(
          sessionId: string,
          method: RpcMethodType,
          serializedArgs: Record<string, unknown>,
          statusCallback: StatusCallback | undefined,
        ) {
          const r = await super.transport(
            sessionId,
            method,
            serializedArgs,
            statusCallback,
          )
          await held
          return r
        }
      })()
      const stopToken = stringToken()
      // in flight, which is the only window composition means anything in —
      // `dispose` stops the deadline's token once the call is over either way
      const call = driver.call('sid', 'SomeMethod', {
        sessionId: 'sid',
        stopToken,
        timeout: 30_000,
      })
      await Promise.resolve()
      await Promise.resolve()
      const wire = driver.transportCalls[0]!.serializedArgs.stopToken as
        | StopToken
        | undefined
      expect(isStopped(wire)).toBe(false)
      stopStopToken(stopToken)
      expect(isStopped(wire)).toBe(true)
      release()
      await call
    })

    // `stopStopToken`'s own docstring: call it when an operation ENDS, not only
    // when cancelling one, or the token pins the signal controllers taken
    // against it until something else supersedes it.
    test('the deadline token is stopped once the call is over', async () => {
      const driver = new CapturingDriver()
      await driver.call('sid', 'SomeMethod', {
        sessionId: 'sid',
        stopToken: stringToken(),
        timeout: 30_000,
      })
      const wire = driver.transportCalls[0]!.serializedArgs.stopToken as
        | StopToken
        | undefined
      expect(isStopped(wire)).toBe(true)
    })

    test('an already-stopped caller token is still refused before dispatch', async () => {
      const driver = new CapturingDriver()
      const stopToken = stringToken()
      stopStopToken(stopToken)
      await expect(
        driver.call('sid', 'SomeMethod', {
          sessionId: 'sid',
          stopToken,
          timeout: 30_000,
        }),
      ).rejects.toThrow('aborted')
      expect(driver.transportCalls).toHaveLength(0)
    })

    // The failure a deadline exists for: a worker spinning without yielding
    // never reads its stop token, so stopping alone settles nothing.
    test('a transport that never settles rejects with the deadline', async () => {
      const wedged = new (class extends CapturingDriver {
        protected override async transport(
          sessionId: string,
          method: RpcMethodType,
          serializedArgs: Record<string, unknown>,
          statusCallback: StatusCallback | undefined,
        ) {
          await super.transport(
            sessionId,
            method,
            serializedArgs,
            statusCallback,
          )
          return new Promise<never>(() => {})
        }
      })()
      await expect(
        wedged.call('sid', 'SomeMethod', { sessionId: 'sid', timeout: 20 }),
      ).rejects.toThrow(/SomeMethod did not finish within 0\.02s/)
      // and the work was told to stop, not merely abandoned behind a rejected
      // promise still holding its pool slot
      const wire = wedged.transportCalls[0]!.serializedArgs.stopToken
      expect(isStopped(wire as StopToken)).toBe(true)
    })

    // A cooperative worker DOES reject, with the abort its stopped token threw
    // — true, and useless. Expiry rejects synchronously with the timer, so it
    // wins that race and the caller reads why the call stopped instead.
    const rejectingAt = (ms: number) =>
      new (class extends CapturingDriver {
        protected override async transport(
          sessionId: string,
          method: RpcMethodType,
          serializedArgs: Record<string, unknown>,
          statusCallback: StatusCallback | undefined,
        ) {
          await super.transport(
            sessionId,
            method,
            serializedArgs,
            statusCallback,
          )
          return new Promise<never>((_resolve, reject) => {
            setTimeout(() => {
              reject(makeAbortError())
            }, ms)
          })
        }
      })()

    test('a cooperative abort at expiry is reported as the timeout', async () => {
      await expect(
        rejectingAt(60).call('sid', 'SomeMethod', {
          sessionId: 'sid',
          timeout: 20,
        }),
      ).rejects.toThrow(/did not finish within/)
    })

    // The other side of that ordering, and the reason nothing downstream
    // rewrites the rejection: an abort that genuinely beat the deadline is an
    // abort, and calling it a timeout would blame the wrong thing.
    test('an abort that beats the deadline stays an abort', async () => {
      await expect(
        rejectingAt(10).call('sid', 'SomeMethod', {
          sessionId: 'sid',
          timeout: 5000,
        }),
      ).rejects.toThrow('aborted')
    })

    test('a call that beats its deadline is unaffected', async () => {
      const driver = new CapturingDriver()
      const result = await driver.call('sid', 'SomeMethod', {
        sessionId: 'sid',
        timeout: 30_000,
      })
      expect(result).toEqual({
        deserialized: {
          raw: {
            sessionId: 'sid',
            serialized: true,
            stopToken: expect.anything(),
          },
        },
      })
    })

    test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
      'a timeout of %p is no timeout at all',
      async timeout => {
        const driver = new CapturingDriver()
        const stopToken = stringToken()
        await driver.call('sid', 'SomeMethod', {
          sessionId: 'sid',
          stopToken,
          timeout,
        })
        expect(driver.transportCalls[0]!.serializedArgs.stopToken).toBe(
          stopToken,
        )
      },
    )
  })

  // The default is the main-thread one: run the method here, where the adapter
  // cache a driver without a worker fills actually lives. It does NOT go
  // through `call` — a free is a lifecycle operation, and routing it through
  // the call path is what made the pooled driver boot a worker for it.
  test('freeSession runs CoreFreeResources in this realm', async () => {
    const driver = new CapturingDriver()
    const invoked: unknown[] = []
    const freeMethod = {
      name: 'CoreFreeResources',
      invoke: async (args: unknown) => {
        invoked.push(args)
      },
    }
    await new CapturingDriver({
      getRpcMethodType: () => freeMethod,
    } as unknown as PluginManager).freeSession('sid')
    expect(invoked).toEqual([{ sessionId: 'sid' }])
    expect(driver.transportCalls).toEqual([])
  })
})
