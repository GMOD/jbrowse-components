import { ChildProcess } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import http from 'http'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { By, WebDriver, until } from 'selenium-webdriver'

import {
  APP_BINARY,
  REPO_ROOT,
  cleanupUI,
  clearInput,
  clickButton,
  createDriver,
  delay,
  findByText,
  flushBrowserLogs,
  isHeadless,
  killProcesses,
  openMenuItem,
  openVolvoxGenome,
  startChromedriver,
  startStaticServer,
  waitForAppReady,
  waitForSession,
  waitForStableSession,
  waitForStartScreen,
} from './harness.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../../website/static/img')
const DATA_PORT = 9444
const BLAT_PORT = 9445
const ISPCR_PORT = 9446

// `--only <substring>[,<substring>]` still walks the whole flow but writes only
// the matching figures, so regenerating one image can't churn the others with
// re-encoded pixels (unlike the web generator, this harness has no
// content-stable gate). A comma list keeps a change that touches several
// figures — a shared dialog button, say — to one run.
const onlyIndex = process.argv.indexOf('--only')
const ONLY =
  onlyIndex === -1
    ? []
    : process.argv[onlyIndex + 1]!.split(',').map(s => s.trim())

// The figures in the order the flow captures them, which is what tells a run
// which of the selected figures is its *last* one — a substring can match
// several, so "every pattern has matched something" is not the same question.
// capture() rejects a name missing from this list, so the list can't silently
// drift out of step with the flow.
const FIGURES = [
  'desktop-landing.png',
  'desktop-ispcr.png',
  'desktop-ispcr-results.png',
  'desktop-blat-search.png',
  'desktop-blat-results.png',
  'desktop-open-genome.png',
  'desktop-available-genomes.png',
  'desktop-session.png',
  'desktop-add-track.png',
]

const selected = FIGURES.filter(name => ONLY.some(only => name.includes(only)))
const LAST_SELECTED = selected.at(-1)

let chromedriverProcess: ChildProcess | null = null
let dataServer: http.Server | null = null
let blatServer: http.Server | null = null
let ispcrServer: http.Server | null = null
let driver: WebDriver | null = null

// Every capture logs the size it is about to write, whether or not --only lets
// it write: the committed figures are 1400px wide and a run that silently
// captures a different width is the failure mode this harness keeps hitting, so
// the sizes need to be in the log next to the step that changed them.
async function logViewport(driver: WebDriver, name: string): Promise<void> {
  const size = await driver.executeScript<string>(`
    const body = document.body.getBoundingClientRect()
    return [
      'inner ' + window.innerWidth + 'x' + window.innerHeight,
      'outer ' + window.outerWidth + 'x' + window.outerHeight,
      'body ' + Math.round(body.width) + 'x' + Math.round(body.height),
      'dpr ' + window.devicePixelRatio,
      'screen ' + screen.width + 'x' + screen.height,
    ].join(', ')
  `)
  console.log(`  · ${name}: ${size}`)
}

// One teardown for the normal end, the early exit, and the fatal handler: each
// piece is skipped if it never started, so it is safe to call at any point.
async function shutdown(code: number): Promise<never> {
  console.log('\nCleaning up...')
  if (driver) {
    try {
      await driver.quit()
    } catch (e) {
      console.warn('WARN: driver.quit() failed during cleanup:', e)
    }
  }
  chromedriverProcess?.kill('SIGKILL')
  dataServer?.close()
  blatServer?.close()
  ispcrServer?.close()
  await killProcesses()
  console.log('Done.')
  process.exit(code)
}

