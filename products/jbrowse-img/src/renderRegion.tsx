import fs from 'fs'
import path from 'path'
import { renderToSvg } from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view'
import { createRoot } from 'react-dom/client'

// local
import { booleanize } from './util'
import type { Entry } from './parseArgv'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface Opts {
  noRasterize?: boolean
  loc?: string
  width?: number
  session?: string
  assembly?: string
  config?: string
  fasta?: string
  aliases?: string
  cytobands?: string
  defaultSession?: string
  trackList?: Entry[]
  tracks?: string
}

function read(file: string): unknown {
  let res: unknown
  try {
    res = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(
      `Failed to parse ${file} as JSON, use --fasta if you mean to pass a FASTA file`,
      { cause: e },
    )
  }
  return res
}
function makeLocation(file: string) {
  return file.startsWith('http') ? { uri: file } : { localPath: file }
}

function addRelativePaths(config: Record<string, unknown>, configPath: string) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativePaths(config[key] as Record<string, unknown>, configPath)
      } else if (key === 'localPath') {
        config.localPath = path.resolve(configPath, config.localPath as string)
      }
    }
  }
}

interface Assembly {
  name: string
  sequence: Record<string, unknown>
  refNameAliases?: Record<string, unknown>
  cytobands?: Record<string, unknown>
}

interface Track {
  trackId: string
  [key: string]: unknown
}
interface Config {
  assemblies: Assembly[]
  assembly: Assembly
  tracks: Track[]
  [key: string]: unknown
}

export function readData({
  assembly: asm,
  config,
  session,
  fasta,
  aliases,
  cytobands,
  defaultSession,
  tracks,
  trackList = [],
}: Opts) {
  const assemblyData =
    asm && fs.existsSync(asm) ? (read(asm) as Assembly) : undefined
  const tracksData = tracks ? (read(tracks) as Track[]) : undefined
  const configData = config ? (read(config) as Config) : ({} as Config)

  let sessionData = session
    ? (read(session) as Record<string, unknown>)
    : undefined

  if (config) {
    addRelativePaths(configData, path.dirname(path.resolve(config)))
  }

  // the session.json can be a raw session or a json file with a "session"
  // attribute, which is what is exported via the "File->Export session" in
  // jbrowse-web
  if (sessionData?.session) {
    sessionData = sessionData.session as Record<string, unknown>
  }

  // only export first view
  if (sessionData?.views) {
    sessionData.view = (sessionData.views as Record<string, unknown>[])[0]
  }

  // use assembly from file if a file existed
  if (assemblyData) {
    configData.assembly = assemblyData
  }
  // else check if it was an assembly name in a config file
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  else if (configData.assemblies?.length) {
    configData.assemblies.find(entry => entry.name === asm)
    if (asm) {
      const assembly = configData.assemblies.find(entry => entry.name === asm)
      if (!assembly) {
        throw new Error(`assembly ${asm} not found in config`)
      }
      configData.assembly = assembly
    } else {
      configData.assembly = configData.assemblies[0]!
    }
  }
  // else load fasta from command line
  else if (fasta) {
    const bgzip = fasta.endsWith('gz')

    configData.assembly = {
      name: path.basename(fasta),
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'refseq',
        adapter: {
          type: bgzip ? 'BgzipFastaAdapter' : 'IndexedFastaAdapter',
          fastaLocation: makeLocation(fasta),
          faiLocation: makeLocation(`${fasta}.fai`),
          gziLocation: bgzip ? makeLocation(`${fasta}.gzi`) : undefined,
        },
      },
    }
    if (aliases) {
      configData.assembly.refNameAliases = {
        adapter: {
          type: 'RefNameAliasAdapter',
          location: makeLocation(aliases),
        },
      }
    }
    if (cytobands) {
      configData.assembly.cytobands = {
        adapter: {
          type: 'CytobandAdapter',
          location: makeLocation(cytobands),
        },
      }
    }
  }

  // throw if still no assembly
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!configData.assembly) {
    throw new Error(
      'no assembly specified, use --fasta to supply an indexed FASTA file (generated with samtools faidx yourfile.fa). see README for alternatives with --assembly and --config',
    )
  }

  if (tracksData) {
    configData.tracks = tracksData
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  else if (!configData.tracks) {
    configData.tracks = []
  }

  trackList.forEach(track => {
    const [type, opts] = track
    const [file, ...rest] = opts
    const index = rest.find(r => r.startsWith('index:'))?.replace('index:', '')
    if (!file) {
      throw new Error('no file specified')
    }

    if (type === 'bam') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'AlignmentsTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'BamAdapter',
            bamLocation: makeLocation(file),
            index: {
              location: makeLocation(index || `${file}.bai`),
              indexType: index?.endsWith('.csi') ? 'CSI' : 'BAI',
            },
            sequenceAdapter: configData.assembly.sequence.adapter,
          },
          ...(opts.includes('snpcov')
            ? {
                displays: [
                  {
                    type: 'LinearSNPCoverageDisplay',
                    displayId: `${path.basename(file)}-${Math.random()}`,
                  },
                ],
              }
            : {}),
        },
      ]
    }
    if (type === 'cram') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'AlignmentsTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'CramAdapter',
            cramLocation: makeLocation(file),
            craiLocation: makeLocation(index || `${file}.crai`),
            sequenceAdapter: configData.assembly.sequence.adapter,
          },
          ...(opts.includes('snpcov')
            ? {
                displays: [
                  {
                    type: 'LinearSNPCoverageDisplay',
                    displayId: `${path.basename(file)}-${Math.random()}`,
                  },
                ],
              }
            : {}),
        },
      ]
    }
    if (type === 'bigwig') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'QuantitativeTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: makeLocation(file),
          },
        },
      ]
    }

    if (type === 'vcfgz') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'VariantTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'VcfTabixAdapter',
            vcfGzLocation: makeLocation(file),
            index: {
              location: makeLocation(index || `${file}.tbi`),
              indexType: index?.endsWith('.csi') ? 'CSI' : 'TBI',
            },
          },
        },
      ]
    }

    if (type === 'gffgz') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'FeatureTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: makeLocation(file),
            index: {
              location: makeLocation(index || `${file}.tbi`),
              indexType: index?.endsWith('.csi') ? 'CSI' : 'TBI',
            },
          },
        },
      ]
    }

    if (type === 'hic') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'HicTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'HicAdapter',
            hicLocation: makeLocation(file),
          },
        },
      ]
    }
    if (type === 'bigbed') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'FeatureTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'BigBedAdapter',
            bigBedLocation: makeLocation(file),
          },
        },
      ]
    }
    if (type === 'bedgz') {
      configData.tracks = [
        ...configData.tracks,
        {
          type: 'FeatureTrack',
          trackId: path.basename(file),
          name: path.basename(file),
          assemblyNames: [configData.assembly.name],
          adapter: {
            type: 'BedTabixAdapter',
            bedGzLocation: makeLocation(file),
            index: {
              location: makeLocation(index || `${file}.tbi`),
              indexType: index?.endsWith('.csi') ? 'CSI' : 'TBI',
            },
          },
        },
      ]
    }
  })

  if (!defaultSession) {
    // don't use defaultSession from config.json file, can result in assembly
    // name confusion
    configData.defaultSession = undefined
  }

  // only allow an external manually specified session
  if (sessionData) {
    configData.defaultSession = sessionData
  }

  return configData
}

