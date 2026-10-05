#!/usr/bin/env node
import { parseArgs } from './args.ts'
import { captureJBrowse } from './capture.ts'
import { resolveAgainstConfig } from './catalog.ts'
import { listHubAssemblies, listHubTracks, trackName } from './hub.ts'
import { readAnnotations, readJson, readSpec } from './jsonArgs.ts'
import { PUBLIC_INSTANCE, jbrowseUrl } from './url.ts'
import { version } from './version.ts'

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
  --spec <json|path|->  a session spec, for several views or per-display settings
  --session <path|->    a session saved with File → Export session
  --instance <url>      JBrowse Web deployment to drive
                        (default ${PUBLIC_INSTANCE})

THE IMAGE
  --out, -o <file>      .png, .jpg or .webp to write (required unless using a
                        subcommand)
  --width <px>          viewport width (default 1400)
  --height <px>         viewport height (default 900)
  --dpr <n>             device pixel ratio (default 2)
  --fullPage            grow the image until every view fits, not just the
                        --height of the viewport
  --annotations <json|path|->
                        callouts to draw over the view: a JSON array of arrows,
                        boxes and labels, each anchored to a locus, a graph
                        node, a dotplot cell or an element

WAITING
  --timeout <ms>        budget per wait stage (default 60000)
  --allowUnsettled      write the image anyway when a stage times out or a
                        display is showing an error or a cancel

  Either fails the run rather than writing a frame that is not the picture.

OTHER
  --headed              run with a visible browser window
  --verbose             print browser console output and uncaught errors
                        (GPU noise filtered)
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

function urlOptions(args: ParsedArgs) {
  return {
    hub: args.hub,
    config: args.config,
    assembly: args.assembly,
    loc: args.loc,
    tracks: args.tracks.length ? args.tracks : undefined,
    spec: args.spec ? readSpec(args.spec) : undefined,
    session: args.session ? readJson('session', args.session) : undefined,
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
      `  ${t.trackId.padEnd(pad)}  ${(t.type ?? '').padEnd(18)}  ${trackName(t)}`,
    )
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  if (args.help || argv.length === 0) {
    console.log(HELP)
    return
  }
  if (args.version) {
    console.log(version)
    return
  }
  if (args.command === 'list') {
    await runList(args.positionals)
    return
  }
  if (args.command === 'url') {
    console.log(jbrowseUrl(await resolveAgainstConfig(urlOptions(args))))
    return
  }
  if (!args.out) {
    throw new Error('--out <file.png> is required (or use `jb2capture url`)')
  }
  const { url, tooLarge, unsettled } = await captureJBrowse({
    ...urlOptions(args),
    out: args.out,
    width: args.width,
    height: args.height,
    dpr: args.dpr,
    fullPage: args.fullPage,
    annotations: args.annotations
      ? readAnnotations(args.annotations)
      : undefined,
    headless: !args.headed,
    timeout: args.timeout,
    allowUnsettled: args.allowUnsettled,
    onConsole: args.verbose
      ? text => {
          console.error(`  [page] ${text}`)
        }
      : undefined,
  })
  console.log(`wrote ${args.out}`)
  console.log(`from  ${url}`)
  if (unsettled.length) {
    console.error(`warning: --allowUnsettled: ${unsettled.join('; ')}`)
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