async function capture(
  driver: WebDriver,
  name: string,
  dir = OUT_DIR,
  { ignoreOnly = false } = {},
): Promise<void> {
  if (!ignoreOnly && !FIGURES.includes(name)) {
    throw new Error(`${name} is missing from the FIGURES list`)
  }
  await logViewport(driver, name)
  if (ONLY.length > 0 && !ignoreOnly && !selected.includes(name)) {
    console.log(`  ≈ skipped ${name} (--only ${ONLY.join(',')})`)
  } else {
    const png = await driver.takeScreenshot()
    const out = resolve(dir, name)
    writeFileSync(out, Buffer.from(png, 'base64'))
    console.log(`  ✓ wrote ${out}`)
    // Walking the rest of the flow with nothing left to write is a real risk,
    // not just wasted minutes: the app has died outright at the
    // available-genomes table, which would fail a run whose figures are all
    // already on disk.
    if (name === LAST_SELECTED) {
      console.log('\nEvery --only figure written, stopping early.')
      await shutdown(0)
    }
  }
}

// The Add-track stepper renders one button (testid addTrackNextButton) per step,
// but only the active step's button is displayed. Click the visible, enabled one
// to advance ("Next" on the source step, "Add" on the confirm step).
async function clickActiveAddTrackButton(driver: WebDriver): Promise<void> {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const buttons = await driver.findElements(
      By.css('[data-testid="addTrackNextButton"]'),
    )
    for (const button of buttons) {
      if ((await button.isDisplayed()) && (await button.isEnabled())) {
        await driver.executeScript('arguments[0].click();', button)
        return
      }
    }
    await delay(300)
  }
  throw new Error('no enabled addTrackNextButton found')
}

// Kill CSS transitions/animations so a capture can't land on a half-faded
// dialog or menu (the desktop harness, unlike the web generator, drives a live
// app with MUI Grow/Fade transitions running).
async function freezeAnimations(driver: WebDriver): Promise<void> {
  await driver.executeScript(`
    const s = document.createElement('style')
    s.textContent =
      '*,*::before,*::after{transition:none !important;animation:none !important;}'
    document.head.appendChild(s)
  `)
}

// MUI autofocuses the first focusable control in a dialog, and which one that is
// can vary run to run: this figure flipped by 374 pixels purely because the "Max
// product size" field carried a focus ring in one capture and not the next.
// Dropping focus before a dialog capture makes that deterministic. Only for
// figures where nothing has been typed — a caret in a field the reader is meant
// to see filled in is part of the picture.
async function blurActiveElement(driver: WebDriver): Promise<void> {
  await driver.executeScript(`document.activeElement?.blur()`)
}

// The query the BLAT dialog submits, which MOCK_BLAT_RESPONSE then claims to
// have placed — so it has to be the sequence that claim describes, not an
// arbitrary string. It is hg19 chr17:7,579,839-7,579,985 (the mock's own primary
// hit) with two substitutions, giving the 147 bases and 145/2 match/mismatch
// split the mock reports. The results track carries this text as its SAM SEQ and
// the pileup compares it against the real reference base by base, so a query of
// the wrong length or the wrong bases renders as a wall of mismatches under a
// hit labelled "98.7% identity".
const SAMPLE_SEQ =
  'AGTTTCCATAGGTCTGAAAATGTTTCCTGACTCAGAGTGGGCTCGACGCTAGGATCTGACTGCGGCTCCTCCATGGCAGTGACCCGGAAGGCAGTCTGGCTGCTACAAGAGGAAAAGTGGGGATCCAGCATGAGACACTTCCAACCC'

// Track menu of the first track in the view (hg19's RefSeq lane) -> Gene glyph
// -> Longest coding transcript. At the 205 bp the BLAT hit frames, "All
// transcripts" is four near-identical TP53 models with the same exon under the
// hit, so the reader compares the hit against a stack instead of against one
// gene. Menu rows go by testid: their labels also appear in the track label
// above, and a text match resolves to the first of those.
async function collapseGeneGlyph(driver: WebDriver): Promise<void> {
  const trackMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="track_menu_icon"]')),
    10000,
  )
  await driver.executeScript('arguments[0].click();', trackMenu)
  const submenu = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-submenu-gene_glyph"]'),
    ),
    10000,
  )
  await driver.executeScript('arguments[0].click();', submenu)
  const option = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-menuitem-longest_coding_transcript"]'),
    ),
    10000,
  )
  await driver.executeScript('arguments[0].click();', option)
  await cleanupUI(driver)
  await waitForAppReady(driver) // the lane re-renders with one model per gene
}

