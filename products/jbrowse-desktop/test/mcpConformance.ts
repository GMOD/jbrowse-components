// MCP conformance: launches the built app (renderer served from build/, main
// from build/electron.js), connects the stdio server to its bridge socket, and
// exercises the four tools against the volvox test config. The scenarios are
// the regressions found while building this surface: refName renaming (a VCF
// spelling contigA must answer a ctgA query), bulk in-place display settings,
// live-getter inspection, run_javascript globalThis persistence, gene-name
// navigation, and open waiting for the new session identity.
//
// Prereqs: `pnpm build && pnpm build:electron-main`. With another JBrowse
// Desktop instance running, the single-instance lock would forward the launch
// there and the checks would silently run against it, so the harness refuses;
// `--attach` drives that instance deliberately, skipping the launch.
//
// Usage: node test/mcpConformance.ts [--attach]
import fs from 'node:fs'
import path from 'node:path'

import { GUIDANCE_PREFIX } from '../electron/mcp/toolDefinitions.ts'
import { openVolvox, repoRoot, volvoxConfig } from './mcpHarness.ts'

const attach = process.argv.includes('--attach')

function recipeFences() {
  const page = fs.readFileSync(
    path.join(repoRoot, 'website/docs/agents_recipes.md'),
    'utf8',
  )
  const fences: { heading: string; code: string }[] = []
  let heading = ''
  let fence: string[] | undefined
  for (const line of page.split('\n')) {
    const h = /^## (.+)$/.exec(line)
    if (h) {
      heading = h[1]!
    }
    if (fence) {
      if (line.startsWith('```')) {
        fences.push({ heading, code: fence.join('\n') })
        fence = undefined
      } else {
        fence.push(line)
      }
    } else if (/^```js\s*$/.test(line)) {
      fence = []
    }
  }
  return fences
}

// What a spec load is given to settle here, over jb.loadSessionSpec's own
// 30s default. Under xvfb on a shared machine, two tracks whose display state
// models load as lazy chunks take longer than that often enough to be the
// flake this suite had: every check downstream then read a session that was
// still filling in. The recipe fences already run on a raised budget.
const SETTLE_MS = 90_000

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`ok    ${name}`)
  } else {
    console.error(`FAIL  ${name}`, detail === undefined ? '' : detail)
    process.exitCode = 1
  }
}

const session = await openVolvox(attach)
const { client, cold } = session
try {
  check('open from the start screen reports a settled session', cold.settled)
  // No delay. A page announces its MCP listener on mount, before it has loaded
  // anything, so `open` used to answer here in a quarter second with a blank
  // app — and this call was the one that found out.
  const coldAll = await client.callAll('run_javascript', {
    code: 'return jb.sessionSummary()',
  })
  const coldRead = JSON.parse(coldAll[0]?.text ?? 'null') as {
    value?: { assemblyNames?: string[] }
  }
  check(
    'a call straight after open sees the opened session',
    coldRead.value?.assemblyNames?.includes('volvox') === true,
    coldRead.value,
  )
  // Clients that drop the initialize instructions (Claude Desktop) get them
  // here, after the value so the value stays content[0]
  check(
    "a session's first run_javascript result carries the briefing after the value",
    coldAll.length === 2 &&
      coldAll[1]?.text?.startsWith(GUIDANCE_PREFIX) === true,
    coldAll.map(c => c.text?.slice(0, 60)),
  )
  const secondRead = await client.callAll('run_javascript', {
    code: 'return 1',
  })
  check(
    'the briefing is not repeated on the next call',
    secondRead.length === 1,
    secondRead.length,
  )

  const listed = await client.rpc('tools/list', {})
  const names = (
    listed.result as unknown as { tools: { name: string }[] }
  ).tools.map(t => t.name)
  check(
    'tools/list is exactly the four-tool surface',
    JSON.stringify(names) ===
      JSON.stringify(['run_javascript', 'docs', 'open', 'screenshot']),
    names,
  )

  const guide = await client.call('docs', { topic: 'live-model' })
  check(
    'docs live-model carries the renaming contract',
    Boolean(guide?.text?.includes('renameRegionsIfNeeded')),
  )
  // the bare read is the contract plus a contents of the deep dives; the
  // browser-agent section is not served from a server running inside Desktop
  check(
    'docs live-model answers with the contract and a deep-dive contents',
    Boolean(
      guide?.text?.includes('## Deep dives') &&
      /- The model, oriented \(\d+ chars\)/.test(guide.text) &&
      !guide.text.includes('In a browser'),
    ),
    guide?.text?.length,
  )
  const dive = await client.call('docs', {
    topic: 'live-model',
    section: 'The model, oriented',
  })
  check(
    'a deep dive reads by section',
    Boolean(dive?.text?.includes('view.hideTrack')),
  )

  // the corpus was reachable by type name only, so a question phrased as what
  // the setting is called had nowhere to go
  const found = await client.call('docs', { search: 'fetchSizeLimit' })
  check(
    'docs search answers with a topic and section to read next',
    Boolean(
      found?.text?.includes('topic:"model:') &&
      found.text.includes('section:"'),
    ),
    found?.text?.slice(0, 200),
  )

  async function run(code: string) {
    return client.callJson('run_javascript', { code })
  }

  // Factored out because a check that loads a spec of its own REPLACES the
  // session, and every check after it reads the two tracks at ctgA:1-30,000.
  const openConformanceSession = () =>
    run(`
    return jb.loadSessionSpec({
      sessionName: 'MCP conformance',
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-30,000',
          tracks: [
            { trackId: 'gff3tabix_genes', height: 140 },
            { trackId: 'volvox_test_vcf', height: 100 },
          ],
        },
      ],
    }, ${SETTLE_MS})`)
  const loaded = await openConformanceSession()
  const actions = await client.call('docs', {
    topic: 'model:LinearGenomeView',
    section: 'Actions',
  })
  check(
    "docs serves a model type's actions with signatures",
    typeof actions?.text === 'string' &&
      actions.text.includes('navToLocString(') &&
      !actions.text.includes('## Getters'),
    actions?.text?.slice(0, 300),
  )
  const slots = await client.call('docs', { topic: 'BamAdapter' })
  check(
    "docs serves a config type's slots by bare name",
    typeof slots?.text === 'string' && slots.text.includes('bamLocation'),
    slots?.text?.slice(0, 300),
  )
  const types = await client.call('docs', { topic: 'types' })
  check(
    'docs lists every type by category',
    typeof types?.text === 'string' &&
      types.text.includes('View models:') &&
      types.text.includes('Adapter configs:'),
    types?.text?.slice(0, 300),
  )

  check('spec load settles', loaded.value?.settled === true, loaded)
  check(
    'spec load shows both tracks',
    loaded.value?.session?.views?.[0]?.tracks?.length === 2,
    loaded.value?.session,
  )

  const printed = await run(`
    console.log('probe', { n: 2 })
    return 'done'`)
  check(
    'console output comes back in the envelope',
    printed.value === 'done' && printed.logs?.[0] === 'probe {"n":2}',
    printed,
  )

  const thrown = await client
    .call('run_javascript', {
      code: 'const a = 1\nconsole.log("before")\nthrow new Error("boom")',
    })
    .then(
      () => '',
      (e: Error) => e.message,
    )
  check(
    'a thrown error names its line in the submitted code and the output before it',
    thrown.includes('at code line 3') && thrown.includes('before'),
    thrown,
  )

  const navigated = await run(`
    const view = session.views[0]
    const moved = await view.navToLocString('Apple3')
    const settle = await jb.waitReady(30000)
    return { moved: moved !== false, ...settle, visible: view.visibleLocStrings }`)
  check(
    'gene-name navigation lands on a region',
    navigated.value?.moved === true &&
      typeof navigated.value?.visible === 'string' &&
      navigated.value.visible.includes(':'),
    navigated,
  )

  const updated = await run(`
    const results = session.views
      .flatMap(v => v.tracks ?? [])
      .map(t => t.applyDisplaySettings({ displayMode: 'compact' }))
    const settle = await jb.waitReady(30000)
    return { results, ...settle }`)
  check(
    'the track model action makes every shown track compact',
    updated.value?.results?.length === 2 &&
      updated.value.results.every((r: { applied?: string[] }) =>
        r.applied?.includes('displayMode'),
      ),
    updated,
  )

  // jb.addTrack shipped throwing "no session model found!" for every input,
  // with the whole suite green — nothing here called it. It also has to be
  // idempotent: the trackId is a content hash, so an agent re-running its own
  // script must not accumulate duplicates.
  const bam = path.join(repoRoot, 'test_data/volvox/volvox-sorted.bam')
  const added = await run(
    `return jb.addTrack({ location: ${JSON.stringify(bam)} })`,
  )
  check(
    'jb.addTrack infers the format and shows the track',
    added.value?.adapterType === 'BamAdapter' &&
      added.value?.trackType === 'AlignmentsTrack' &&
      typeof added.value?.shownInView === 'string',
    added,
  )
  const readded = await run(
    `return jb.addTrack({ location: ${JSON.stringify(bam)}, show: false })`,
  )
  check(
    'jb.addTrack is idempotent on the same file',
    readded.value?.trackId === added.value?.trackId,
    { first: added.value?.trackId, second: readded.value?.trackId },
  )

  // a node's getters, which its snapshot does not carry. Reading one is plain
  // JavaScript (jb.view().visibleLocStrings); finding out it exists is this.
  const inspected = await run(`return jb.inspect(jb.view())`)
  check(
    'inspect lists a live getter and names the model type',
    inspected.value?.getters?.includes('visibleLocStrings') === true &&
      typeof inspected.value?.modelType === 'string',
    {
      getters: inspected.value?.getters,
      modelType: inspected.value?.modelType,
    },
  )

  // a tool error throws here, so the refusal is caught rather than read
  const byName = await run(`return jb.inspect('views.0')`).then(
    value => `answered ${JSON.stringify(value)}`,
    (e: unknown) => `${e}`,
  )
  check(
    'inspect refuses a name, naming the node form',
    byName.includes('takes the node itself'),
    byName,
  )

  const summary = await run('return jb.sessionSummary()')
  check(
    'sessionSummary lists the view',
    summary.value?.views?.length === 1,
    summary,
  )

  const required = await run(`
    const util = jb.require('@jbrowse/core/configuration')
    return {
      sameParse: util.readConfObject === jb.readConfObject,
      catalog: jb.listTracks().total,
      vcfListed: jb.listTracks('volvox_test_vcf').total,
    }`)
  check(
    'jb.require serves the plugin ABI registry',
    required.value?.sameParse === true,
    required,
  )
  check(
    'listTracks reads the full catalog',
    required.value?.catalog > 10 && required.value?.vcfListed >= 1,
    required,
  )

  // Two refusals, checked here because the whole point of them is that the
  // alternative looked like success. A wrong display type used to draw the
  // track's default one, and a spec key that reached nothing used to load a
  // plausible track with the setting silently missing. Both now report, and
  // both report through the envelope's `notifications` rather than a throw,
  // because showTrackGeneric is the single choke point every open-a-track path
  // funnels through and it turns a failure into a toast.
  // A track NOT already shown: launchTrack returns early for one that is, so
  // asking the shown vcf would never reach the check being tested.
  // ChordVariantDisplay is registered for VariantTrack and drawn by a circular
  // view, which is exactly the shape that used to pass through and land on the
  // linear default.
  const wrongDisplay = await run(`
    await jb.view().launchTrack('volvox_filtered_vcf', {}, {
      type: 'ChordVariantDisplay',
    })
    return {
      shown: jb.sessionSummary().views[0].tracks.map(t => t.trackId),
    }`)
  check(
    'a display type this view cannot draw is refused, not silently defaulted',
    (wrongDisplay.notifications ?? []).some((n: { message: string }) =>
      n.message.includes('cannot be shown as "ChordVariantDisplay"'),
    ) &&
      !(wrongDisplay.value?.shown as string[] | undefined)?.includes(
        'volvox_filtered_vcf',
      ),
    wrongDisplay,
  )

  const strayKey = await run(`
    return jb.loadSessionSpec({
      sessionName: 'stray key',
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-30,000',
          tracks: [{ trackId: 'gff3tabix_genes', colorSchem: 'strand' }],
        },
      ],
    }, ${SETTLE_MS})`)
  check(
    'a spec key that reaches nothing is reported, not dropped',
    [
      ...(strayKey.notifications ?? []),
      ...((strayKey.value?.notifications ?? []) as { message: string }[]),
    ].some((n: { message: string }) => n.message.includes('colorSchem')),
    strayKey,
  )
  await openConformanceSession()

  const variants = await run(`
    const feats = await jb.getFeatures({
      trackId: 'volvox_test_vcf',
      loc: 'ctgA:1-30,000',
    })
    globalThis.mcpConformanceCount = feats.length
    return {
      variants: feats.length,
      displayModeSlot:
        'displayMode' in
        jb.describeSlots(jb.trackModel('gff3tabix_genes').activeDisplay.configuration),
    }`)
  check(
    'getFeatures renames refNames (contigA file answers ctgA query)',
    variants.value?.variants > 0,
    variants,
  )
  // two of the four filmed takes wrote it this way first
  const positional = await run(`
    const feats = await jb.getFeatures('volvox_test_vcf', 'ctgA:1-30,000')
    return feats.length`)
  check(
    'getFeatures takes the trackId and loc positionally',
    positional.value === variants.value?.variants,
    positional,
  )
  check(
    'describeSlots names displayMode',
    variants.value?.displayModeSlot === true,
    variants,
  )
  const persisted = await run('return globalThis.mcpConformanceCount')
  check(
    'globalThis persists between run_javascript calls',
    persisted.value === variants.value?.variants,
    persisted,
  )

  const genes = await run(`
    const feats = await jb.getFeatures({ trackId: 'gff3tabix_genes' })
    return { visibleRegionFeatures: feats.length }`)
  check(
    'getFeatures defaults to the visible region',
    genes.value?.visibleRegionFeatures > 0,
    genes,
  )

  const hidden = await run(`
    const view = session.views[0]
    return { hidden: view.hideTrack('volvox_test_vcf') }`)
  check('hideTrack removes the track', hidden.value?.hidden >= 1, hidden)

  // An interrupted agent used to leave its code running for the rest of its
  // budget, pinning the renderer. The request itself is never answered — that
  // is what cancelling means — so what proves it arrived is the loop stopping.
  const pause = async (ms: number) => {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
  const cancelledId = client.send('tools/call', {
    name: 'run_javascript',
    arguments: {
      timeoutMs: 60_000,
      code: `
        globalThis.mcpCancelProbe = { stopped: false }
        while (!signal.aborted) {
          await new Promise(r => setTimeout(r, 50))
        }
        globalThis.mcpCancelProbe.stopped = true
        return 'never read'`,
    },
  })
  await pause(1000)
  client.notify('notifications/cancelled', { requestId: cancelledId })
  await pause(1500)
  const stopped = await run('return globalThis.mcpCancelProbe')
  check(
    'a cancelled call aborts the code it left running',
    stopped.value?.stopped === true,
    stopped,
  )

  // Nothing raises a toast for this and no display records it, so before the
  // envelope carried it the only reader was devtools.
  const raised = await run(`
    Promise.reject(new Error('mcp conformance unhandled rejection'))
    await new Promise(r => setTimeout(r, 500))
    return 'raised'`)
  check(
    'a rejection nobody awaited comes back in the envelope',
    ((raised.pageErrors ?? []) as { source: string; message: string }[]).some(
      e => e.message.includes('mcp conformance unhandled rejection'),
    ),
    raised,
  )
  const drained = await run("return 'again'")
  check(
    'each page error is delivered once',
    drained.pageErrors === undefined,
    drained.pageErrors,
  )

  // both parts: the settle result was being dropped, so an agent screenshotting
  // an errored or undrawn track was told nothing was wrong
  const shot = await client.callAll('screenshot', {})
  const shotImage = shot.find(c => c.type === 'image')
  const shotText = shot.find(c => c.type === 'text')
  check(
    'screenshot returns a real image',
    (shotImage?.data?.length ?? 0) > 20_000,
    shot.map(c => c.type),
  )
  const pngWidth = (data: string | undefined) =>
    data === undefined ? 0 : Buffer.from(data, 'base64').readUInt32BE(16)
  const viewId = (await run('return session.views[0].id')).value as string
  const cropped = await client.callAll('screenshot', {
    selector: `[data-testid="view-container-${viewId}"]`,
  })
  const croppedImage = cropped.find(c => c.type === 'image')
  check(
    'screenshot crops to the selected view',
    croppedImage !== undefined &&
      pngWidth(croppedImage.data) < pngWidth(shotImage?.data) &&
      JSON.parse(cropped.find(c => c.type === 'text')?.text ?? '{}').cropped
        ?.width > 0,
    cropped.map(c => (c.type === 'image' ? pngWidth(c.data) : c.text)),
  )
  const missed = await client
    .callAll('screenshot', { selector: '#no-such-thing' })
    .then(
      () => '',
      (e: Error) => e.message,
    )
  check(
    'a screenshot selector that matches nothing is an error, not a full frame',
    missed.includes('nothing on the page matches'),
    missed,
  )

  check(
    'screenshot also returns the settle result the docs promise',
    shotText !== undefined && shotText.text?.includes('settled') === true,
    shotText?.text?.slice(0, 200),
  )

  // One image pixel per CSS pixel on both routes. Before that, capturePage
  // answered in device pixels and the devtools clip in CSS pixels, so the two
  // heights below were only comparable on a 1x display — which is what dev and
  // CI happen to be, and the reason this check passed while saying nothing.
  const innerWidth = (await run('return window.innerWidth')).value as number
  check(
    'a viewport capture is one image pixel per CSS pixel, and says its size',
    pngWidth(shotImage?.data) === innerWidth &&
      JSON.parse(shotText?.text ?? '{}').image?.width === innerWidth,
    { innerWidth, png: pngWidth(shotImage?.data), text: shotText?.text },
  )
  const doubled = await client.callAll('screenshot', { scale: 2 })
  check(
    'scale multiplies the pixels the same capture answers with',
    pngWidth(doubled.find(c => c.type === 'image')?.data) === innerWidth * 2,
    pngWidth(doubled.find(c => c.type === 'image')?.data),
  )

  // the viewport is what capturePage sees; the document is what the session
  // occupies, and every filmed take had the second taller than the first
  const pngHeight = (data: string | undefined) =>
    data === undefined ? 0 : Buffer.from(data, 'base64').readUInt32BE(20)
  const innerHeight = (await run('return window.innerHeight')).value as number
  // taller than the window, so a capture of the viewport cannot pass: the app
  // scrolls a column rather than the document, and a fullPage that measured the
  // document came back the window's height and passed a `>=` check anyway
  await run(
    'session.views[0].tracks[0].displays[0].setHeight(window.innerHeight * 2); await jb.waitReady()',
  )
  const whole = await client.callAll('screenshot', { fullPage: true })
  const wholeImage = whole.find(c => c.type === 'image')
  const wholeText = JSON.parse(whole.find(c => c.type === 'text')?.text ?? '{}')
  check(
    'a fullPage screenshot captures a session taller than the window',
    wholeImage !== undefined &&
      pngHeight(wholeImage.data) > innerHeight * 2 &&
      wholeText.page?.height > innerHeight * 2,
    { viewportCss: innerHeight, page: wholeText.page },
  )
  const wholeCropped = await client.callAll('screenshot', {
    fullPage: true,
    selector: `[data-testid="view-container-${viewId}"]`,
  })
  check(
    'a fullPage screenshot crops to a selector in document coordinates',
    pngWidth(wholeCropped.find(c => c.type === 'image')?.data) <
      pngWidth(wholeImage?.data),
    wholeCropped.map(c => (c.type === 'image' ? pngWidth(c.data) : c.text)),
  )

  const recent = await client.callJson('open')
  check('bare open lists recent sessions', Array.isArray(recent), recent)

  const reopened = await client.callJson('open', { target: volvoxConfig })
  check(
    'open waits for the new session before answering',
    reopened.opened === volvoxConfig && reopened.note === undefined,
    reopened,
  )
  const fresh = await run('return jb.sessionSummary()')
  check(
    'the session after open is the reopened config',
    Array.isArray(fresh.value?.assemblyNames) &&
      fresh.value.assemblyNames.includes('volvox'),
    fresh,
  )

  // The recipes page promises every snippet was run against the app. This is
  // what keeps that true: each js fence runs verbatim against the volvox
  // session the page describes. Fences over the hosted hg38 config, or reaching
  // a remote host, need the network and are left to the page's own verification.
  //
  // The session is reset per RECIPE, not once for the page. A reader copies one
  // heading, not the whole file, so that is the state each snippet has to work
  // from -- and running them into one accumulating session tested something
  // else, which is how "Prove a track drew" came to decide whether "A
  // publication figure" passed. That recipe launches a track that cannot load
  // on purpose, and an export refuses a broken track by design
  // (`throwOnExportErrors`), so the export fence failed on the previous
  // recipe's subject. Fences under one heading still share a session: those do
  // build on each other.
  const openRecipeSession = () =>
    run(`
    return jb.loadSessionSpec({
      sessionName: 'recipes',
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-30,000',
          tracks: [
            { trackId: 'gff3tabix_genes', height: 140 },
            { trackId: 'volvox_test_vcf', height: 100 },
          ],
        },
      ],
    }, ${SETTLE_MS})`)
  let openedFor: string | undefined
  for (const { heading, code } of recipeFences()) {
    if (!code.includes('hg38') && !code.includes('https://')) {
      if (openedFor !== heading) {
        await openRecipeSession()
        openedFor = heading
      }
      // An error TOAST fails the recipe as surely as a throw does. The page
      // promises "the values quoted are what came back", and a snippet that
      // notifies an error and returns anyway satisfied a did-not-throw check
      // while doing the wrong thing — which is how a recipe naming a display
      // type v5 had removed passed here for a release. Display failures
      // surface through `notReady` rather than a toast (the deliberately
      // failing track in "Prove a track drew" is the case that proves it), so
      // an error-level notification here means the snippet itself is wrong.
      const outcome = await client
        .callJson('run_javascript', { code, timeoutMs: 60_000 })
        .then(
          result => {
            const errors = (
              (result?.notifications ?? []) as {
                level: string
                message: string
              }[]
            ).filter(n => n.level === 'error')
            return errors.length > 0
              ? `raised ${errors.length} error notification(s): ${errors.map(n => n.message).join('; ')}`
              : ''
          },
          (e: Error) => e.message,
        )
      check(`recipe runs: ${heading}`, outcome === '', outcome)
    }
  }

  console.log(process.exitCode ? 'FAILED' : 'PASSED')
} finally {
  session.stop()
}
