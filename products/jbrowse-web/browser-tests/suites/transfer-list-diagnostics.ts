// The wording `explainTransferError` keys on, pinned to a real browser.
//
// `packages/core/src/rpc/explainTransferError.ts` reads an index out of the
// DataCloneError that `postMessage` throws, and everything it adds — the field
// name a hand-built transfer list otherwise hides — depends on that index being
// there and being where it says. jsdom does not police transfer lists at all,
// so the unit tests hand the function a message typed out by hand: they check
// what it does with the wording, never that the wording is real.
//
// The failure mode is SILENCE. If Chrome re-words these, the regex stops
// matching, the annotation quietly stops appearing, and the next person to hit
// a detached buffer is back to counting a transfer list out of source. Nothing
// goes red. So this asserts the three sentences, in a worker, which is the
// realm the RPC server posts from.
//
// Measured Chrome 152, worker scope:
//
//   ArrayBuffer at index 19 is already detached.
//   ArrayBuffer at index 2 is a duplicate of an earlier ArrayBuffer.
//   Value at index 0 does not have a transferable type.
//
// It runs on `pnpm test:browser` and NOT in CI: the only browser job on push is
// the cross-backend snapshot gate, whose CI_GATE_SUITES list is a rendering
// oracle. This suite renders nothing, so it does not belong there — it is a
// check to run when the annotation stops being useful, or after a Chrome bump.
import { PORT } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// The transfer list is policed by the worker's own postMessage, so the probe has
// to run inside one. Anything but a blob worker would need a built bundle.
const WORKER_SOURCE = `
self.onmessage = () => {
  const post = (data, transfer) => {
    try {
      self.postMessage(data, transfer)
      return 'OK'
    } catch (e) {
      return e.name + ': ' + e.message
    }
  }

  const shared = new Float32Array(8)
  const dead = new Uint32Array(4).buffer
  dead.transfer()
  const live = new Float32Array(4)

  const out = {
    detached: post({}, [live.buffer, dead]),
    duplicate: post({}, [shared.subarray(0, 4).buffer, shared.subarray(4, 8).buffer]),
    notTransferable: post({}, [{}]),
    unserializable: post({ fn: () => {} }, []),
    // a healthy list transfers, and the buffers really are gone afterwards
    healthy: post({ a: new Uint32Array(2) }, [new Uint32Array(2).buffer]),
    // an empty buffer is transferable, which is worth pinning: it rules out a
    // zero-length result as an explanation for an "already detached" report
    empty: post({}, [new Float32Array(0).buffer, new Uint8Array(0).buffer]),
  }
  self.postMessage({ done: out })
}
`

function runProbe(page: Page) {
  return page.evaluate(async (source: string) => {
    const url = URL.createObjectURL(
      new Blob([source], { type: 'text/javascript' }),
    )
    const worker = new Worker(url)
    try {
      return await new Promise<Record<string, string>>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('worker probe timed out'))
        }, 20000)
        worker.onerror = e => {
          clearTimeout(timer)
          reject(new Error(`worker failed: ${e.message}`))
        }
        worker.onmessage = e => {
          if (e.data?.done) {
            clearTimeout(timer)
            resolve(e.data.done)
          }
        }
        worker.postMessage('go')
      })
    } finally {
      worker.terminate()
      URL.revokeObjectURL(url)
    }
  }, WORKER_SOURCE)
}

function expectMatch(
  results: Record<string, string>,
  key: string,
  pattern: RegExp,
) {
  const actual = results[key]
  if (!actual || !pattern.test(actual)) {
    throw new Error(
      `postMessage wording moved for "${key}": expected ${pattern}, got ${JSON.stringify(actual)}. ` +
        'explainTransferError reads the index out of this sentence — update its regex with it.',
    )
  }
}

const suite: TestSuite = {
  name: 'TransferListDiagnostics',
  tests: [
    {
      name: 'postMessage blames a transfer-list entry by index',
      fn: async page => {
        // any real origin will do — the probe never touches JBrowse, it just
        // needs a page that can spawn a blob worker
        await page.goto(`http://localhost:${PORT}/`, { timeout: 60000 })
        const results = await runProbe(page)

        // the index, which is the only part explainTransferError parses
        expectMatch(results, 'detached', / at index 1\b/)
        expectMatch(results, 'duplicate', / at index 1\b/)
        expectMatch(results, 'notTransferable', / at index 0\b/)

        // the cause, which the browser separates itself — so the annotation
        // never has to guess at it
        expectMatch(results, 'detached', /already detached/)
        expectMatch(results, 'duplicate', /duplicate of an earlier/)
        expectMatch(
          results,
          'notTransferable',
          /does not have a transferable type/,
        )

        // no index here, which is what keeps a payload failure from being
        // decorated with a report about transfers it has nothing to do with
        expectMatch(results, 'unserializable', /could not be cloned/)
        if ((results.unserializable ?? '').includes(' at index ')) {
          throw new Error(
            `an unserializable payload now reports an index: ${results.unserializable}`,
          )
        }

        expectMatch(results, 'healthy', /^OK$/)
        expectMatch(results, 'empty', /^OK$/)
      },
    },
  ],
}

export default suite
