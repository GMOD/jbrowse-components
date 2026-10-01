import {
  ABANDONED_SETUP_GRACE_MS,
  cachedSetup,
  createSharedSetup,
} from './cachedSetup.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/types.ts'
import type { RpcStatus } from './progress.ts'

// The five below were `createSharedSetup`'s, and are the contract the unified
// helper had to keep. They run against `cachedSetup` because that is now the
// implementation; `createSharedSetup` is its alias, covered at the bottom.
function sharedSetup<T>(run: (opts: BaseOptions) => Promise<T>) {
  return cachedSetup({ setup: run })
}

describe('cachedSetup', () => {
  it('runs the work once and hands every caller the same result', async () => {
    let runs = 0
    const setup = sharedSetup(async () => {
      runs++
      return 'records'
    })
    expect(await Promise.all([setup(), setup()])).toEqual([
      'records',
      'records',
    ])
    expect(runs).toBe(1)
  })

  it('reports to a caller that joined after the work started', async () => {
    // the bug this exists for: the memo used to capture the FIRST caller's
    // statusCallback, so a fetch superseded mid-parse left its replacement
    // waiting on a silent promise behind a blank loading overlay
    const seen: RpcStatus[] = []
    let emit: (status: RpcStatus) => void = () => {}
    const setup = sharedSetup(
      opts =>
        new Promise<string>(resolve => {
          emit = status => {
            opts.statusCallback?.(status)
            resolve('records')
          }
        }),
    )
    const first = setup({ statusCallback: () => {} })
    const second = setup({
      statusCallback: s => {
        seen.push(s)
      },
    })
    emit('Parsing PAF')
    await Promise.all([first, second])
    expect(seen).toEqual(['Parsing PAF'])
  })

  it('stops reporting to a caller that has already resolved', async () => {
    const seen: RpcStatus[] = []
    let emit: (status: RpcStatus) => void = () => {}
    let finish: () => void = () => {}
    const setup = sharedSetup(
      opts =>
        new Promise<string>(resolve => {
          emit = status => {
            opts.statusCallback?.(status)
          }
          finish = () => {
            resolve('records')
          }
        }),
    )
    const done = setup({
      statusCallback: s => {
        seen.push(s)
      },
    })
    finish()
    await done
    emit('Computing identities')
    expect(seen).toEqual([])
  })

  it('hands the setup a shared signal, not the caller own', async () => {
    let received: AbortSignal | undefined
    const setup = sharedSetup(async opts => {
      received = opts.signal
      return 'records'
    })
    const own = new AbortController().signal
    await setup({ signal: own })
    expect(received).toBeInstanceOf(AbortSignal)
    expect(received).not.toBe(own)
  })

  it('aborts the shared work only when the last live waiter aborts', async () => {
    let shared: AbortSignal | undefined
    let land: (v: string) => void = () => {}
    const setup = sharedSetup(opts => {
      shared = opts.signal
      return new Promise<string>(resolve => {
        land = resolve
      })
    })
    const a = new AbortController()
    const b = new AbortController()
    const first = setup({ signal: a.signal })
    const second = setup({ signal: b.signal })
    a.abort()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(shared!.aborted).toBe(false)
    land('records')
    expect(await second).toBe('records')
  })

  describe('after the last waiter aborts', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    function pendingSetup() {
      const runs: { signal: AbortSignal; land: (v: string) => void }[] = []
      const setup = sharedSetup(
        opts =>
          new Promise<string>((resolve, reject) => {
            const signal = opts.signal!
            runs.push({ signal, land: resolve })
            signal.addEventListener('abort', () => {
              reject(new Error('aborted'))
            })
          }),
      )
      return { runs, setup }
    }

    it('lets a replacement joining within the grace window keep the setup', async () => {
      const { runs, setup } = pendingSetup()
      let call = new AbortController()
      const superseded = [setup({ signal: call.signal })]
      for (let i = 0; i < 5; i++) {
        call.abort()
        jest.advanceTimersByTime(ABANDONED_SETUP_GRACE_MS - 1)
        call = new AbortController()
        superseded.push(setup({ signal: call.signal }))
      }
      const latest = superseded.pop()!
      for (const p of superseded) {
        await expect(p).rejects.toMatchObject({ name: 'AbortError' })
      }
      jest.advanceTimersByTime(ABANDONED_SETUP_GRACE_MS)
      runs[0]!.land('records')
      expect(await latest).toBe('records')
      expect(runs).toHaveLength(1)
    })

    it('aborts the shared signal once the window passes, and the next call starts fresh', async () => {
      const { runs, setup } = pendingSetup()
      const a = new AbortController()
      const first = setup({ signal: a.signal })
      a.abort()
      await expect(first).rejects.toMatchObject({ name: 'AbortError' })
      expect(runs[0]!.signal.aborted).toBe(false)
      jest.advanceTimersByTime(ABANDONED_SETUP_GRACE_MS)
      expect(runs[0]!.signal.aborted).toBe(true)
      const second = setup()
      expect(runs).toHaveLength(2)
      expect(runs[1]!.signal.aborted).toBe(false)
      runs[1]!.land('records')
      expect(await second).toBe('records')
    })

    it('keeps an abandoned run from reporting to the next run', async () => {
      const emits: ((s: RpcStatus) => void)[] = []
      const setup = sharedSetup(
        opts =>
          new Promise<string>(() => {
            emits.push(opts.statusCallback!)
          }),
      )
      const a = new AbortController()
      const first = setup({ signal: a.signal, statusCallback: () => {} })
      a.abort()
      await expect(first).rejects.toMatchObject({ name: 'AbortError' })
      jest.advanceTimersByTime(ABANDONED_SETUP_GRACE_MS)
      const seen: RpcStatus[] = []
      void setup({
        statusCallback: s => {
          seen.push(s)
        },
      })
      emits[0]!('Parsing PAF from the abandoned run')
      emits[1]!('Parsing PAF')
      expect(seen).toEqual(['Parsing PAF'])
    })

    it('starts fresh for a call made from inside the shared abort', async () => {
      let recalled: Promise<string> | undefined
      const { runs, setup } = pendingSetup()
      const a = new AbortController()
      const first = setup({ signal: a.signal })
      runs[0]!.signal.addEventListener('abort', () => {
        recalled = setup()
        recalled.catch(() => {})
      })
      a.abort()
      await expect(first).rejects.toMatchObject({ name: 'AbortError' })
      jest.advanceTimersByTime(ABANDONED_SETUP_GRACE_MS)
      expect(runs).toHaveLength(2)
      runs[1]!.land('records')
      expect(await recalled).toBe('records')
    })
  })

  it('never aborts the work for a waiter with no signal', async () => {
    let shared: AbortSignal | undefined
    let land: (v: string) => void = () => {}
    const setup = sharedSetup(opts => {
      shared = opts.signal
      return new Promise<string>(resolve => {
        land = resolve
      })
    })
    const a = new AbortController()
    const first = setup({ signal: a.signal })
    const second = setup()
    a.abort()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(shared!.aborted).toBe(false)
    land('records')
    expect(await second).toBe('records')
  })

  it('does not start the work for an already-aborted caller', async () => {
    let runs = 0
    const setup = sharedSetup(async () => {
      runs++
      return 'records'
    })
    const a = new AbortController()
    a.abort()
    await expect(setup({ signal: a.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(runs).toBe(0)
  })

  it('keeps reporting to a shared statusCallback while one of two calls remains', async () => {
    const seen: RpcStatus[] = []
    const statusCallback = (s: RpcStatus) => {
      seen.push(s)
    }
    let emit: (status: RpcStatus) => void = () => {}
    let land: (v: string) => void = () => {}
    const setup = sharedSetup(
      opts =>
        new Promise<string>(resolve => {
          emit = opts.statusCallback!
          land = resolve
        }),
    )
    const a = new AbortController()
    const first = setup({ statusCallback, signal: a.signal })
    const second = setup({ statusCallback })
    a.abort()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    emit('Parsing PAF')
    land('records')
    await second
    expect(seen).toEqual(['Parsing PAF'])
  })

  it('clears the memo on failure so the next caller retries', async () => {
    let runs = 0
    const setup = sharedSetup(async () => {
      runs++
      if (runs === 1) {
        throw new Error('network')
      }
      return 'records'
    })
    await expect(setup()).rejects.toThrow('network')
    expect(await setup()).toBe('records')
    expect(runs).toBe(2)
  })

  it('labels only the first attempt, so re-entry does not re-flash it', async () => {
    const seen: RpcStatus[][] = []
    const setup = cachedSetup({
      label: 'Downloading index',
      setup: async () => 'index',
    })
    for (let i = 0; i < 2; i++) {
      const statuses: RpcStatus[] = []
      seen.push(statuses)
      await setup({
        statusCallback: s => {
          statuses.push(s)
        },
      })
    }
    // first caller sees the label open and retire; the second, awaiting a
    // resident index, sees nothing at all
    expect(seen[0]).toEqual(['Downloading index', ''])
    expect(seen[1]).toEqual([])
  })

  it('re-labels after a failure, because the retry is a first attempt again', async () => {
    let runs = 0
    const setup = cachedSetup({
      label: 'Downloading index',
      setup: async () => {
        runs++
        if (runs === 1) {
          throw new Error('network')
        }
        return 'index'
      },
    })
    const statuses: RpcStatus[] = []
    const statusCallback = (s: RpcStatus) => {
      statuses.push(s)
    }
    await expect(setup({ statusCallback })).rejects.toThrow('network')
    await setup({ statusCallback })
    expect(statuses.filter(s => s === 'Downloading index')).toHaveLength(2)
  })

  it('labels every caller that arrives before the first attempt lands', async () => {
    let land: (v: string) => void = () => {}
    const setup = cachedSetup({
      label: 'Downloading index',
      setup: () =>
        new Promise<string>(resolve => {
          land = resolve
        }),
    })
    const second: RpcStatus[] = []
    const first = setup({ statusCallback: () => {} })
    const joined = setup({
      statusCallback: s => {
        second.push(s)
      },
    })
    land('index')
    await Promise.all([first, joined])
    // the label is opened per call, not memoized with the work, so a caller
    // joining mid-download still gets told what it is waiting on
    expect(second).toEqual(['Downloading index', ''])
  })
})

describe('createSharedSetup', () => {
  // a published `@jbrowse/core/util` export with no in-repo caller, so this is
  // the only thing keeping the alias honest
  it('is cachedSetup with no label', async () => {
    let runs = 0
    const setup = createSharedSetup(async () => {
      runs++
      return 'records'
    })
    expect(
      await Promise.all([
        setup(),
        setup({ signal: new AbortController().signal }),
      ]),
    ).toEqual(['records', 'records'])
    expect(runs).toBe(1)
  })
})
