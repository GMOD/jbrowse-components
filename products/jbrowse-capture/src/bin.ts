#!/usr/bin/env node
import { readFileSync } from 'node:fs'

import { parseArgs } from './args.ts'
import { captureJBrowse } from './capture.ts'
import { listHubTracks } from './hub.ts'
import { PAINT_CONTRACT_NOTE } from './sessionGate.ts'
import { jbrowseUrl } from './url.ts'

import type { ParsedArgs } from './args.ts'

const HELP = `jb2capture — screenshot a live JBrowse 2 view, once it has finished drawing

USAGE
  jb2capture [flags] --out <file.png>    open a view, wait for it, screenshot it
  jb2capture url [flags]                 print the URL instead of launching a browser
  jb2capture list <hub> [filter]         list a hosted assembly's trackIds

WHAT TO SHOW
  --hub <name>          a genomes.jbrowse.org assembly: a UCSC db name (hg38, mm39)
                        or a GenArk accession (GCA_.../GCF_...)
  --config <url>        a config.json URL, for data that is not hosted there
  --assembly <name>     assembly to open (defaults to --hub)
  --loc <locstring>     where to go: chr1:1,000-2,000, or several space-separated
                        for a discontinuous view. On a config with a text index —
                        every UCSC assembly on genomes.jbrowse.org has one — a
                        gene name such as BRCA1 also works.
  --track <trackId>     a track to open; repeat for several
  --session <json|path> a full session spec, for several views or per-display
                        settings. Replaces --assembly/--loc/--track.
  --instance <url>      JBrowse Web deployment to drive
                        (default https://jbrowse.org/code/jb2/latest/)
  --sessionName <name>  name the opened session carries

THE IMAGE
  --out, -o <file>      PNG to write (required unless using a subcommand)
  --width <px>          viewport width (default 1400)
  --height <px>         viewport height (default 900)
  --scale <n>           device pixel ratio (default 2)
  --fullPage            capture the whole scrollable page, not just the viewport

WAITING
  --timeout <ms>        budget per wait stage (default 60000)
  --settle <ms>         extra pause after everything reports drawn (default 0)
  --allowUnsettled      write the image anyway when a stage times out

  Every stage is waited on for you: the session holding the assembly and tracks
  you asked for, the view resolving, tracks fetching, displays painting, and any
  leftover "Loading…" text. A stage that times out FAILS the run rather than
  quietly handing back a half-drawn frame — raise --timeout, or pass
  --allowUnsettled if you want the frame as it stands.

OTHER
  --headed              run with a visible browser window
  --verbose             print browser console output (GPU noise filtered)
  --help, -h            this text

EXAMPLES
  ## RefSeq genes and ClinVar at a gene, from hosted data, no setup
  jb2capture --hub hg38 --loc BRCA1 \\
    --track hg38-ncbiRefSeqCurated --track hg38-clinvarMain -o brca1.png

  ## find the trackIds first
  jb2capture list hg38 conservation

  ## your own config, two loci side by side
  jb2capture --config https://example.org/config.json --assembly mydata \\
    --loc "chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500" -o two.png
`

function readSession(value: string): object {
  const text = value.trimStart().startsWith('{')
    ? value
    : readFileSync(value, 'utf8')
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('--session must be a JSON object')
  }
  return parsed
}

function urlOptions(args: ParsedArgs) {
  return {
    hub: args.hub,
    config: args.config,
    assembly: args.assembly,
    loc: args.loc,
    tracks: args.tracks.length ? args.tracks : undefined,
    session: args.session ? readSession(args.session) : undefined,
    sessionName: args.sessionName,
    instance: args.instance,
  }
}

async function runList(rest: string[]) {
  const [hub, filter] = rest
  if (!hub) {
    throw new Error(
      'list needs an assembly, e.g. `jb2capture list hg38`. ' +
        'Browse them at https://genomes.jbrowse.org.',
    )
  }
  const tracks = await listHubTracks(hub, filter)
  if (!tracks.length) {
    throw new Error(
      filter
        ? `no track in ${hub} matches "${filter}"`
        : `${hub} publishes no tracks`,
    )
  }
  const pad = Math.min(60, Math.max(...tracks.map(t => t.trackId.length)))
  for (const t of tracks) {
    console.log(
      `  ${t.trackId.padEnd(pad)}  ${(t.type ?? '').padEnd(18)}  ${t.name ?? ''}`,
    )
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const [first, ...rest] = argv
  if (first === 'list') {
    await runList(rest)
    return
  }
  const isUrlOnly = first === 'url'
  const args = parseArgs(isUrlOnly ? rest : argv)
  if (args.help || argv.length === 0) {
    console.log(HELP)
    return
  }
  if (isUrlOnly) {
    console.log(jbrowseUrl(urlOptions(args)))
    return
  }
  if (!args.out) {
    throw new Error('--out <file.png> is required (or use `jb2capture url`)')
  }
  const { url, pending, paintContract, unsettled } = await captureJBrowse({
    ...urlOptions(args),
    out: args.out,
    width: args.width,
    height: args.height,
    deviceScaleFactor: args.scale,
    fullPage: args.fullPage,
    headless: !args.headed,
    timeout: args.timeout,
    settleMs: args.settle,
    allowUnsettled: args.allowUnsettled,
    onConsole: args.verbose
      ? text => {
          console.error(`  [page] ${text}`)
        }
      : undefined,
  })
  console.log(`wrote ${args.out}`)
  console.log(`from  ${url}`)
  // Reached only when the wait either succeeded or was explicitly overridden, so
  // these are notes on an image that exists rather than failures. They still get
  // said out loud: "everything painted", "we stopped waiting" and "paint could
  // not be measured here" all look identical in a PNG.
  if (unsettled.length) {
    console.error(`warning: --allowUnsettled: ${unsettled.join('; ')}`)
  }
  if (pending.length) {
    console.error(
      `warning: ${pending.length} display(s) had not finished drawing at capture time ` +
        `(${pending.join(', ')}). Raise --timeout, or --settle for a slow remote file.`,
    )
  } else if (!paintContract) {
    console.error(`note: ${PAINT_CONTRACT_NOTE}`)
  }
}

try {
  await main()
} catch (error) {
  console.error(`jb2capture: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
}