// Reads the open dialog's text without going through findElements, whose 30s
// implicit wait makes "no dialog" cost 30 seconds to observe.
async function openDialogText(driver: WebDriver): Promise<string | null> {
  return driver.executeScript(`
    const d = document.querySelector('.MuiDialog-root')
    return d ? d.innerText : null
  `)
}

// Submit, then block until the query has actually settled rather than guessing
// with a delay. runQuery closes the dialog only on the success path (hits ->
// track -> navigate -> handleClose), so a still-open dialog whose Submit button
// has dropped back out of its 'Searching…' loading label means the query
// finished and did *not* produce a result — the reason is printed in the dialog,
// so read it out instead of leaving a later navigation wait to time out blank.
async function submitUcscQuery(driver: WebDriver): Promise<void> {
  const submit = await driver.wait(
    until.elementLocated(By.xpath("//button[contains(., 'Submit')]")),
    10000,
  )
  if (!(await submit.isEnabled())) {
    throw new Error(
      `Submit is disabled, dialog reads: ${await openDialogText(driver)}`,
    )
  }
  await driver.executeScript('arguments[0].click();', submit)
  await delay(500) // let the click's setLoading(true) render before polling

  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    const text = await openDialogText(driver)
    if (text === null) {
      console.log('    DEBUG: query settled, dialog closed')
      return
    }
    if (!text.includes('Searching')) {
      throw new Error(`BLAT query did not produce a result: ${text}`)
    }
    await delay(300)
  }
  throw new Error('BLAT query still searching after 60s')
}

// A stand-in hgBlat. Public UCSC BLAT sits behind a Cloudflare CAPTCHA and
// needs an account apiKey, so a result figure can't be captured against it;
// pointing the dialog's "BLAT server URL" field here instead exercises the real
// request → parse → on-the-fly track → navigate path with only UCSC's server
// substituted. The body is a genuine hgBlat output=json response shape: a
// strong 147bp hit over hg19 TP53 and a weaker partial hit on chr6. Both rows'
// qSize is SAMPLE_SEQ's length, and their block coordinates have to add up to it
// — the results track turns these into SAM, where a CIGAR that spans a different
// number of query bases than SEQ carries is malformed.
const MOCK_BLAT_RESPONSE = JSON.stringify({
  track: 'blat',
  genome: 'hg19',
  fields: [
    'matches',
    'misMatches',
    'repMatches',
    'nCount',
    'qNumInsert',
    'qBaseInsert',
    'tNumInsert',
    'tBaseInsert',
    'strand',
    'qName',
    'qSize',
    'qStart',
    'qEnd',
    'tName',
    'tSize',
    'tStart',
    'tEnd',
    'blockCount',
    'blockSizes',
    'qStarts',
    'tStarts',
  ],
  blat: [
    // prettier-ignore
    [145, 2, 0, 0, 0, 0, 0, 0, '+', 'YourSeq', 147, 0, 147, 'chr17', 81195210, 7579838, 7579985, 1, '147', '0', '7579838'],
    // prettier-ignore
    [61, 9, 0, 0, 1, 3, 1, 12, '-', 'YourSeq', 147, 20, 90, 'chr6', 171115067, 36646200, 36646282, 2, '40,30', '20,63', '36646200,36646252'],
  ],
})

// A real primer pair for a real job: amplify TP53 exon 8 (hg19
// chr17:7,577,019-7,577,155, the codon 273/282 mutation hotspot) with ~40bp of
// flanking intron either side, which is what you order to Sanger-sequence the
// hotspot in a tumour sample. Both primers are the reference's own bases, with
// one deliberate exception — the 6th base of the forward primer does not match
// the template, standing in for a primer sitting over a SNP or carrying a design
// typo.
//
// That mismatch is at the 5' end on purpose. hgPcr's wp_perfect=15 requires 15
// perfect bases at the 3' end, which is the biology: a 3'-end mismatch stops
// extension and the product disappears, while a 5'-end one still amplifies. Put
// the same substitution at base 12 and UCSC returns nothing at all (verified).
const ISPCR_FWD = 'CCCTTAGTCTCCTCCACCGCTT'
const ISPCR_REV = 'TCCTTACTGCCTCTTGCTTCTC'

