/* eslint no-cond-assign: ["error", "except-parens"] */
import { objectHash } from '@jbrowse/core/util'
import getValue from 'get-value'
import setValue from 'set-value'
import { isSource, isTrack } from './util'
import type { Config, Track, Source, Store, Names } from './types'

export function parseJB1Json(config: Config | string, url: string): Config {
  if (typeof config === 'string') {
    let parsedConf: Config
    try {
      parsedConf = JSON.parse(config)
    } catch (error) {
      throw new Error(`${error} when parsing configuration.`)
    }
    return regularizeConf(parsedConf, url)
  }
  return regularizeConf(config, url)
}

export function parseJB1Conf(config: string, url: string): Config {
  let parsedConf: Config
  try {
    parsedConf = parse(config, url)
  } catch (error) {
    throw new Error(`${error} when parsing configuration.`)
  }
  return regularizeConf(parsedConf, url)
}

function isAlwaysArray(varName: string): boolean {
  if (varName === 'include') {
    return true
  }
  return false
}

function parse(text: string, url: string): Config {
  let section: string[] = []
  let keyPath: string[] | undefined
  let operation: string
  let value: string | undefined
  const data: Config = { tracks: {} }
  let lineNumber: number

  function recordVal(): void {
    if (value !== undefined) {
      let parsedValue:
        | string
        | number
        | boolean
        | string[]
        | number[]
        | boolean[]
      try {
        // parse json
        const match = /^json:(.+)/i.exec(value)
        if (match) {
          parsedValue = JSON.parse(match[1]!)
        }
        // parse numbers if it looks numeric
        else if (/^[+-]?[\d.,]+([eE][-+]?\d+)?$/.test(value)) {
          parsedValue = Number.parseFloat(value.replaceAll(',', ''))
        } else {
          parsedValue = value
        }

        if (!keyPath) {
          throw new Error(`Error parsing in section ${section.join(' - ')}`)
        }
        const path = [...section, ...keyPath].join('.')
        if (operation === '+=') {
          let existing = getValue(data, path)
          if (existing) {
            if (!Array.isArray(existing)) {
              existing = [existing]
            }
          } else {
            existing = []
          }

          existing.push(parsedValue)
          parsedValue = existing
        }
        if (parsedValue === 'true') {
          parsedValue = true
        }
        if (parsedValue === 'false') {
          parsedValue = false
        }
        setValue(data, path, parsedValue)
      } catch (e) {
        throw new Error(
          `syntax error${url ? ` in ${url}` : ''}${
            lineNumber ? ` at line ${lineNumber - 1}` : ''
          }`,
        )
      }
    }
  }

  text.split(/\n|\r\n|\r/).forEach((textLine, i): void => {
    lineNumber = i + 1
    const line = textLine.replace(/^\s*#.+/, '')

    // new section
    let match: RegExpMatchArray | null
    if ((match = /^\s*\[([^\]]+)/.exec(line))) {
      // new section
      recordVal()
      keyPath = undefined
      value = undefined
      section = match[1]!.trim().split(/\s*\.\s*/)
      if (section.length === 1 && section[0]!.toLowerCase() === 'general') {
        section = []
      }
    }
    // new value
    else if (
      (match = line.match(
        value === undefined ? /^([^+=]+)(\+?=)(.*)/ : /^(\S[^+=]+)(\+?=)(.*)/,
      ))
    ) {
      recordVal()
      keyPath = match[1]!.trim().split(/\s*\.\s*/)
      // @ts-expect-error
      ;[, , operation] = match
      if (isAlwaysArray([...section, ...keyPath].join('.'))) {
        operation = '+='
      }
      value = match[3]!.trim()
    }
    // add to existing array value
    else if (
      keyPath !== undefined &&
      (match = /^\s{0,4}\+\s*(.+)/.exec(line))
    ) {
      recordVal()
      operation = '+='
      value = match[1]!.trim()
    }
    // add to existing value
    else if (value !== undefined && (match = /^\s+(\S.*)/.exec(line))) {
      const m = match[1]!
      value += value.length ? ` ${m.trim()}` : m.trim()
    }
    // done with last value
    else {
      recordVal()
      keyPath = undefined
      value = undefined
    }
  })

  recordVal()

  return data
}

/**
 * Applies defaults and any other necessary tweaks to the loaded configuration.
 * @param conf - the object containing the configuration, which it modifies
 * in-place
 * @param url - URL of the config file
 * @returns the same object it was passed
 */
export function regularizeConf(conf: Config, url: string): Config {
  // if tracks is not an array, convert it to one
  if (conf.tracks && !Array.isArray(conf.tracks)) {
    // if it's a single track config, wrap it in an arrayref
    if (isTrack(conf.tracks)) {
      conf.tracks = [conf.tracks]
    }
    // otherwise, coerce it to an array
    else {
      const tracks: Track[] = []
      for (const label of Object.keys(conf.tracks)) {
        const track = conf.tracks[label]
        if (isTrack(track)) {
          tracks.push(track)
        } else {
          tracks.push({ label, ...track })
        }
      }
      conf.tracks = tracks
    }
  }

  // regularize trackMetadata.sources
  const meta = conf.trackMetadata
  if (meta?.sources) {
    // if it's a single source config, wrap it in an arrayref
    if (typeof meta.sources === 'string') {
      meta.sources = [meta.sources]
    }
    if (isSource(meta.sources)) {
      meta.sources = [meta.sources]
    }

    if (!Array.isArray(meta.sources)) {
      const sources: Source[] = []
      for (const name of Object.keys(meta.sources)) {
        const source = meta.sources[name]!
        if (!('name' in source)) {
          source.name = name
        }
        sources.push(source)
      }
      meta.sources = sources
    }

    // coerce any string source defs to be URLs, and try to detect their types
    meta.sources = meta.sources.map((sourceDef: string | Source): Source => {
      if (typeof sourceDef === 'string') {
        const newSourceDef: Source = { url: sourceDef }
        const typeMatch = /\.(\w+)$/.exec(sourceDef)
        if (typeMatch) {
          newSourceDef.type = typeMatch[1]!.toLowerCase()
        }
        return newSourceDef
      }
      return sourceDef
    })
  }

  conf.sourceUrl = conf.sourceUrl || url
  if (conf.sourceUrl.startsWith('/')) {
    conf.sourceUrl = new URL(conf.sourceUrl, window.location.href).href
  }
  conf.baseUrl = conf.baseUrl || new URL('.', conf.sourceUrl).href
  if (conf.baseUrl.length && !conf.baseUrl.endsWith('/')) {
    conf.baseUrl += '/'
  }

  if (conf.sourceUrl) {
    // set a default baseUrl in each of the track and store confs, and the names
    // conf, if needed
    const addBase: (Track | Store | Names)[] = []
    if (conf.tracks) {
      addBase.push(...conf.tracks)
    }
    if (conf.stores) {
      addBase.push(...Object.values(conf.stores))
    }
    if (conf.names) {
      addBase.push(conf.names)
    }

    addBase.forEach((t): void => {
      if (!t.baseUrl) {
        t.baseUrl = conf.baseUrl || '/'
      }
    })

    // resolve the refSeqs and nameUrl if present
    if (conf.refSeqs && typeof conf.refSeqs === 'string') {
      conf.refSeqs = new URL(conf.refSeqs, conf.sourceUrl).href
    }
    if (conf.nameUrl) {
      conf.nameUrl = new URL(conf.nameUrl, conf.sourceUrl).href
    }
  }

  conf.stores = conf.stores || {}
  ;(conf.tracks || []).forEach((trackConfig: Track): void => {
    // if there is a `config` subpart, just copy its keys in to the top-level
    // config
    if (trackConfig.config) {
      const c = trackConfig.config
      trackConfig.config = undefined
      trackConfig = { ...c, ...trackConfig }
    }

    // skip if it's a new-style track def
    if (trackConfig.store) {
      return
    }

    let trackClassName: string
    if (trackConfig.type === 'FeatureTrack') {
      trackClassName = 'JBrowse/View/Track/HTMLFeatures'
    } else if (trackConfig.type === 'ImageTrack') {
      trackClassName = 'JBrowse/View/Track/FixedImage'
    } else if (trackConfig.type === 'ImageTrack.Wiggle') {
      trackClassName = 'JBrowse/View/Track/FixedImage/Wiggle'
    } else if (trackConfig.type === 'SequenceTrack') {
      trackClassName = 'JBrowse/View/Track/Sequence'
    } else {
      trackClassName = regularizeClass('JBrowse/View/Track', trackConfig.type)
    }

    trackConfig.type = trackClassName

    synthesizeTrackStoreConfig(conf, trackConfig)

    if (trackConfig.histograms) {
      if (!trackConfig.histograms.baseUrl) {
        trackConfig.histograms.baseUrl = trackConfig.baseUrl
      }
      synthesizeTrackStoreConfig(conf, trackConfig.histograms)
    }
  })

  return conf
}

/**
 * prefix class name with `root` if it contains no slashes
 * @param root - Prefix root
 * @param className - class name
 */
function regularizeClass(root: string, className: string | undefined): string {
  if (!className) {
    return ''
  }
  if (!className.includes('/')) {
    className = `${root}/${className}`
  }
  className = className.replace(/^\//, '')
  return className
}

function guessStoreClass(
  trackConfig: Track | undefined,
  urlTemplate: string,
): string {
  if (!trackConfig) {
    return ''
  }
  if (trackConfig.type?.includes('/FixedImage')) {
    return `JBrowse/Store/TiledImage/Fixed${
      trackConfig.backendVersion === 0 ? '_v0' : ''
    }`
  }
  if (/\.jsonz?$/i.test(urlTemplate)) {
    return `JBrowse/Store/SeqFeature/NCList${
      trackConfig.backendVersion === 0 ? '_v0' : ''
    }`
  }
  if (/\.bam$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/BAM'
  }
  if (/\.cram$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/CRAM'
  }
  if (/\.gff3?$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/GFF3'
  }
  if (/\.bed$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/BED'
  }
  if (/\.vcf.b?gz$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/VCFTabix'
  }
  if (/\.gff3?.b?gz$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/GFF3Tabix'
  }
  if (/\.bed.b?gz$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/BEDTabix'
  }
  if (/\.(bw|bigwig)$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/BigWig'
  }
  if (/\.(bb|bigbed)$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/BigBed'
  }
  if (/\.(fa|fasta)$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/IndexedFasta'
  }
  if (/\.(fa|fasta)\.b?gz$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/BgzipIndexedFasta'
  }
  if (/\.2bit$/i.test(urlTemplate)) {
    return 'JBrowse/Store/SeqFeature/TwoBit'
  }
  if (trackConfig.type?.endsWith('/Sequence')) {
    return 'JBrowse/Store/Sequence/StaticChunked'
  }
  return ''
}

function synthesizeTrackStoreConfig(
  mainConf: Config,
  trackConfig: Track,
): void {
  // figure out what data store class to use with the track, applying some
  // defaults if it is not explicit in the configuration
  const { urlTemplate = '' } = trackConfig

  const storeClass = trackConfig.storeClass
    ? regularizeClass('JBrowse/Store', trackConfig.storeClass)
    : guessStoreClass(trackConfig, urlTemplate)

  if (!storeClass) {
    console.warn(
      `Unable to determine an appropriate data store to use with track '${trackConfig.label}', please explicitly specify a storeClass in the configuration.`,
    )
    return
  }

  // synthesize a separate store conf
  const storeConf: Store = { ...trackConfig, type: storeClass }

  // if this is the first sequence store we see, and we have no refseqs store
  // defined explicitly, make this the refseqs store.
  storeConf.name =
    (storeClass === 'JBrowse/Store/Sequence/StaticChunked' ||
      storeClass === 'JBrowse/Store/Sequence/IndexedFasta' ||
      storeClass === 'JBrowse/Store/SeqFeature/IndexedFasta' ||
      storeClass === 'JBrowse/Store/SeqFeature/BgzipIndexedFasta' ||
      storeClass === 'JBrowse/Store/SeqFeature/TwoBit' ||
      storeClass === 'JBrowse/Store/Sequence/TwoBit' ||
      trackConfig.useAsRefSeqStore) &&
    !mainConf.stores?.refseqs
      ? 'refseqs'
      : `store${objectHash(storeConf)}`
  // record it
  if (!mainConf.stores) {
    mainConf.stores = {}
  }
  mainConf.stores[storeConf.name] = storeConf

  // connect it to the track conf
  trackConfig.store = storeConf.name
}
