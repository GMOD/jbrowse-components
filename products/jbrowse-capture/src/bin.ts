#!/usr/bin/env node
import { trackName, trackType } from '@jbrowse/launch-args'

import { parseArgs } from './args.ts'
import { captureBatch, captureJBrowse } from './capture.ts'
import { resolveAgainstConfig } from './catalog.ts'
import { listHubAssemblies, listHubTracks } from './genome.ts'
import { readAnnotations, readBatch, readJson, readSpec } from './jsonArgs.ts'
import { PUBLIC_INSTANCE, jbrowseUrl } from './url.ts'
import { version } from './version.ts'

import type { ParsedArgs } from './args.ts'

const HELP = `jb2capture — screenshot a live JBrowse 2 view, once it has finished drawing

USAGE
  jb2capture [flags] --out <file.png>    open a view, wait for it, screenshot it
  jb2capture batch <json|path|-> [flags] screenshot many views from one browser
  jb2capture url [flags]                 print the URL instead of launching a browser
  jb2capture list [genome] [filter]      list hosted genomes, or one genome's trackIds

WHAT TO SHOW
  --genome <name>       a genomes.jbrowse.org genome: a UCSC db name (hg38, mm39)
                        or a GenArk accession (GCA_.../GCF_...)
  --config <url>        a config.json URL, for data that is not hosted there
  --assembly <name>     assembly to open (defaults to --genome)
  --loc <locstring>...  chr1:1,000-2,000, several for a discontinuous view, or a
                        gene name where the config has a text index (hosted
                        ones do)
  --track <trackId> [settings...]
                        a track to open, by trackId or name; repeat for several.
                        Settings follow it: height:200, force:true, a display
                        setting as path=value, or a JSON object
  --view <settings...>  view settings as path=value (axis.grid=false) or JSON
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

BATCH
  The manifest is a JSON array with one object per image. Each names its "out"
  and may set genome, config, assembly, loc, tracks, view, spec, session, width,
  height, dpr, fullPage and annotations; the flags above are the defaults for what an
  object leaves out. Every image gets a page of its own in one shared browser.
  A failed image is reported and the rest carry on; the exit code is 1 if any
  failed.

  --concurrency <n>     pages open at once (default 4)

OTHER
  --headed              run with a visible browser window
  --verbose             print browser console output and uncaught errors
                        (GPU noise filtered)
  --version, -v         the package version
  --help, -h            this text

EXAMPLES
  ## RefSeq genes and ClinVar at a gene, from hosted data, no setup
  jb2capture --genome hg38 --loc BRCA1 \\
    --track hg38-ncbiRefSeqCurated --track hg38-clinvarMain -o brca1.png

  ## a taller track and no ruler grid, in jb2export's and Desktop's grammar
  jb2capture --genome hg38 --loc EGFR --track ncbiRefSeqCurated height:200 \\
    --view axis.grid=false -o egfr.png

  ## find the trackIds first
  jb2capture list hg38 conservation

  ## one image per locus, from one browser
  jb2capture batch '[{"loc":"BRCA1","out":"brca1.png"},{"loc":"TP53","out":"tp53.png"}]' \\
    --genome hg38 --track hg38-ncbiRefSeqCurated

  ## your own config, two loci side by side
  jb2capture --config https://example.org/config.json --assembly mydata \\
    --loc "chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500" -o two.png
`

function urlOptions(args: ParsedArgs) {
  return {
    genome: args.genome,
    config: args.config,
    assembly: args.assembly,
    loc: args.loc,
    tracks: args.tracks.length ? args.tracks : undefined,
    view: Object.keys(args.view).length ? args.view : undefined,
    spec: args.spec ? readSpec(args.spec) : undefined,
    session: args.session ? readJson('session', args.session) : undefined,
    instance: args.instance,
  }
}

async function runBatch(args: ParsedArgs) {
  const [manifest, ...extra] = args.positionals
  if (!manifest || extra.length) {
    throw new Error(
      '`jb2capture batch` takes one manifest, right after the word: JSON, a path or -',
    )
  }
  const defaults = {
    ...urlOptions(args),
    width: args.width,
    height: args.height,
    dpr: args.dpr,
    fullPage: args.fullPage,
    annotations: args.annotations
      ? readAnnotations(args.annotations)
      : undefined,
    timeout: args.timeout,
    allowUnsettled: args.allowUnsettled,
    onConsole: args.verbose
      ? (text: string) => {
          console.error(`  [page] ${text}`)
        }
      : undefined,
  }
  const captures = readBatch(manifest).map(
    ({ spec, session, annotations, ...entry }) => ({
      ...defaults,
      // an entry that says what to open replaces the default session whole
      ...(spec || session ? { spec: undefined, session: undefined } : {}),
      ...entry,
      ...(spec
        ? { spec: typeof spec === 'string' ? readSpec(spec) : spec }
        : {}),
      ...(session
        ? {
            session:
              typeof session === 'string'
                ? readJson('session', session)
                : session,
          }
        : {}),
      ...(annotations
        ? {
            annotations:
              typeof annotations === 'string'
                ? readAnnotations(annotations)
                : annotations,
          }
        : {}),
    }),
  )
  const start = performance.now()
  const results = await captureBatch(captures, {
    headless: !args.headed,
    concurrency: args.concurrency,
    onResult: (result, index) => {
      const label = `[${index + 1}/${captures.length}] ${result.out} ${(result.ms / 1000).toFixed(1)}s`
      if (result.ok) {
        console.log(`wrote ${label}`)
      } else {
        console.error(`FAILED ${label}: ${result.error.message}`)
      }
    },
  })
  const failed = results.filter(r => !r.ok).length
  console.log(
    `wrote ${results.length - failed}/${results.length} images in ${((performance.now() - start) / 1000).toFixed(1)}s`,
  )
  if (failed) {
    process.exitCode = 1
  }
}

async function runList(positionals: string[]) {
  const [genome, filter] = positionals
  if (!genome) {
    const assemblies = await listHubAssemblies()
    const pad = Math.max(...assemblies.map(a => a.name.length))
    for (const a of assemblies) {
      const about = [a.organism, a.description].filter(Boolean).join(' — ')
      console.log(`  ${a.name.padEnd(pad)}  ${about}`)
    }
    console.log(
      '\nGenArk accessions (GCA_…/GCF_…) work as --genome too; browse them at ' +
        "https://genomes.jbrowse.org. List one assembly's tracks with " +
        '`jb2capture list <name> [filter]`.',
    )
    return
  }
  const tracks = await listHubTracks(genome, filter)
  if (!tracks.length) {
    throw new Error(
      filter
        ? `no track in ${genome} matches "${filter}"`
        : `${genome} publishes no tracks`,
    )
  }
  const pad = Math.min(60, Math.max(...tracks.map(t => t.trackId.length)))
  for (const t of tracks) {
    console.log(
      `  ${t.trackId.padEnd(pad)}  ${trackType(t).padEnd(18)}  ${trackName(t)}`,
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
  if (args.command === 'batch') {
    await runBatch(args)
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