// A stand-in hgPcr, for the same reason as the BLAT one: UCSC's is CAPTCHA-gated,
// so a result figure can't be captured against it. The body is not invented — it
// is the response genome.ucsc.edu actually returned for the pair above, so the
// figure shows a real placement of real primers, and the shape stays honest down
// to the position being a link and the FASTA '>' arriving unescaped. UCSC
// lowercases the one base that did not match, which is its own way of saying the
// anneal was imperfect.
const MOCK_ISPCR_RESPONSE = `<HTML><BODY><PRE>
><A HREF="../cgi-bin/hgTracks?db=hg19&position=chr17:7576979-7577195&hgPcrResult=pack">chr17:7576979+7577195</A> 217bp ${ISPCR_FWD} ${ISPCR_REV}
CCCTTgGTCTCCTCCACCGCTTcttgtcctgcttgcttacctcgcttagt
gctccctgggggcagctcgtggtgaggctcccctttcttgcggagattct
cttcctctgtgcgccggtctctcccaggacaggcacaaacacgcacctca
aagctgttccgtcccagtagattaccactactcaggataggaaaaGAGAA
GCAAGAGGCAGTAAGGA
</PRE></BODY></HTML>`

// One stand-in server per UCSC CGI: same trivial handler, different body, since
// hgBlat answers JSON under a text/html content-type and hgPcr answers a page.
async function startMockServer(
  port: number,
  body: string,
): Promise<http.Server> {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.end(body)
  })
  await new Promise<void>((done, fail) => {
    server.on('error', fail)
    server.listen(port, '127.0.0.1', () => {
      done()
    })
  })
  return server
}

// BLAT and in-silico PCR (blat plugin, a desktop core plugin) query UCSC by
// assembly, so demonstrate them on a real UCSC assembly: launch the seeded hg19
// favorite from the start screen, capture both Tools-menu dialogs in their
// default (collapsed) state — which fits the window and keeps hg19 prominent;
// the guide prose covers the "advanced settings" apiKey/CAPTCHA path the toggle
// reveals — then submit the BLAT one to get the result figure, and hand the run
// back a clean start screen for the remaining shots.
async function launchHg19(driver: WebDriver): Promise<void> {
  const hg19Link = await driver.wait(
    until.elementLocated(By.xpath("//a[contains(., 'GRCh37/hg19')]")),
    30000,
  )
  await driver.executeScript('arguments[0].click();', hg19Link)
  // the app bar (where the blat plugin's Tools items live) appears once the
  // session opens; the hg19 config is fetched from jbrowse.org, and the RefSeq
  // lane behind the dialogs has to have painted before anything is captured
  await findByText(driver, 'Tools')
  await waitForAppReady(driver)
  await freezeAnimations(driver)
}

async function returnToStartScreen(driver: WebDriver): Promise<void> {
  console.log('Returning to start screen...')
  await openMenuItem(driver, 'File', 'Return to start screen')
  await waitForStartScreen(driver)
  await delay(1000)
}

// Points a dialog's UCSC server-url field (revealed by "Show advanced settings")
// at one of the stand-in servers. A clearInput that didn't take leaves the real
// UCSC url with the mock one appended, and the resulting failure reads as an
// unrelated network error, so the field is read back.
async function useMockServer(
  driver: WebDriver,
  urlLabel: string,
  mockUrl: string,
): Promise<void> {
  await clickButton(driver, 'Show advanced settings')
  const urlField = await driver.wait(
    until.elementLocated(
      By.xpath(`//label[contains(., '${urlLabel}')]/following::input[1]`),
    ),
    10000,
  )
  await clearInput(driver, urlField)
  await urlField.sendKeys(mockUrl)
  const typedUrl = await urlField.getAttribute('value')
  if (typedUrl !== mockUrl) {
    throw new Error(
      `${urlLabel} field reads "${typedUrl}", wanted "${mockUrl}"`,
    )
  }
}

