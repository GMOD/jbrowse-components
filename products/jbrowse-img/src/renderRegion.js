import { createViewState } from '@jbrowse/react-linear-genome-view'
import { renderToSvg } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'
import path from 'path'
import fs from 'fs'
import { booleanize } from './util'

function read(file) {
  let res
  try {
    res = JSON.parse(fs.readFileSync(file))
  } catch (e) {
    throw new Error(
      `Failed to parse ${file} as JSON, use --fasta if you mean to pass a FASTA file`,
    )
  }
  return res
}
function makeLocation(file) {
  return file.startsWith('http') ? { uri: file } : { localPath: file }
}

function addRelativePaths(config, configPath) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativePaths(config[key], configPath)
      } else if (key === 'localPath') {
        config.localPath = path.resolve(configPath, config.localPath)
      }
    }
  }
}

export function readData(opts) {
  const {
    assembly: asm,
    config,
    session,
    fasta,
    aliases,
    defaultSession,
    trackList = [],
    tracks,
  } = opts

  const assemblyData = asm && fs.existsSync(asm) ? read(asm) : undefined
  const tracksData = tracks ? read(tracks) : undefined
  const configData = config ? read(config) : {}
  let sessionData = session ? read(session) : undefined

  if (config) {
    addRelativePaths(configData, path.dirname(path.resolve(config)))
  }

  // the session.json can be a raw session or a json file with a "session"
  // attribute, which is what is exported via the "File->Export session" in
  // jbrowse-web
  if (sessionData?.session) {
    sessionData = sessionData.session
  }

  // only export first view
  if (sessionData?.views) {
    sessionData.view = sessionData.views[0]
  }

  // use assembly from file if a file existed
  if (assemblyData) {
    configData.assembly = assemblyData
  }
  // else check if it was an assembly name in a config file
  else if (configData.assemblies?.length) {
    configData.assembly = asm
      ? configData.assemblies.find(entry => entry.name === asm)
      : configData.assemblies[0]
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
          faiLocation: makeLocation(fasta + '.fai'),
          gziLocation: bgzip ? makeLocation(fasta + '.gzi') : undefined,
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
  }

  // throw if still no assembly
  if (!configData.assembly) {
    throw new Error(
      'no assembly specified, use --fasta to supply an indexed FASTA file (generated with samtools faidx yourfile.fa). see README for alternatives with --assembly and --config',
    )
  }

  if (tracksData) {
    configData.tracks = tracksData
  } else if (!configData.tracks) {
    configData.tracks = []
  }

  trackList.forEach(track => {
    const [type, [file]] = track

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
            index: { location: makeLocation(file + '.bai') },
            sequenceAdapter: configData.assembly.sequence.adapter,
          },
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
            craiLocation: makeLocation(file + '.crai'),
            sequenceAdapter: configData.assembly.sequence.adapter,
          },
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
              location: makeLocation(file + '.tbi'),
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
              location: makeLocation(file + '.tbi'),
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
              location: makeLocation(file + '.tbi'),
            },
          },
        },
      ]
    }
  })

  if (!defaultSession) {
    // don't use defaultSession from config.json file, can result in assembly
    // name confusion
    delete configData.defaultSession
  }

  // only allow an external manually specified session
  if (sessionData) {
    configData.defaultSession = sessionData
  }

  return configData
}

export async function renderRegion(opts = {}) {
  const model = createViewState(readData(opts))
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
  await when(
    () =>
      assemblyManager.allPossibleRefNames?.length &&
      model.session.view.initialized,
  )

  if (loc) {
    const assembly = assemblyManager.assemblies[0]
    const region = assembly.regions[0]
    if (region) {
      view.setDisplayedRegions([region])
    }
    if (loc === 'all') {
      view.showAllRegionsInAssembly(assembly.name)
    } else {
      view.navToLocString(loc)
    }
  } else if (!sessionParam && !defaultSession) {
    console.warn('No loc specified')
  }

  function process(trackEntry, extra = () => {}) {
    const [, [track, ...opts]] = trackEntry
    const currentTrack = view.showTrack(extra(track))
    const display = currentTrack.displays[0]
    opts.forEach(opt => {
      // apply height to any track
      if (opt.startsWith('height:')) {
        const [, height] = opt.split(':')
        display.setHeight(+height)
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
        if (Boolean(force)) {
          display.setUserFeatureScreenDensity(Number.MAX_VALUE)
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
        display.setMinScore(+min)
        display.setMaxScore(+max)
      }

      // apply linear or log scale to wiggle
      else if (opt.startsWith('scaletype:')) {
        const [, scaletype] = opt.split(':')
        display.setScaleType(scaletype)
      }

      // draw crosshatches on wiggle
      else if (opt.startsWith('crosshatch:')) {
        const [, val] = opt.split(':')
        display.setCrossHatches(booleanize(val))
      }

      // turn off fill on bigwig with fill:false
      else if (opt.startsWith('fill:')) {
        const [, val] = opt.split(':')
        display.setFill(booleanize(val))
      }

      // set resolution:superfine to use finer bigwig bin size
      else if (opt.startsWith('resolution:')) {
        let [, val] = opt.split(':')
        if (val === 'fine') {
          val = 10
        } else if (val === 'superfine') {
          val = 100
        }
        display.setResolution(val)
      }
    })
  }
  trackList.forEach(track => process(track, extra => path.basename(extra)))

  return renderToSvg(view, { rasterizeLayers: !opts.noRasterize, ...opts })
}