function process(
  trackEntry: Entry,
  view: LinearGenomeViewModel,
  extra: (arg: string) => string = c => c,
) {
  const [, [track, ...opts]] = trackEntry
  if (!track) {
    throw new Error('invalid command line args')
  }
  const currentTrack = view.showTrack(extra(track))
  const display = currentTrack.displays[0]
  opts.forEach(opt => {
    // apply height to any track
    if (opt.startsWith('height:')) {
      const [, height] = opt.split(':')
      if (height) {
        display.setHeight(+height)
      }
    }

    // apply sort to pileup
    else if (opt.startsWith('sort:')) {
      const [, type, tag] = opt.split(':')
      display.PileupDisplay.setSortedBy(type, tag)
    }

    // apply color scheme to pileup
    else if (opt.startsWith('color:')) {
      const [, type, tag] = opt.split(':')
      if (display.PileupDisplay) {
        display.PileupDisplay.setColorScheme({ type, tag })
      } else {
        display.setColor(type)
      }
    }

    // force track to render even if maxbpperpx limit hit...
    else if (opt.startsWith('force:')) {
      const [, force] = opt.split(':')
      if (force) {
        display.setFeatureDensityStatsLimit({ bytes: Number.MAX_VALUE })
      }
    }

    // apply wiggle autoscale
    else if (opt.startsWith('autoscale:')) {
      const [, autoscale] = opt.split(':')
      display.setAutoscale(autoscale)
    }

    // apply min and max score to wiggle
    else if (opt.startsWith('minmax:')) {
      const [, min, max] = opt.split(':')
      if (min) {
        display.setMinScore(+min)
      }
      if (max) {
        display.setMaxScore(+max)
      }
    }

    // apply linear or log scale to wiggle
    else if (opt.startsWith('scaletype:')) {
      const [, scaletype] = opt.split(':')
      display.setScaleType(scaletype)
    }

    // draw crosshatches on wiggle
    else if (opt.startsWith('crosshatch:')) {
      const [, val = 'false'] = opt.split(':')
      display.setCrossHatches(booleanize(val))
    }

    // turn off fill on bigwig with fill:false
    else if (opt.startsWith('fill:')) {
      const [, val = 'true'] = opt.split(':')
      display.setFill(booleanize(val))
    }

    // set resolution:superfine to use finer bigwig bin size
    else if (opt.startsWith('resolution:')) {
      let [, val = 1] = opt.split(':')
      if (val === 'fine') {
        val = '10'
      } else if (val === 'superfine') {
        val = '100'
      }
      display.setResolution(+val)
    }
  })
}

export async function renderRegion(opts: Opts) {
  const model = createViewState({
    ...readData(opts),
    createRootFn: createRoot,
  })
  const {
    loc,
    width = 1500,
    trackList = [],
    session: sessionParam,
    defaultSession,
  } = opts

  const { session } = model
  const { view } = session
  const { assemblyManager } = model

  view.setWidth(width)

  if (loc) {
    const { name } = assemblyManager.assemblies[0]!
    if (loc === 'all') {
      view.showAllRegionsInAssembly(name)
    } else {
      await view.navToLocString(loc, name)
    }
  } else if (!sessionParam && !defaultSession) {
    console.warn('No loc specified')
  }

  trackList.forEach(track => {
    process(track, view, extra => path.basename(extra))
  })

  return renderToSvg(view, {
    rasterizeLayers: !opts.noRasterize,
    ...opts,
  })
}
