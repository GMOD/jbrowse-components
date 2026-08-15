/* eslint-disable no-console */
// A track backed by a BlobLocation — a file the user opened off their own disk
// — rendering in a real web worker.
//
// The worker's blob map is module-global and is installed by exactly one thing:
// `RpcMethodType.deserializeArguments`, reached from `invoke`, which is what
// rpcWorker binds per method. Nothing else in the worker realm calls
// `setBlobMap`. So a BlobLocation that resolves there is proof the chain is
// wired, and a broken one cannot pass by accident: an unset map makes
// `getBlob(blobId)` undefined and `openLocation` throws before a byte is read.
//
// Worth a real browser rather than a jest fake, because the failure this guards
// is a *realm* failure. Every unit test runs the worker's code in the same
// realm as the main thread's, where the blob map is already populated and a
// method that never installs it reads the right answer by accident.
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

const TRACK_ID = 'blob-location-probe'
const FILE = 'test_data/volvox/volvox_microarray.bw'

async function main() {
  const { server, port } = await startServerOnFreePort(3399)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()

  const errors: string[] = []
  const workers: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e}`))
  page.on('console', m => {
    if (m.type() === 'error') {
      errors.push(`console.error: ${m.text()}`)
    }
  })
  page.on('workercreated', w => workers.push(w.url()))

  const spec = {
    views: [
      { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
    ],
  }
  const url =
    `http://localhost:${port}/?config=test_data/volvox/config.json` +
    `&session=${encodeSessionSpec(spec)}&sessionName=BlobLocationProbe` +
    `&renderer=canvas2d`
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForFunction(() => !!(window as any).JBrowseSession, {
    timeout: 30000,
  })

  // Fetch the bytes and hand them in as a File, which is what the file input in
  // LocalFileChooser produces. `storeBlobLocation` is the same core module the
  // RPC layer reads `getBlobMap()` from, reached the way a runtime plugin would.
  const blobId = await page.evaluate(
    async ({ trackId, file }) => {
      const w = window as any
      const util = w.JBrowseRootModel.pluginManager.lib['@jbrowse/core/util']
      const bytes = await (await fetch(`/${file}`)).arrayBuffer()
      const location = util.storeBlobLocation({
        blob: new File([bytes], 'volvox_microarray.bw'),
      })
      const session = w.JBrowseSession
      session.addTrackConf({
        trackId,
        type: 'QuantitativeTrack',
        name: 'local file via blob',
        assemblyNames: ['volvox'],
        adapter: { type: 'BigWigAdapter', bigWigLocation: location },
      })
      session.views[0].showTrack(trackId)
      return location.blobId
    },
    { trackId: TRACK_ID, file: FILE },
  )

  const drawn = await page
    .waitForSelector('[data-display-drawn="true"]', { timeout: 45000 })
    .then(() => true)
    .catch(() => false)

  // A track whose adapter threw parks its display in an error state rather than
  // failing the paint wait, so read the model rather than trusting the selector.
  const trackError = await page.evaluate(trackId => {
    const view = (window as any).JBrowseSession.views[0]
    const track = view.tracks.find(
      (t: any) => t.configuration.trackId === trackId,
    )
    return track?.displays?.[0]?.error
      ? String(track.displays[0].error)
      : undefined
  }, TRACK_ID)

  console.log('--- BLOB LOCATION PROBE ---')
  console.log('blobId minted on the main thread:', blobId)
  console.log('workers created:', workers.length)
  console.log('display painted:', drawn)
  console.log('track error:', trackError ?? 'none')
  for (const e of errors.slice(0, 10)) {
    console.log('  ', e)
  }

  await browser.close()
  server.close()
  const ok = drawn && !trackError && workers.length > 0
  console.log(
    ok
      ? '\nPASS: a BlobLocation resolved inside a real worker'
      : '\nFAIL: the worker could not resolve the BlobLocation',
  )
  process.exit(ok ? 0 : 1)
}

void main()
