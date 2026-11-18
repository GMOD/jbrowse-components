import { openDB } from 'idb'

import { idbConnection } from './idbConnection.ts'

import type { DBSchema, OpenDBCallbacks } from 'idb'

jest.mock('idb', () => ({ openDB: jest.fn() }))

type Callbacks = OpenDBCallbacks<unknown>

interface TwoStores extends DBSchema {
  a: { key: string; value: string }
  b: { key: string; value: string }
}

function fakeConnection() {
  return { close: jest.fn() }
}

// each openDB call's callbacks, in call order
const opens: Callbacks[] = []

beforeEach(() => {
  opens.length = 0
  jest.mocked(openDB).mockReset()
})

function opensWith(...results: (object | Error)[]) {
  for (const result of results) {
    jest
      .mocked(openDB)
      .mockImplementationOnce(async (_name, _version, callbacks = {}) => {
        opens.push(callbacks)
        if (result instanceof Error) {
          throw result
        }
        return result as Awaited<ReturnType<typeof openDB>>
      })
  }
}

test('callers share one connection', async () => {
  const conn = fakeConnection()
  opensWith(conn)
  const get = idbConnection('db', 1, [])
  expect(await get()).toBe(await get())
  expect(openDB).toHaveBeenCalledTimes(1)
})

test('a failed open is retried by the next call', async () => {
  const conn = fakeConnection()
  opensWith(new Error('blocked'), conn)
  const get = idbConnection('db', 1, [])
  await expect(get()).rejects.toThrow('blocked')
  expect(await get()).toBe(conn)
})

test('a connection the browser terminated is reopened', async () => {
  const first = fakeConnection()
  const second = fakeConnection()
  opensWith(first, second)
  const get = idbConnection('db', 1, [])
  await get()
  opens[0]!.terminated!()
  expect(await get()).toBe(second)
})

test("another tab's upgrade closes this connection and the next call reopens", async () => {
  const first = fakeConnection()
  const second = fakeConnection()
  opensWith(first, second)
  const get = idbConnection('db', 1, [])
  await get()
  opens[0]!.blocking!(1, 2, new Event('versionchange') as IDBVersionChangeEvent)
  expect(await get()).toBe(second)
  expect(first.close).toHaveBeenCalled()
  expect(second.close).not.toHaveBeenCalled()
})

test('a late callback from an old connection keeps the newer one', async () => {
  const first = fakeConnection()
  const second = fakeConnection()
  opensWith(first, second)
  const get = idbConnection('db', 1, [])
  await get()
  opens[0]!.terminated!()
  await get()
  opens[0]!.terminated!()
  expect(await get()).toBe(second)
  expect(openDB).toHaveBeenCalledTimes(2)
})

test('upgrade creates only the stores that are missing', async () => {
  opensWith(fakeConnection())
  const get = idbConnection<TwoStores>('db', 2, ['a', 'b'])
  await get()
  const createObjectStore = jest.fn()
  const db = {
    objectStoreNames: { contains: (name: string) => name === 'a' },
    createObjectStore,
  }
  opens[0]!.upgrade!(
    db as unknown as Parameters<NonNullable<Callbacks['upgrade']>>[0],
    1,
    2,
    {} as Parameters<NonNullable<Callbacks['upgrade']>>[3],
    new Event('upgradeneeded') as IDBVersionChangeEvent,
  )
  expect(createObjectStore).toHaveBeenCalledTimes(1)
  expect(createObjectStore).toHaveBeenCalledWith('b')
})