// A query no longer moves the view on its own: it adds the track and lists the
// results, and the view goes where the reader clicks. So the result figures take
// that click, which is the flow a reader follows rather than a shortcut around it.
async function openFirstResult(
  driver: WebDriver,
  locPrefix: string,
): Promise<void> {
  const link = await driver.wait(
    until.elementLocated(
      By.xpath(`//a[starts-with(normalize-space(.), '${locPrefix}')]`),
    ),
    20000,
  )
  await driver.executeScript('arguments[0].click();', link)
}

// In-silico PCR gets its own hg19 visit: the result state has a track and a moved
// view, so the pristine dialog and the BLAT figures cannot share a session with
// it.
async function captureIsPcrFigures(driver: WebDriver): Promise<void> {
  console.log('Launching hg19 for in-silico PCR...')
  await launchHg19(driver)

  // the hgPcr primer-pair dialog, whose forward/reverse fields carry their own
  // example placeholders, captured before anything is typed into it
  console.log('Capturing In-silico PCR dialog...')
  await openMenuItem(driver, 'Tools', 'In-silico PCR')
  await findByText(driver, 'In-silico PCR (UCSC)')
  await delay(500)
  await blurActiveElement(driver)
  await capture(driver, 'desktop-ispcr.png')

  // Then the same dialog driven to a result. A product is a primer pair with an
  // insert between them, so the track is an alignments track in view-as-pairs
  // mode: the figure has to show the two footprints facing inward across the
  // amplicon, which is how a primer pair is drawn everywhere else a bench
  // scientist meets one.
  console.log('Capturing In-silico PCR results...')
  for (const [label, primer] of [
    ['Forward primer', ISPCR_FWD],
    ['Reverse primer', ISPCR_REV],
  ]) {
    const field = await driver.wait(
      until.elementLocated(
        By.xpath(`//label[contains(., '${label}')]/following::input[1]`),
      ),
      10000,
    )
    await field.click()
    await field.sendKeys(primer!)
  }
  await useMockServer(
    driver,
    'In-silico PCR server URL',
    `http://127.0.0.1:${ISPCR_PORT}/hgPcr`,
  )
  await submitUcscQuery(driver)

  // the query itself only produces a track and a list; the view has not moved
  const probe = await waitForSession(
    driver,
    s =>
      s.trackIds.some(id => id.startsWith('ispcr-')) &&
      s.widgetTypes.includes('UcscResultsWidget'),
  )
  if (!probe) {
    throw new Error(
      'no window.JBrowseSession — is the binary built from source?',
    )
  }
  console.log(`    DEBUG: session ${JSON.stringify(probe)}`)
  if (!probe.trackIds.some(id => id.startsWith('ispcr-'))) {
    throw new Error(
      `in-silico PCR added no track: ${probe.trackIds.join(', ')}`,
    )
  }
  await openFirstResult(driver, 'chr17:7576979')
  const navigated = await waitForSession(driver, s =>
    s.locStrings.some(loc => loc.includes('chr17')),
  )
  if (!navigated?.locStrings.some(loc => loc.includes('chr17'))) {
    throw new Error(
      `clicking the product left the view at ${navigated?.locStrings.join('; ')}`,
    )
  }
  await waitForAppReady(driver)
  await collapseGeneGlyph(driver)
  await waitForAppReady(driver)
  const settled = await waitForStableSession(driver)
  console.log(`    DEBUG: settled at ${settled?.locStrings.join('; ')}`)
  await capture(driver, 'desktop-ispcr-results.png')
  await flushBrowserLogs(driver)
  await returnToStartScreen(driver)
}

