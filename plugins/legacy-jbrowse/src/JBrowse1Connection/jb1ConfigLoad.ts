import { openLocation } from '@jbrowse/core/util/io'
import { parseJB1Json, parseJB1Conf, regularizeConf } from './jb1ConfigParse'
import { clone, deepUpdate, fillTemplate } from './util'
import type {
  JBLocation,
  UriLocation,
  LocalPathLocation,
  Config,
  Track,
  Include,
} from './types'

function isUriLocation(location: JBLocation): location is UriLocation {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (location as UriLocation).uri !== undefined
}

function isLocalPathLocation(
  location: JBLocation,
): location is LocalPathLocation {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (location as LocalPathLocation).localPath !== undefined
}

export async function fetchJb1(
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  dataRoot: JBLocation = { uri: '', locationType: 'UriLocation' },
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  baseConfig: Config = {
    include: ['{dataRoot}/trackList.json', '{dataRoot}/tracks.conf'],
  },
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  baseConfigRoot: JBLocation = { uri: '', locationType: 'UriLocation' },
): Promise<Config> {
  const protocol = 'uri' in dataRoot ? 'uri' : 'localPath'
  const dataRootReg = JSON.parse(JSON.stringify(dataRoot))
  let dataRootLocation = ''
  if (isUriLocation(dataRoot)) {
    dataRootLocation = dataRoot.uri
  }
  if (isLocalPathLocation(dataRoot)) {
    dataRootLocation = dataRoot.localPath
  }
  if (dataRootLocation.endsWith('/')) {
    dataRootReg[protocol] = dataRootLocation.slice(0, -1)
  }
  if (
    (isUriLocation(baseConfigRoot) && baseConfigRoot.uri) ||
    (isLocalPathLocation(baseConfigRoot) && baseConfigRoot.localPath)
  ) {
    const baseProtocol = 'uri' in baseConfigRoot ? 'uri' : 'localPath'
    let baseConfigLocation = ''
    if (isUriLocation(baseConfigRoot)) {
      baseConfigLocation = baseConfigRoot.uri
    }
    if (isLocalPathLocation(baseConfigRoot)) {
      baseConfigLocation = baseConfigRoot.localPath
    }
    if (baseConfigLocation.endsWith('/')) {
      baseConfigLocation = baseConfigLocation.slice(0, -1)
    }
    let newConfig: Config = {}
    for (const conf of ['jbrowse.conf', 'jbrowse_conf.json']) {
      let fetchedConfig = null
      try {
        // @ts-expect-error
        fetchedConfig = await fetchConfigFile({
          [baseProtocol]: `${baseConfigLocation}/${conf}`,
        })
      } catch (error) {
        console.error(
          `tried to access ${baseConfigLocation}/${conf}, but failed`,
        )
      }
      newConfig = mergeConfigs(newConfig, fetchedConfig) || {}
    }
    if (dataRootReg[protocol]) {
      newConfig.dataRoot = dataRootReg[protocol]
    }
    return createFinalConfig(newConfig)
  }
  const newConfig = regularizeConf(baseConfig, window.location.href)
  if (dataRootReg[protocol]) {
    newConfig.dataRoot = dataRootReg[protocol]
  }
  return createFinalConfig(newConfig)
}

export async function createFinalConfig(
  baseConfig: Config,
  defaults = configDefaults,
): Promise<Config> {
  const configWithDefaults = deepUpdate(clone(defaults), baseConfig)
  let finalConfig = await loadIncludes(configWithDefaults)
  finalConfig = mergeConfigs(finalConfig, baseConfig) || finalConfig
  fillTemplates(finalConfig, finalConfig)
  validateConfig(finalConfig)
  return finalConfig
}

export async function fetchConfigFile(location: JBLocation): Promise<Config> {
  const result = await openLocation(location).readFile('utf8')
  if (isUriLocation(location)) {
    return parseJb1(result, location.uri)
  }
  if (isLocalPathLocation(location)) {
    return parseJb1(result, location.localPath)
  }
  return parseJb1(result)
}

export function parseJb1(config: string, url = ''): Config {
  if (config.trim().startsWith('{')) {
    return parseJB1Json(config, url)
  }
  return parseJB1Conf(config, url)
}

/**
 * Merges config object b into a. Properties in b override those in a.
 */
function mergeConfigs(a: Config | null, b: Config | null): Config | null {
  if (b === null) {
    return null
  }

  if (a === null) {
    a = {}
  }

  for (const prop of Object.keys(b)) {
    if (prop === 'tracks' && prop in a) {
      const aTracks = a[prop] || []
      const bTracks = b[prop] || []

      if (Array.isArray(aTracks) && Array.isArray(bTracks)) {
        a[prop] = mergeTrackConfigs(aTracks, bTracks)
      } else {
        throw new Error(
          `Track config has not been properly regularized: ${aTracks} ${bTracks}`,
        )
      }
    } else if (
      !noRecursiveMerge(prop) &&
      prop in a &&
      // @ts-expect-error
      typeof b[prop] === 'object' &&
      // @ts-expect-error
      typeof a[prop] === 'object'
    ) {
      // @ts-expect-error
      a[prop] = deepUpdate(a[prop], b[prop])
    } else if (prop === 'dataRoot') {
      if (
        a[prop] === undefined ||
        (a[prop] === 'data' && b[prop] !== undefined)
      ) {
        a[prop] = b[prop]
      }
      // @ts-expect-error
    } else if (a[prop] === undefined || b[prop] !== undefined) {
      // @ts-expect-error
      a[prop] = b[prop]
    }
  }
  return a
}

