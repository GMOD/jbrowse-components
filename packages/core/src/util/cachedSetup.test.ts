import { cachedSetup, createSharedSetup } from './cachedSetup.ts'

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

  it('withholds the stop token, so one caller cannot abort the shared work', async () => {
    let received: unknown = 'unset'
    const setup = sharedSetup(async opts => {
      received = opts.stopToken
      return 'records'
    })
    await setup({ stopToken: 'token' })
    expect(received).toBeUndefined()
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
    let received: unknown = 'unset'
    const setup = createSharedSetup(async opts => {
      runs++
      received = opts.stopToken
      return 'records'
    })
    expect(await Promise.all([setup(), setup({ stopToken: 'token' })])).toEqual(
      ['records', 'records'],
    )
    expect(runs).toBe(1)
    expect(received).toBeUndefined()
  })
})
