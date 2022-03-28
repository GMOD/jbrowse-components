import WebRPC from '../src/'
import EventEmitter from 'events'
class EventTarget extends EventEmitter {
  addEventListener(event, listener) {
    this.on(event, listener)
  }
}

function wait(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

const mockSelf = new EventTarget()
jest.spyOn(global, 'self', 'get').mockImplementation(() => mockSelf)
mockSelf.postMessage = function (data) {
  mockWorker.emit('message', { data })
}

const mockWorker = new EventTarget()
global.worker = mockWorker
mockWorker.postMessage = function (data) {
  mockSelf.emit('message', { data })
}
const client = new WebRPC.Client({
  workers: [mockWorker],
})

const server = new WebRPC.Server({
  add({ x, y }) {
    return x + y
  },
  task() {
    return wait(1000).then(() => 'done')
  },
  error() {
    // eslint-disable-next-line no-undef
    return err
  }, // eslint-disable-line
  transfer(buffer) {
    return { buffer }
  },
})

test('RpcServer.constructor()', () => {
  expect(server instanceof WebRPC.Server).toBeTruthy()
  expect(Object.keys(server.methods)).toEqual([
    'add',
    'task',
    'error',
    'transfer',
  ])
  expect(mockSelf.eventNames()).toEqual(['message'])
})

test('RpcServer.emit()', () => {
  function listener(data) {
    expect(data).toEqual({ foo: 'bar' })
  }
  client.on('event', listener)
  server.emit('event', { foo: 'bar' })
  client.off('event', listener)
  server.emit('event', { foo: 'bar' })
})

test('RpcClient.constructor() should create new RPC client', () => {
  expect(client instanceof WebRPC.Client).toBeTruthy()
  expect(client.workers.length).toEqual(1)
  expect(global.worker.eventNames()).toEqual(['message', 'error'])
  global.worker.emit('error', {
    message: 'Some error',
    lineno: 42,
    filename: 'worker.js',
  })
})

test('RpcClient.call()', async () => {
  const result = await client.call('add', { x: 1, y: 1 })
  expect(result).toBe(2)
  expect(client.idx).toBe(0)
  await expect(() => client.call('length')).rejects.toThrow()
  await expect(() =>
    client.call('task', null, { timeout: 100 }),
  ).rejects.toThrow()
  await expect(() => client.call('error')).rejects.toThrowError(
    'err is not defined',
  )

  const buffer = new ArrayBuffer(0xff)

  const r = await client.call('transfer', buffer)
  expect(r.buffer).toEqual(buffer)
})
