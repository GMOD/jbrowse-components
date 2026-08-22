// A track backed by a BlobLocation — a file the user opened off their own disk
// — resolving inside a real web worker.
//
// The worker's blob map is module-global and exactly one thing installs it:
// `RpcMethodType.deserializeArguments`, reached from `invoke`, which is what
// rpcWorker binds per method. Nothing else in that realm calls `setBlobMap`.
//
// This needs a real browser because the failure is a REALM failure, and jest
// cannot have one: every unit test runs the worker's code in the main thread's
// realm, where the blob map is already populated, so a method that never
// installs it reads the right answer by accident and goes on doing so until a
// worker reboots empty.
import { findDisplayPainted, navigateWithSessionSpec } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const TRACK_ID = 'local-file-blob'
const FILE = 'test_data/volvox/volvox_microarray.bw'

// Fetch the bytes and hand them in as a File, which is what the file input in
// LocalFileChooser produces. `storeBlobLocation` is reached the way a runtime
// plugin reaches it, so it is the same core module instance the RPC layer reads
// `getBlobMap()` from.
function addBlobTrack(page: Page) {
  return page.evaluate(
    async ({ trackId, file }) => {
      const w = window as any
      const { storeBlobLocation } =
        w.JBrowseRootModel.pluginManager.lib['@jbrowse/core/util']
      const bytes = await (await fetch(`/${file}`)).arrayBuffer()
      const location = storeBlobLocation({
        blob: new File([bytes], 'volvox_microarray.bw'),
      })
      const session = w.JBrowseSession
      session.addSessionTrackConf({
        trackId,
        type: 'QuantitativeTrack',
        name: 'local file via blob',
        assemblyNames: ['volvox'],
        adapter: { type: 'BigWigAdapter', bigWigLocation: location },
      })
      await session.views[0].launchTrack(trackId)
    },
    { trackId: TRACK_ID, file: FILE },
  )
}

// A track whose adapter threw still reaches its drawn state — it renders the
// failure inside itself — so painting is not the assertion. Verified by making
// `invoke` skip the deserialize step: the display painted, and this is what
// caught it ("file was opened locally from a previous session").
function readTrackError(page: Page) {
  return page.evaluate(trackId => {
    const view = (window as any).JBrowseSession.views[0]
    const track = view.tracks.find(
      (t: any) => t.configuration.trackId === trackId,
    )
    const error = track?.displays?.[0]?.error
    return error ? String(error) : undefined
  }, TRACK_ID)
}

const suite: TestSuite = {
  name: 'LocalFileBlob',
  tests: [
    {
      name: 'a BlobLocation resolves in the worker',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
            },
          ],
        })
        await page.waitForFunction(() => !!(window as any).JBrowseSession, {
          timeout: 30000,
        })
        await addBlobTrack(page)
        await findDisplayPainted(page, 'wiggle-display', 60000)

        const error = await readTrackError(page)
        if (error) {
          throw new Error(`worker could not resolve the BlobLocation: ${error}`)
        }
      },
    },
  ],
}

export default suite
