import { createSharedSetup } from './createSharedSetup.ts'

import type { RpcStatus } from './progress.ts'

describe('createSharedSetup', () => {
  it('runs the work once and hands every caller the same result', async () => {
    let runs = 0
    const setup = createSharedSetup(async () => {
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
    const setup = createSharedSetup(
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
    const setup = createSharedSetup(
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
    const setup = createSharedSetup(async opts => {
      received = opts.stopToken
      return 'records'
    })
    await setup({ stopToken: 'token' })
    expect(received).toBeUndefined()
  })

  it('clears the memo on failure so the next caller retries', async () => {
    let runs = 0
    const setup = createSharedSetup(async () => {
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
})
