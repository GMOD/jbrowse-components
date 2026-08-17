// Is a spec's trailing wait covering APP WORK, or something else?
//
//   PROBE_SPEC=alignments/select_arc_display node scripts/probe-app-settled.ts
//
// Runs one spec's own actions except the last, then times `waitForAppSettled`
// while sampling `data-app-phase` beside it. The sample is the answer: a
// `loading` in there is the app still working after every gate the spec has of
// its own, which is what a trailing `{ type: 'delay' }` is really paying for and
// what `{ type: 'waitForAppSettled' }` replaces. All `ready` means the work was
// over before the spec's last wait returned, so the sleep is dead time — and
// dropping it is then a question about the page's own rendering rather than about
// the app (see `search_feature_highlight` in website/CLAUDE.md, which is
// measurably sensitive to being captured 200ms earlier).
//
// The spec name comes in through the environment because screenshot-options.ts
// parses process.argv strictly and exits on a positional.
import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  waitForAppSettled,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { runAction } from './actions.ts'
import { repoRoot, testDataRoot } from './screenshot-options.ts'
import { captureUrl } from './screenshot-ready.ts'
import { specs } from './screenshot-specs.ts'

import type { ScreenshotAction } from './screenshot-specs.ts'

const PORT = 3411
const SAMPLE_MS = 100

const name = process.env.PROBE_SPEC
const spec = specs.find(s => s.name === name)
if (!spec) {
  console.error(`set PROBE_SPEC to a spec name (got ${name ?? 'nothing'})`)
  process.exit(1)
}
if (spec.mode !== 'url') {
  console.error(
    `${spec.name} is a ${spec.mode} spec; this probe drives url ones`,
  )
  process.exit(1)
}

// A staged spec's stages run one after another against the same page, so the
// trailing wait to leave off is the last stage's last action.
const actions: ScreenshotAction[] = spec.stages?.length
  ? spec.stages.flatMap(stage => stage.actions ?? [])
  : (spec.actions ?? [])

const server = await createTestServer(PORT, {
  jbrowseWebRoot: testDataRoot,
  repoRoot,
})
const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  defaultViewport: {
    width: spec.viewportWidth ?? 1500,
    height: spec.viewportHeight ?? 800,
    deviceScaleFactor: 2,
  },
})
try {
  const page = await browser.newPage()
  const readiedBy = await captureUrl(page, spec, PORT)
  console.log(`readied by: ${readiedBy}`)
  for (const action of actions.slice(0, -1)) {
    await runAction(page, action)
  }

  const seen: string[] = []
  const sampler = setInterval(() => {
    void page
      .evaluate(
        () =>
          document.querySelector<HTMLElement>('[data-app-phase]')?.dataset
            .appPhase ?? 'absent',
      )
      .then(phase => seen.push(phase))
      .catch(() => {
        // the page can go away between samples; the timing below is the answer
      })
  }, SAMPLE_MS)
  const start = Date.now()
  const settled = await waitForAppSettled(page)
  clearInterval(sampler)
  const working = seen.filter(phase => phase === 'loading').length
  console.log(
    `waitForAppSettled: ${settled ? 'settled' : 'TIMED OUT'} in ${
      Date.now() - start
    }ms; ${working} of ${seen.length} samples had the app still working ` +
      `(dropped action: ${JSON.stringify(actions.at(-1))})`,
  )
} finally {
  await browser.close()
  server.close()
}
