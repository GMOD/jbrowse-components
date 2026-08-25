// Direct tests for the dependent-fetch skeleton the multi-way display installs
// twice, for lane genes and for lane links.
//
// The invariant under test is the in-flight key's bookkeeping. A commit is
// stale-checked against the specs as they stand when it lands, so a fetch whose
// specs changed underneath it is DROPPED — and the body has to be able to tell
// "already fetching this" from "fetched this and threw the answer away", or the
// second one is indistinguishable from the first and the fetch never re-issues.

import { types } from '@jbrowse/mobx-state-tree'

import { installKeyedFetch } from './installKeyedFetch.ts'

const DELAY = 10

const settle = (n = 6) => new Promise(resolve => setTimeout(resolve, DELAY * n))

const TestHost = types
  .model('TestHost', { id: types.optional(types.identifier, 'h1') })
  .volatile(() => ({ specs: ['a'] as string[] }))
  .actions(self => ({
    setSpecs(specs: string[]) {
      self.specs = specs
    },
  }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function install(
  fetchOne: (spec: string) => Promise<readonly [string, string]>,
) {
  const host = TestHost.create()
  const commits: { key: string; entries: string[] }[] = []
  installKeyedFetch<string, string>(host, {
    name: 'TestFetch',
    delay: DELAY,
    specsOf: () => ({ key: host.specs.join(','), specs: [...host.specs] }),
    fetchOne: spec => fetchOne(spec),
    commit: (key, entries) => {
      commits.push({ key, entries: [...entries.values()] })
    },
  })
  return { host, commits }
}

test('commits once per key and skips a key it has already answered', async () => {
  const calls: string[] = []
  const { host, commits } = install(async spec => {
    calls.push(spec)
    return [spec, `${spec}!`] as const
  })
  await settle()
  expect(commits).toEqual([{ key: 'a', entries: ['a!'] }])

  host.setSpecs(['b'])
  await settle()
  expect(commits.at(-1)).toEqual({ key: 'b', entries: ['b!'] })

  // the same specs again: already committed, so no second round trip
  const before = calls.length
  host.setSpecs(['b'])
  await settle()
  expect(calls.length).toBe(before)
})

// The regression. Emptying the specs while a fetch is in flight drops that
// fetch's result on the stale check, so the key it was issued for must stop
// counting as in flight — otherwise coming back to it declines forever and
// nothing ever commits.
test('refetches a key whose in-flight result was dropped by the specs going empty', async () => {
  const calls: string[] = []
  const gate = deferred<void>()
  const { host, commits } = install(async spec => {
    calls.push(spec)
    await gate.promise
    return [spec, `${spec}!`] as const
  })
  await settle()
  expect(calls).toEqual(['a'])

  // the view moves somewhere with nothing to fetch, while 'a' is still out
  host.setSpecs([])
  await settle()
  gate.resolve()
  await settle()
  // that result was for specs nobody is asking for any more
  expect(commits).toEqual([])

  // and back to exactly where it was
  host.setSpecs(['a'])
  await settle()
  expect(calls).toEqual(['a', 'a'])
  expect(commits).toEqual([{ key: 'a', entries: ['a!'] }])
})

test('a failed fetch commits an empty result rather than never committing', async () => {
  jest.spyOn(console, 'error').mockImplementation()
  const { commits } = install(async () => {
    throw new Error('nope')
  })
  await settle()
  expect(commits).toEqual([{ key: 'a', entries: [] }])
})

test('a superseded fetch does not commit under the key that replaced it', async () => {
  const gates = new Map<string, ReturnType<typeof deferred<void>>>()
  const { host, commits } = install(async spec => {
    const gate = deferred<void>()
    gates.set(spec, gate)
    await gate.promise
    return [spec, `${spec}!`] as const
  })
  await settle()
  host.setSpecs(['b'])
  await settle()
  // 'a' lands late, after 'b' took over
  gates.get('a')!.resolve()
  await settle()
  expect(commits).toEqual([])

  gates.get('b')!.resolve()
  await settle()
  expect(commits).toEqual([{ key: 'b', entries: ['b!'] }])
})
