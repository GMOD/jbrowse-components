#!/usr/bin/env node
import { readFileSync } from 'node:fs'

import { parseArgs } from './args.ts'
import { captureJBrowse } from './capture.ts'
import { resolveAgainstConfig } from './catalog.ts'
import { listHubAssemblies, listHubTracks } from './hub.ts'
import { describePendingDisplays } from './sessionGate.ts'
import { jbrowseUrl } from './url.ts'

import type { ParsedArgs } from './args.ts'

const HELP = `jb2capture — screenshot a live JBrowse 2 view, once it has finished drawing

USAGE
  jb2capture [flags] --out <file.png>    open a view, wait for it, screenshot it
  jb2capture url [flags]                 print the URL instead of launching a browser
  jb2capture list [hub] [filter]         list hosted assemblies, or one's trackIds

WHAT TO SHOW
  --hub <name>          a genomes.jbrowse.org assembly: a UCSC db name (hg38, mm39)
                        or a GenArk accession (GCA_.../GCF_...)
  --config <url>        a config.json URL, for data that is not hosted there
  --assembly <name>     assembly to open (defaults to --hub)
  --loc <locstring>     chr1:1,000-2,000, several space-separated, or a gene name
                        where the config has a text index (hosted ones do)
  --track <trackId>     a track to open, by trackId or name; repeat for several
  --session <json|path> a full session spec, for several views or per-display
                        settings. Not combinable with --assembly/--loc/--track.
  --instance <url>      JBrowse Web deployment to drive
                        (default https://jbrowse.org/code/jb2/latest/)

THE IMAGE
  --out, -o <file>      .png, .jpg or .webp to write (required unless using a
                        subcommand)
  --width <px>          viewport width (default 1400)
  --height <px>         viewport height (default 900)
  --scale <n>           device pixel ratio (default 2)
  --fullPage            grow the image until every view fits, not just the
                        --height of the viewport

WAITING
  --timeout <ms>        budget per wait stage (default 60000)
  --settle <ms>         extra pause before the census and the shot (default 0)
  --allowUnsettled      write the image anyway when a stage times out

  A stage that times out fails the run rather than writing a half-drawn frame.

OTHER
  --headed              run with a visible browser window
  --verbose             print browser console output (GPU noise filtered)
  --version, -v         the package version
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
    instance: args.instance,
  }
}

async function runList(positionals: string[]) {
  const [hub, filter] = positionals
  if (!hub) {
    const assemblies = await listHubAssemblies()
    const pad = Math.max(...assemblies.map(a => a.name.length))
    for (const a of assemblies) {
      const about = [a.organism, a.description].filter(Boolean).join(' — ')
      console.log(`  ${a.name.padEnd(pad)}  ${about}`)
    }
    console.log(
      '\nGenArk accessions (GCA_…/GCF_…) work as --hub too; browse them at ' +
        "https://genomes.jbrowse.org. List one assembly's tracks with " +
        '`jb2capture list <name> [filter]`.',
    )
    return
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
  // `list` is the one form that takes bare words, so it is the one that allows
  // positionals. Routing it through the parser at all is what makes a flag
  // after it an error: `list hg38 --foo` used to filter the track list on the
  // string "--foo" and report that nothing matched.
  const isSubcommand = first === 'list' || first === 'url'
  const args = parseArgs(isSubcommand ? rest : argv, {
    allowPositionals: first === 'list',
  })
  if (args.help || argv.length === 0) {
    console.log(HELP)
    return
  }
  if (args.version) {
    const { version } = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    console.log(version)
    return
  }
  if (first === 'list') {
    await runList(args.positionals)
    return
  }
  if (first === 'url') {
    console.log(jbrowseUrl(await resolveAgainstConfig(urlOptions(args))))
    return
  }
  if (!args.out) {
    throw new Error('--out <file.png> is required (or use `jb2capture url`)')
  }
  const { url, pending, tooLarge, unsettled } = await captureJBrowse({
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
        `(${describePendingDisplays(pending)}). Raise --timeout, or --settle for a slow remote file.`,
    )
  }
  if (tooLarge.length) {
    console.error(
      `warning: ${tooLarge.length} display(s) show "too much data" instead of their features ` +
        `(${tooLarge.map(d => d.name).join(', ')}). Narrow --loc to draw them.`,
    )
  }
}

try {
  await main()
} catch (error) {
  console.error(`jb2capture: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
}
