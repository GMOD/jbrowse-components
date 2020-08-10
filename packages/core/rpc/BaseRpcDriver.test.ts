import { watchWorker } from './BaseRpcDriver'

function timeout(ms: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

class MockWorkerHandle {
  busy = false

  destroy() {}

  async call(
    name: string,
    args = [],
    opts: { timeout: number } = { timeout: 3000 },
  ) {
    const start = Date.now()
    if (name === 'ping') {
      while (this.busy) {
        if (opts.timeout > Date.now() - start) {
          throw new Error('timeout')
        }

        // eslint-disable-next-line no-await-in-loop
        await timeout(500)
      }
    }
    if (name === 'doWork') {
      this.busy = true
      await timeout(2000)
      this.busy = false
    }
  }
}
test('watch worker', async () => {
  const worker = new MockWorkerHandle()

  try {
    const workerWatcher = watchWorker(worker, 100)
    worker.call('doWork')
    await workerWatcher // should throw
  } catch (e) {
    expect(e.message).toMatch(/timeout/)
  }
})