/**
 * Special-case merging of two `tracks` configuration arrays.
 */
function mergeTrackConfigs(a: Track[], b: Track[]): Track[] {
  if (!b.length) {
    return a
  }

  // index the tracks in `a` by track label
  const aTracks: Record<string, Track> = {}
  a.forEach((t, i): void => {
    t.index = i
    aTracks[t.label] = t
  })

  b.forEach((bT): void => {
    const aT = aTracks[bT.label]
    if (aT) {
      mergeConfigs(aT, bT)
    } else {
      a.push(bT)
    }
  })

  return a
}

/**
 * Recursively fetch, parse, and merge all the includes in the given config
 * object.  Calls the callback with the resulting configuration when finished.
 * @param inputConfig - Config to load includes into
 */
async function loadIncludes(inputConfig: Config): Promise<Config> {
  inputConfig = clone(inputConfig)

  async function loadRecur(
    config: Config,
    upstreamConf: Config,
  ): Promise<Config> {
    const sourceUrl = config.sourceUrl || config.baseUrl
    if (!sourceUrl) {
      throw new Error(
        `Could not determine source URL: ${JSON.stringify(config)}`,
      )
    }
    const newUpstreamConf = mergeConfigs(clone(upstreamConf), config)
    if (!newUpstreamConf) {
      throw new Error('Problem merging configs')
    }
    const includes = fillTemplates(
      regularizeIncludes(config.include || []),
      newUpstreamConf,
    )
    config.include = undefined

    const loads = includes.map(async (include): Promise<Config> => {
      include.cacheBuster = inputConfig.cacheBuster
      const includedData = await fetchConfigFile({
        uri: new URL(include.url, sourceUrl).href,
        locationType: 'UriLocation',
      })
      return loadRecur(includedData, newUpstreamConf)
    })
    const includedDataObjects = await Promise.all(loads)
    includedDataObjects.forEach((includedData): void => {
      config = mergeConfigs(config, includedData) || config
    })
    return config
  }

  return loadRecur(inputConfig, {})
}

function regularizeIncludes(
  includes: Include | string | (Include | string)[] | null,
): Include[] {
  if (!includes) {
    return []
  }

  // coerce include to an array
  if (!Array.isArray(includes)) {
    includes = [includes]
  }

  return includes.map((include): Include => {
    // coerce bare strings in the includes to URLs
    if (typeof include === 'string') {
      include = { url: include }
    }

    // set defaults for format and version
    if (!('format' in include)) {
      include.format = include.url.endsWith('.conf') ? 'conf' : 'JB_json'
    }
    if (include.format === 'JB_json' && !('version' in include)) {
      include.version = 1
    }
    return include
  })
}

function fillTemplates<T>(subconfig: T, config: Config): T {
  if (!subconfig) {
    return subconfig
  }
  if (Array.isArray(subconfig)) {
    for (let i = 0; i < subconfig.length; i += 1) {
      subconfig[i] = fillTemplates(subconfig[i], config)
    }
  } else if (typeof subconfig === 'object') {
    const sub = subconfig as Record<string, any>
    for (const name of Object.keys(sub)) {
      sub[name] = fillTemplates(sub[name], config)
    }
  } else if (typeof subconfig === 'string') {
    // @ts-expect-error
    return fillTemplate(subconfig, config)
  }

  return subconfig
}

/**
 * list of config properties that should not be recursively merged
 * @param propName - name of config property
 */
function noRecursiveMerge(propName: string): boolean {
  return propName === 'datasets'
}

const configDefaults = {
  tracks: [],

  containerID: 'GenomeBrowser',
  dataRoot: 'data',
  show_tracklist: true,
  show_nav: true,
  show_menu: true,
  show_overview: true,
  show_fullviewlink: true,
  update_browser_title: true,
  updateBrowserURL: true,

  refSeqs: '{dataRoot}/seq/refSeqs.json',
  include: ['jbrowse.conf', 'jbrowse_conf.json'],
  nameUrl: '{dataRoot}/names/root.json',

  datasets: {
    _DEFAULT_EXAMPLES: true,
    volvox: { url: '?data=sample_data/json/volvox', name: 'Volvox Example' },
    modencode: {
      url: '?data=sample_data/json/modencode',
      name: 'MODEncode Example',
    },
    yeast: { url: '?data=sample_data/json/yeast', name: 'Yeast Example' },
  },

  highlightSearchedRegions: false,
  highResolutionMode: 'auto',
}

/**
 * Examine the loaded and merged configuration for errors.  Throws
 * exceptions if it finds anything amiss.
 * @returns nothing meaningful
 */
function validateConfig(config: Config): void {
  if (!config.tracks) {
    config.tracks = []
  }
  if (!config.baseUrl) {
    throw new Error('Must provide a `baseUrl` in configuration')
  }
}
