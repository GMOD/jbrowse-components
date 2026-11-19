#!/usr/bin/env node
import { formatHostedGenomes, formatHostedTracks } from '@jbrowse/launch-args'

import { parseArgs } from './args.ts'
import { captureBatch, captureJBrowse } from './capture.ts'
import { resolveAgainstConfig } from './catalog.ts'
import { hostedGenomes, hostedTracks } from './genome.ts'
import {
  batchCapture,
  readAnnotations,
  readBatch,
  readJson,
  readSpec,
} from './jsonArgs.ts'
import { PUBLIC_INSTANCE, jbrowseUrl } from './url.ts'
import { version } from './version.ts'

import type { ParsedArgs } from './args.ts'
import type { BatchResult, CaptureOptions } from './capture.ts'
import type { ReadyReport } from './ready.ts'

const LISTING = { command: 'jb2capture', out: 'out.png' }

const HELP = `jb2capture — screenshot a live JBrowse 2 view, once it has finished drawing

USAGE
  jb2capture [flags] --out <file.png>    open a view, wait for it, screenshot it
  jb2capture batch <json|path|-> [flags] screenshot many views from one browser
  jb2capture url [flags]                 print the URL instead of launching a browser
  jb2capture list [genome] [filter]      list hosted genomes, or one genome's trackIds
  jb2capture synteny|dotplot --genome <name> [loc:<region>] --genome <name> ...
                                         compare hosted genomes, one row per
                                         --genome, joined by their liftOvers

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
  --json                print the result on stdout as JSON instead: the image,
                        its URL, what did not settle, and the session as
                        jb.sessionSummary() describes it (each view's visible
                        region, each track's display, height and any error)
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
    comparative: args.comparative,
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

// what a capture and every image of a batch take from the command line
function captureOptions(args: ParsedArgs): CaptureOptions {
  return {
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
      ? text => {
          console.error(`  [page] ${text}`)
        }
      : undefined,
  }
}

function warn(
  { tooLarge, unsettled }: Pick<ReadyReport, 'tooLarge' | 'unsettled'>,
  indent = '',
) {
  if (unsettled.length) {
    console.error(`${indent}Warning: --allowUnsettled: ${unsettled.join('; ')}`)
  }
  if (tooLarge.length) {
    console.error(
      `${indent}Warning: ${tooLarge.length} display(s) show "too much data" instead of their features ` +
        `(${tooLarge.map(d => d.name).join(', ')}). Narrow --loc to draw them.`,
    )
  }
}

const printJson = (value: unknown) => {
  console.log(JSON.stringify(value, null, 2))
}

function batchRecord(result: BatchResult) {
  if (result.ok) {
    const { image: _, ...rest } = result
    return rest
  } else {
    const { error, ...rest } = result
    return { ...rest, error: error.message }
  }
}

async function runBatch(args: ParsedArgs) {
  const [manifest, ...extra] = args.positionals
  if (!manifest || extra.length) {
    throw new Error(
      '`jb2capture batch` takes one manifest, right after the word: JSON, a path or -',
    )
  }
  const defaults = captureOptions(args)
  const captures = readBatch(manifest).map(entry =>
    batchCapture(defaults, entry),
  )
  const start = performance.now()
  const results = await captureBatch(captures, {
    headless: !args.headed,
    concurrency: args.concurrency,
    onResult: (result, index) => {
      const label = `[${index + 1}/${captures.length}] ${result.out} ${(result.ms / 1000).toFixed(1)}s`
      if (!result.ok) {
        console.error(`FAILED ${label}: ${result.error.message}`)
      } else if (args.json) {
        console.error(`wrote ${label}`)
      } else {
        console.log(`wrote ${label}`)
        warn(result, '  ')
      }
    },
  })
  const failed = results.filter(r => !r.ok).length
  const summary = `wrote ${results.length - failed}/${results.length} images in ${((performance.now() - start) / 1000).toFixed(1)}s`
  if (args.json) {
    console.error(summary)
    printJson(results.map(batchRecord))
  } else {
    console.log(summary)
  }
  if (failed) {
    process.exitCode = 1
  }
}

async function runList([genome, filter]: string[]) {
  if (genome) {
    const { text, matched } = formatHostedTracks(
      genome,
      await hostedTracks(genome),
      filter,
      LISTING,
    )
    console.log(text)
    if (matched === 0) {
      process.exitCode = 1
    }
  } else {
    console.log(formatHostedGenomes(await hostedGenomes(), LISTING))
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
  const { image: _, ...result } = await captureJBrowse({
    ...captureOptions(args),
    out: args.out,
    headless: !args.headed,
  })
  if (args.json) {
    printJson({ out: args.out, ...result })
  } else {
    console.log(`wrote ${args.out}`)
    console.log(`from  ${result.url}`)
    warn(result)
  }
}

try {
  await main()
} catch (error) {
  console.error(
    `jb2capture: ${error instanceof Error ? (error.constructor === Error ? error.message : error.stack) : error}`,
  )
  process.exitCode = 1
}