async function captureBlatDialogs(driver: WebDriver): Promise<void> {
  console.log('Launching hg19 for BLAT...')
  await launchHg19(driver)

  // Tools -> BLAT search: paste a sample sequence so the figure shows a query
  // being set up against hg19, capture that, then drive the same dialog to a
  // result — the two figures are two states of one visit, not two visits.
  console.log('Capturing BLAT search dialog...')
  await openMenuItem(driver, 'Tools', 'BLAT search')
  await findByText(driver, 'BLAT search (UCSC)')
  await delay(500)
  const blatSeqInput = await driver.wait(
    until.elementLocated(By.css('textarea:not([aria-hidden="true"])')),
    10000,
  )
  await blatSeqInput.click()
  await blatSeqInput.sendKeys(SAMPLE_SEQ)
  await delay(500)
  await capture(driver, 'desktop-blat-search.png')

  // The result of a search is a track plus a list, so capture the state after
  // submitting too, with the best hit opened from that list. Submitted against
  // the stand-in server (see MOCK_BLAT_RESPONSE) via the url field under
  // advanced settings.
  console.log('Capturing BLAT results...')
  await useMockServer(
    driver,
    'BLAT server URL',
    `http://127.0.0.1:${BLAT_PORT}/hgBlat`,
  )
  await submitUcscQuery(driver)

  // What the query is supposed to have produced, asked of the model rather than
  // of rendered text: the hits as a track and the hit list in the drawer, neither
  // of which the DOM answers. The view is not part of it — a query does not move
  // the view any more, the click below does.
  const probe = await waitForSession(
    driver,
    s =>
      s.trackIds.some(id => id.startsWith('blat-')) &&
      s.widgetTypes.includes('UcscResultsWidget'),
  )
  if (!probe) {
    throw new Error(
      'no window.JBrowseSession — is the binary built from source?',
    )
  }
  console.log(`    DEBUG: session ${JSON.stringify(probe)}`)
  if (!probe.trackIds.some(id => id.startsWith('blat-'))) {
    throw new Error(`BLAT added no track: ${probe.trackIds.join(', ')}`)
  }
  if (!probe.widgetTypes.includes('UcscResultsWidget')) {
    throw new Error(`BLAT opened no results widget: ${probe.widgetTypes}`)
  }
  await openFirstResult(driver, 'chr17:7579839')
  const navigated = await waitForSession(driver, s =>
    s.locStrings.some(loc => loc.includes('chr17')),
  )
  if (!navigated?.locStrings.some(loc => loc.includes('chr17'))) {
    throw new Error(
      `clicking the hit left the view at ${navigated?.locStrings.join('; ')}`,
    )
  }
  await waitForAppReady(driver) // the new track fetches and paints
  await collapseGeneGlyph(driver)
  await waitForAppReady(driver)
  // last, because collapsing the glyph is itself a height change: the span has
  // to be done moving at the moment the frame is taken, not before the edits
  // that move it
  const settled = await waitForStableSession(driver)
  console.log(`    DEBUG: settled at ${settled?.locStrings.join('; ')}`)
  await capture(driver, 'desktop-blat-results.png')
  // the query's own console output (runQuery logs its failures) is otherwise
  // only flushed by the fatal handler, so a run that captured a wrong-looking
  // figure without throwing left no trace of what the renderer saw
  await flushBrowserLogs(driver)
  await returnToStartScreen(driver)
}

