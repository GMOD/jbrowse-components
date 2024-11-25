/**
 * By convention, exit codes in this base class are below 100
 */

import { promises as fsPromises } from 'fs'
import path from 'path'
import { Command } from '@oclif/core'
import parseJSON from 'json-parse-better-errors'
import fetch from './fetchWithProxy'

export interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}
export interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}

export interface Gff3TabixAdapter {
  type: 'Gff3TabixAdapter'
  gffGzLocation: UriLocation | LocalPathLocation
}

export interface Gff3Adapter {
  type: 'Gff3Adapter'
  gffLocation: UriLocation | LocalPathLocation
}
export interface GtfAdapter {
  type: 'GtfAdapter'
  gtfLocation: UriLocation
}

export interface VcfTabixAdapter {
  type: 'VcfTabixAdapter'
  vcfGzLocation: UriLocation | LocalPathLocation
}
export interface VcfAdapter {
  type: 'VcfAdapter'
  vcfLocation: UriLocation | LocalPathLocation
}

export interface IndexedFastaAdapter {
  type: 'IndexedFastaAdapter'
  fastaLocation: UriLocation
  faiLocation: UriLocation
}

export interface BgzipFastaAdapter {
  type: 'BgzipFastaAdapter'
  fastaLocation: UriLocation
  faiLocation: UriLocation
  gziLocation: UriLocation
}

export interface TwoBitAdapter {
  type: 'TwoBitAdapter'
  twoBitLocation: UriLocation
}

export interface ChromeSizesAdapter {
  type: 'ChromSizesAdapter'
  chromSizesLocation: UriLocation
}

export interface CustomSequenceAdapter {
  type: string
}

export interface RefNameAliasAdapter {
  type: 'RefNameAliasAdapter'
  location: UriLocation
}

export interface CustomRefNameAliasAdapter {
  type: string
}

export interface Sequence {
  type: 'ReferenceSequenceTrack'
  trackId: string
  adapter:
    | IndexedFastaAdapter
    | BgzipFastaAdapter
    | TwoBitAdapter
    | ChromeSizesAdapter
    | CustomSequenceAdapter
}

export interface Assembly {
  displayName?: string
  name: string
  aliases?: string[]
  sequence: Sequence
  refNameAliases?: {
    adapter: RefNameAliasAdapter | CustomRefNameAliasAdapter
  }
  refNameColors?: string[]
}

export interface TrixTextSearchAdapter {
  type: string
  textSearchAdapterId: string
  ixFilePath: UriLocation
  ixxFilePath: UriLocation
  metaFilePath: UriLocation
  assemblyNames: string[]
}
export interface TextSearching {
  indexingFeatureTypesToExclude?: string[]
  indexingAttributes?: string[]
  textSearchAdapter: TrixTextSearchAdapter
}
export interface Track {
  trackId: string
  name: string
  assemblyNames: string[]
  adapter?: { type: string; [key: string]: unknown }
  textSearching?: TextSearching
}

export interface Config {
  assemblies?: Assembly[]
  assembly?: Assembly
  configuration?: Record<string, unknown>
  aggregateTextSearchAdapters?: TrixTextSearchAdapter[]
  connections?: { connectionId: string }[]
  defaultSession?: Record<string, unknown>
  tracks?: Track[]
}

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets?: [
    {
      browser_download_url: string
      name: string
    },
  ]
}

export default abstract class JBrowseCommand extends Command {
  async init() {}

  async readFile(location: string) {
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }

  async readJsonFile<T>(location: string): Promise<T> {
    let contents: string
    try {
      contents = await fsPromises.readFile(location, { encoding: 'utf8' })
    } catch (error) {
      this.error(error instanceof Error ? error : `${error}`, {
        suggestions: [
          `Make sure the file "${location}" exists or use --out to point to a directory with a config.json`,
          'Run `jbrowse add-assembly` to create a config file',
        ],
        exit: 40,
      })
    }
    let result: T
    try {
      result = parseJSON(contents)
    } catch (error) {
      this.error(error instanceof Error ? error : `${error}`, {
        suggestions: [`Make sure "${location}" is a valid JSON file`],
        exit: 50,
      })
    }
    return result
  }

  async writeJsonFile(location: string, contents: unknown) {
    this.debug(`Writing JSON file to ${process.cwd()} ${location}`)
    return fsPromises.writeFile(location, JSON.stringify(contents, null, 2))
  }

  async resolveFileLocation(location: string, check = true, inPlace = false) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      if (check) {
        // @ts-expect-error
        const response = await fetch(locationUrl, { method: 'HEAD' })
        if (!response.ok) {
          throw new Error(`${locationUrl} result ${response.statusText}`)
        }
      }
      return locationUrl.href
    }
    let locationPath: string | undefined
    try {
      locationPath = check ? await fsPromises.realpath(location) : location
    } catch (e) {
      // ignore
    }
    if (locationPath) {
      const filePath = path.relative(process.cwd(), locationPath)
      if (inPlace && filePath.startsWith('..')) {
        this.warn(
          `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
        )
      }
      return inPlace ? location : filePath
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 40,
    })
  }

  async readInlineOrFileJson<T>(inlineOrFileName: string) {
    let result: T
    // see if it's inline JSON
    try {
      result = parseJSON(inlineOrFileName) as T
    } catch (error) {
      this.debug(
        `Not valid inline JSON, attempting to parse as filename: '${inlineOrFileName}'`,
      )
      // not inline JSON, must be location of a JSON file
      result = await this.readJsonFile(inlineOrFileName)
    }
    return result
  }

  async fetchGithubVersions() {
    let versions: GithubRelease[] = []
    for await (const iter of this.fetchVersions()) {
      versions = [...versions, ...iter]
    }

    return versions
  }

  async getLatest() {
    for await (const versions of this.fetchVersions()) {
      // if a release was just uploaded, or an erroneous build was made then it
      // might have no build asset
      const nonprereleases = versions
        .filter(release => !release.prerelease)
        .filter(release => release.assets?.length)

      if (nonprereleases.length > 0) {
        // @ts-expect-error
        const file = nonprereleases[0].assets.find(f =>
          f.name.includes('jbrowse-web'),
        )?.browser_download_url

        if (!file) {
          throw new Error('no jbrowse-web download found')
        }
        return file
      }
    }

    throw new Error('no version tags found')
  }

  async *fetchVersions() {
    let page = 1
    let result: GithubRelease[] | undefined

    do {
      const url = `https://api.github.com/repos/GMOD/jbrowse-components/releases?page=${page}`
      const response = await fetch(url)
      if (response.ok) {
        result = (await response.json()) as GithubRelease[]

        yield result.filter(release => release.tag_name.startsWith('v'))
        page++
      } else {
        throw new Error(`HTTP ${response.status} fetching ${url}`)
      }
    } while (result.length)
  }

  async getTag(tag: string) {
    const response = await fetch(
      `https://api.github.com/repos/GMOD/jbrowse-components/releases/tags/${tag}`,
    )
    if (response.ok) {
      const result = (await response.json()) as GithubRelease
      const file = result.assets?.find(f =>
        f.name.includes('jbrowse-web'),
      )?.browser_download_url

      if (!file) {
        this.error(
          'Could not find version specified. Use --listVersions to see all available versions',
          { exit: 90 },
        )
      }
      return file
    }
    return this.error(`Could not find version: ${response.statusText}`, {
      exit: 90,
    })
  }

  async getBranch(branch: string) {
    return `https://s3.amazonaws.com/jbrowse.org/code/jb2/${branch}/jbrowse-web-${branch}.zip`
  }
}
