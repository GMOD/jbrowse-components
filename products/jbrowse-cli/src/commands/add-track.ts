import path from 'node:path'
import { parseArgs } from 'node:util'

import { printHelp, readJsonFile, resolveConfigPath } from '../utils.ts'
import {
  guessTrack,
  guessTrackType,
  makeLocationProtocol,
} from './add-track-utils/adapter-utils.ts'
import { loadFiles } from './add-track-utils/file-operations.ts'
import { buildMultiWiggle } from './add-track-utils/multiwig.ts'
import {
  addSyntenyAssemblyNames,
  buildTrackConfig,
  mapLocationForFiles,
  mergeDisplayDefaults,
} from './add-track-utils/track-config.ts'
import {
  parseConfigFlag,
  validateAdapterType,
  validateAssemblies,
  validateLoadAndLocation,
  validateLoadOption,
  validateMultiWiggleLoad,
  validateTrackArg,
  warnUnknownAssemblyNames,
} from './add-track-utils/validators.ts'
import {
  findAndUpdateOrAdd,
  saveConfigAndReport,
} from './shared/config-operations.ts'

import type { Config } from '../base.ts'
import type { Adapter, Location } from './add-track-utils/adapter-utils.ts'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    trackType: {
      type: 'string',
      short: 't',
      description: 'Type of track, by default inferred from track file',
    },
    adapterType: {
      type: 'string',
      description: 'Adapter type, by default inferred from track file',
    },
    name: {
      type: 'string',
      short: 'n',
      description:
        'Name of the track. Will be defaulted to the trackId if none specified',
    },
    indexFile: {
      type: 'string',
      description: 'Optional index file for the track',
    },
    description: {
      type: 'string',
      short: 'd',
      description: 'Optional description of the track',
    },
    assemblyNames: {
      type: 'string',
      short: 'a',
      description:
        'Assembly name or names for track as comma separated string. For pairwise synteny tracks the order is query,target (reverse of minimap2/nucmer argument order); for all-vs-all adapters (AllVsAllPAFAdapter/AllVsAllIndexedPAFAdapter) list every assembly the file covers, in any order',
    },
    category: {
      type: 'string',
      description:
        'Optional comma separated string of categories to group tracks',
    },
    config: {
      type: 'string',
      description: 'Any extra config settings to add to a track',
    },
    color: {
      type: 'string',
      description:
        'Track color: a plain CSS color or a jexl callback. Merged into displayDefaults',
    },
    height: {
      type: 'string',
      description:
        'Track display height in pixels. Merged into displayDefaults',
    },
    displayDefaults: {
      type: 'string',
      description:
        'Inline JSON merged into the track displayDefaults (labels, mouseover, jexlFilters, etc.)',
    },
    multiwig: {
      type: 'string',
      description:
        'Build a MultiQuantitativeTrack from several BigWigs (in place of the positional track arg): a comma-separated list of BigWig files/URLs, or a .json file holding an array of BigWig locations or subadapter objects, each with its own name/color',
    },
    target: {
      type: 'string',
      description: 'Path to config file in JB2 installation to write out to',
    },
    out: {
      type: 'string',
      description: 'Synonym for target',
    },
    subDir: {
      type: 'string',
      description:
        'When using --load a file, output to a subdirectory of the target dir',
    },
    trackId: {
      type: 'string',
      description: 'trackId for the track, by default inferred from filename',
    },
    load: {
      type: 'string',
      short: 'l',
      description:
        'How to manage the track file relative to config.json. Required for local files, omit for URLs',
      choices: ['copy', 'symlink', 'move', 'inPlace'],
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Overwrite existing track and any existing files',
    },
    protocol: {
      type: 'string',
      description: 'Force protocol to a specific value',
    },
    bed1: {
      type: 'string',
      description: 'Used only for mcscan anchors/simpleAnchors types',
    },
    bed2: {
      type: 'string',
      description: 'Used only for mcscan anchors/simpleAnchors types',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Add a track to a JBrowse 2 configuration'

  const notes =
    '--load controls how the data file is placed relative to config.json: ' +
    'copy, move, or symlink it into the install directory, or inPlace to ' +
    'reference a pre-staged local file where it already sits. Omit --load ' +
    'entirely for URLs. The matching index (.bai/.csi/.tbi/.fai) is inferred from the ' +
    'data file name; pass --indexFile when it differs.\n\n' +
    '--config takes inline JSON (not a file path) that is merged into the ' +
    'generated track config, so you can set fields the dedicated flags do not ' +
    'cover, e.g. --config \'{"metadata":{"skipTextIndex":true}}\' to exclude ' +
    'the track from jbrowse text-index.\n\n' +
    '--color and --height set the two most common appearance settings without ' +
    'writing JSON. Wrap the value in single quotes and use double quotes inside ' +
    'a jexl callback so nothing needs escaping, e.g. ' +
    '--color \'jexl:feature.strand==1?"blue":"red"\'. --displayDefaults takes ' +
    'inline JSON for any other appearance setting (labels, mouseover, ' +
    'jexlFilters).\n\n' +
    '--multiwig bundles several BigWigs into one MultiQuantitativeTrack, in ' +
    'place of the positional track argument: pass a comma-separated list of ' +
    'BigWig files/URLs, or a .json file with an array of BigWig locations or ' +
    'subadapter objects (each carrying its own name/color/group). With --load, ' +
    'local list entries are copied like any other track file.\n\n' +
    'For pairwise synteny adapters (PAF/Delta/Chain) --assemblyNames is ' +
    'query,target — the reverse of the minimap2/nucmer input order. For the ' +
    'all-vs-all adapters (AllVsAllPAFAdapter, AllVsAllIndexedPAFAdapter) it is ' +
    'instead the full list of assemblies the file covers, in any order, since ' +
    'one all-vs-all file backs every pair.'

  const examples = [
    '# copy /path/to/my.bam and /path/to/my.bam.bai to current directory and adds track to config.json',
    '$ jbrowse add-track /path/to/my.bam --load copy',
    '',
    '# copy my.bam and my.bam.bai to /path/to/jb2/bam and adds track entry to /path/to/jb2/bam/config.json',
    '$ jbrowse add-track my.bam --load copy --out /path/to/jb2 --subDir bam',
    '',
    '# same as above, but specify path to bai file. needed for if the bai file does not have the extension .bam.bai',
    '$ jbrowse add-track my.bam --indexFile my.bai --load copy',
    '',
    '# creates symlink for /path/to/my.bam and adds track to config.json',
    '$ jbrowse add-track /path/to/my.bam --load symlink',
    '',
    '# add track from URL to config.json, no --load flag needed',
    '$ jbrowse add-track https://mywebsite.com/my.bam',
    '',
    '# --load inPlace adds a track without doing file operations',
    '$ jbrowse add-track /url/relative/path.bam --load inPlace',
    '',
    '# color a track by strand and set its height (no escaping: single-quote the value, double-quote inside the jexl)',
    `$ jbrowse add-track genes.gff3.gz --load copy --color 'jexl:feature.strand==1?"blue":"red"' --height 200`,
    '',
    '# bundle several BigWigs into one MultiQuantitativeTrack (no positional track arg)',
    '$ jbrowse add-track --multiwig a.bw,b.bw,c.bw --load copy --name "Coverage"',
    '',
    '# ...or from a sources.json carrying per-row name/color for each BigWig',
    '$ jbrowse add-track --multiwig sources.json --name "CATlas ATAC"',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse add-track <track> [options]',
      options,
    })
    return
  }

  validateLoadOption(flags.load)

  const {
    config,
    force,
    category,
    description: trackDescription,
    load,
    subDir = '',
    target,
    protocol = 'uri',
    out,
    indexFile: index,
    bed1,
    bed2,
    adapterType,
    multiwig,
  } = flags

  const location = positionals[0]
  if (multiwig && location) {
    throw new Error(
      'Pass either a positional track file or --multiwig, not both',
    )
  }

  const wrap = makeLocationProtocol(protocol)
  const mapLocation = (p: string) => wrap(mapLocationForFiles(p, load, subDir))

  // build the adapter (and the set of files to load) up front, so the track-arg
  // and load validation runs before we touch the config on disk
  const { adapter, files, trackType, trackId } = multiwig
    ? buildMultiWiggleTrack({
        sources: multiwig,
        mapLocation,
        load,
        trackType: flags.trackType,
        trackId: flags.trackId,
      })
    : buildFileTrack({
        location,
        index,
        bed1,
        bed2,
        adapterType,
        assemblyNames: flags.assemblyNames,
        mapLocation,
        load,
        trackType: flags.trackType,
        trackId: flags.trackId,
      })

  const baseConfigObj = config ? parseConfigFlag(config) : undefined
  const displayDefaults = mergeDisplayDefaults({
    configObj: baseConfigObj,
    color: flags.color,
    height: flags.height,
    displayDefaults: flags.displayDefaults,
  })
  const configObj = displayDefaults
    ? { ...baseConfigObj, displayDefaults }
    : baseConfigObj

  const targetConfigPath = await resolveConfigPath(target, out)
  const configDir = path.dirname(targetConfigPath)

  const configContents: Config = await readJsonFile(targetConfigPath)
  validateAssemblies(configContents, flags.assemblyNames)

  const name = flags.name || trackId
  const assemblyNames =
    flags.assemblyNames || configContents.assemblies?.[0]?.name || ''
  warnUnknownAssemblyNames(configContents, assemblyNames)

  const trackConfig = buildTrackConfig({
    trackType,
    trackId,
    name,
    assemblyNames,
    category,
    description: trackDescription,
    configObj,
    adapter,
  })

  const { updatedItems: tracks, wasOverwritten } = findAndUpdateOrAdd({
    items: configContents.tracks ?? [],
    newItem: trackConfig,
    idField: 'trackId',
    getId: item => item.trackId,
    force: force ?? false,
    itemType: 'track',
  })
  const updatedConfig = { ...configContents, tracks }

  await loadFiles({
    files,
    destDir: configDir,
    mode: load,
    subDir,
    force,
  })

  await saveConfigAndReport({
    config: updatedConfig,
    target: targetConfigPath,
    itemType: 'track',
    itemName: name,
    itemId: trackId,
    wasOverwritten,
  })
}