async function main(): Promise<void> {
  console.log(`Running in ${isHeadless ? 'headless' : 'headed'} mode`)
  console.log(`App binary: ${APP_BINARY}`)
  if (ONLY.length > 0) {
    // a typo would otherwise drive the entire flow and write nothing
    if (selected.length === 0) {
      console.error(`ERROR: --only ${ONLY.join(',')} matches no figure`)
      console.error(`Known figures: ${FIGURES.join(', ')}`)
      process.exit(1)
    }
    console.log(`Writing ${selected.join(', ')}`)
  }

  if (!existsSync(APP_BINARY)) {
    console.error(`ERROR: App binary not found at ${APP_BINARY}`)
    console.error('Build it first with: pnpm package:linux:no-installer')
    process.exit(1)
  }
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true })
  }

  console.log('Cleaning up leftover processes...')
  await killProcesses()

  console.log(`Serving ${REPO_ROOT} on http://localhost:${DATA_PORT}...`)
  dataServer = await startStaticServer(REPO_ROOT, DATA_PORT)

  console.log(`Serving stand-in hgBlat on http://127.0.0.1:${BLAT_PORT}...`)
  blatServer = await startMockServer(BLAT_PORT, MOCK_BLAT_RESPONSE)

  console.log(`Serving stand-in hgPcr on http://127.0.0.1:${ISPCR_PORT}...`)
  ispcrServer = await startMockServer(ISPCR_PORT, MOCK_ISPCR_RESPONSE)

  console.log('Starting ChromeDriver...')
  chromedriverProcess = await startChromedriver()

  console.log('Launching Electron app...')
  driver = await createDriver()

  // Start screen
  console.log('Capturing start screen...')
  await waitForStartScreen(driver)
  await delay(1500) // let panels settle
  await capture(driver, 'desktop-landing.png')

  // BLAT / in-silico PCR dialogs on hg19, then back to the start screen
  await captureIsPcrFigures(driver)
  await captureBlatDialogs(driver)

  // "Open genome(s)" dialog (custom genome from files/URLs)
  console.log('Capturing open-genome dialog...')
  await clickButton(driver, 'Open new genome')
  await findByText(driver, 'Open genome(s)')
  await delay(1000)
  await capture(driver, 'desktop-open-genome.png')
  await cleanupUI(driver)

  // "Available genomes" dialog (searchable table of public assemblies, fetched
  // from jbrowse.org/hubs — wait for real rows, not the skeleton loader)
  console.log('Capturing available-genomes dialog...')
  await clickButton(driver, 'Show all available genomes')
  await findByText(driver, 'Available genomes')
  await driver.wait(until.elementLocated(By.css('table tbody tr')), 30000)
  await waitForAppReady(driver)
  await capture(driver, 'desktop-available-genomes.png')
  await cleanupUI(driver)

  // Loaded session with the bundled volvox assembly, served over http
  console.log('Opening volvox genome...')
  await openVolvoxGenome(
    driver,
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.fa`,
  )
  await waitForAppReady(driver)

  // Add the bundled volvox GFF3 genes track over http so the session screenshot
  // shows annotated genes instead of a bare sequence. An hg38 demo with NCBI
  // RefSeq + ClinVar is not viable here: the harness serves only local
  // test_data and the repo has no hg38 FASTA, and those tracks need remote
  // fetches that are unreliable/blocked in headless Electron.
  console.log('Adding volvox GFF3 genes track...')
  await openMenuItem(driver, 'File', 'Open track...')
  await findByText(driver, 'Add a track')
  await delay(1000)
  // The Main-file FileSelector defaults to URL mode (no location yet), so the
  // urlInput is already present; the index url auto-infers as <main>.tbi.
  const trackUrlInput = await driver.wait(
    until.elementLocated(By.css('[data-testid="urlInput"]')),
    10000,
  )
  await trackUrlInput.sendKeys(
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.sort.gff3.gz`,
  )
  await delay(500)
  await clickActiveAddTrackButton(driver) // Next: source -> confirm track type
  await delay(1500)
  await clickActiveAddTrackButton(driver) // Add: shows track + closes widget
  await waitForAppReady(driver) // the GFF3 track fetches and paints

  await capture(driver, 'desktop-session.png')

  // "Add a track" form (File -> Open track...)
  console.log('Capturing add-track form...')
  await openMenuItem(driver, 'File', 'Open track...')
  await findByText(driver, 'Add a track')
  await delay(1500)
  await capture(driver, 'desktop-add-track.png')
  await cleanupUI(driver)

  await shutdown(0)
}

main().catch(async e => {
  console.error('Fatal error:', e)
  if (driver) {
    try {
      await flushBrowserLogs(driver)
    } catch (err) {
      console.warn('WARN: could not flush browser logs:', err)
    }
    try {
      // the whole point of this one is diagnosing the failure, so --only can't
      // be allowed to skip it
      await capture(driver, 'desktop-debug-failure.png', tmpdir(), {
        ignoreOnly: true,
      })
    } catch (err) {
      console.warn('WARN: could not capture debug screenshot:', err)
    }
  }
  await shutdown(1)
})