// what both track-building paths resolve to: the adapter, the local files to
// load beside the config, and the track's type/id (either derived or overridden)
interface BuiltTrack {
  adapter: Adapter
  files: (string | undefined)[]
  trackType: string
  trackId: string
}

// --multiwig: bundle several BigWigs into one MultiQuantitativeTrack
function buildMultiWiggleTrack({
  sources,
  mapLocation,
  load,
  trackType,
  trackId,
}: {
  sources: string
  mapLocation: (l: string) => Location
  load?: string
  trackType?: string
  trackId?: string
}): BuiltTrack {
  const { adapter, files } = buildMultiWiggle({ sources, mapLocation })
  validateMultiWiggleLoad(files.length > 0, load)
  return {
    adapter,
    files,
    trackType: trackType || 'MultiQuantitativeTrack',
    trackId: trackId || multiWiggleTrackId(sources),
  }
}

// the usual path: one positional data file, adapter guessed from its extension
function buildFileTrack({
  location,
  index,
  bed1,
  bed2,
  adapterType,
  assemblyNames,
  mapLocation,
  load,
  trackType,
  trackId,
}: {
  location?: string
  index?: string
  bed1?: string
  bed2?: string
  adapterType?: string
  assemblyNames?: string
  mapLocation: (l: string) => Location
  load?: string
  trackType?: string
  trackId?: string
}): BuiltTrack {
  validateTrackArg(location)
  validateLoadAndLocation(location, load)
  const { adapter: guessedAdapter, files } = guessTrack({
    location,
    index,
    bed1,
    bed2,
    adapterType,
    mapLocation,
  })
  const adapter = addSyntenyAssemblyNames(guessedAdapter, assemblyNames)
  validateAdapterType(adapter.type)
  return {
    adapter,
    files,
    trackType: trackType || guessTrackType(adapter.type),
    trackId: trackId || path.basename(location, path.extname(location)),
  }
}

// a .json sources file names the track after itself (sources.json -> sources); a
// bare comma list has no filename to borrow, so it falls back to 'multiwiggle'
function multiWiggleTrackId(sources: string): string {
  return sources.toLowerCase().endsWith('.json')
    ? path.basename(sources, path.extname(sources))
    : 'multiwiggle'
}
