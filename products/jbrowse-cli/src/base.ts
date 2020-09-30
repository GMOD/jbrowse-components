import Command from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

export interface UriLocation {
  uri: string
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
  name: string
  aliases?: string[]
  sequence: Sequence
  refNameAliases?: {
    adapter: RefNameAliasAdapter | CustomRefNameAliasAdapter
  }
  refNameColors?: string[]
}

export interface Config {
  assemblies?: Assembly[]
  configuration?: {}
  connections?: unknown[]
  defaultSession?: {}
  tracks?: unknown[]
}

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets?: [
    {
      browser_download_url: string
    },
  ]
}

export default abstract class JBrowseCommand extends Command {
  async init() {}

  async checkLocation(location: string) {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile(
        path.join(location, 'manifest.json'),
        {
          encoding: 'utf8',
        },
      )
    } catch (error) {
      this.error(
        'Could not find the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 10 },
      )
    }
    let manifest: { name?: string } = {}
    try {
      manifest = JSON.parse(manifestJson)
    } catch (error) {
      this.error(
        'Could not parse the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 20 },
      )
    }
    if (manifest.name !== 'JBrowse') {
      this.error(
        '"name" in file "manifest.json" is not "JBrowse". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 30 },
      )
    }
  }

  async readJsonConfig(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      const response = await fetch(locationUrl)
      if (response.ok) {
        return response.json()
      }
      throw new Error(`${response.statusText}`)
    }
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }

  async writeJsonConfig(config: string) {
    try {
      fsPromises.writeFile('./config.json', config)
    } catch (error) {
      this.error(`${error}`)
    }
  }

  async resolveFileLocation(location: string, check = true, warning = false) {
    let locationUrl: URL | undefined
    let locationPath: string | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      let response
      try {
        if (check) {
          response = await fetch(locationUrl, { method: 'HEAD' })
          if (response.ok) {
            return locationUrl.href
          }
          throw new Error(`${response.statusText}`)
        } else {
          return locationUrl.href
        }
      } catch (error) {
        // ignore
      }
    }
    try {
      if (check) {
        locationPath = await fsPromises.realpath(location)
      } else {
        locationPath = location
      }
    } catch (e) {
      // ignore
    }
    if (locationPath) {
      const filePath = path.relative(process.cwd(), locationPath)
      if (warning && filePath.startsWith('..')) {
        this.warn(
          `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
        )
      }
      return filePath
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 40,
    })
  }

  async readInlineOrFileJson(inlineOrFileName: string) {
    let result
    // see if it's inline JSON
    try {
      result = JSON.parse(inlineOrFileName)
    } catch (error) {
      // not inline JSON, must be location of a JSON file
      try {
        const fileLocation = await this.resolveFileLocation(inlineOrFileName)
        const resultJSON = await this.readJsonConfig(fileLocation)
        result = JSON.parse(resultJSON)
      } catch (err) {
        this.error(`Not valid inline JSON or JSON file ${inlineOrFileName}`, {
          exit: 50,
        })
      }
    }
    return result
  }

  async fetchGithubVersions() {
    let versions: GithubRelease[] = []
    for await (const iter of this.fetchVersions()) {
      versions = versions.concat(iter)
    }

    return versions
  }

  async getLatest() {
    for await (const versions of this.fetchVersions()) {
      const jb2webreleases = versions.filter(release =>
        release.tag_name.startsWith('@gmod/jbrowse-web'),
      )

      // if a release was just uploaded, or an erroneous build was made
      // then it might have no build asset
      const nonprereleases = jb2webreleases
        .filter(release => release.prerelease === false)
        .filter(release => release.assets && release.assets.length > 0)

      if (nonprereleases.length !== 0) {
        // @ts-ignore
        return nonprereleases[0].assets[0].browser_download_url
      }
    }

    throw new Error('no @gmod/jbrowse-web tags found')
  }

  async *fetchVersions() {
    let page = 0
    let result

    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(
        `https://api.github.com/repos/GMOD/jbrowse-components/releases?page=${page}`,
      )
      if (response.ok) {
        // eslint-disable-next-line no-await-in-loop
        result = await response.json()
        yield result as GithubRelease[]
        page++
      } else {
        throw new Error(`${result.statusText}`)
      }
    } while (result && result.length > 0)
  }

  async getTag(tag: string) {
    const response = await fetch(
      `https://api.github.com/repos/GMOD/jbrowse-components/releases/tags/${tag}`,
    )
    if (response.ok) {
      const result = await response.json()
      return result && result.assets
        ? result.assets[0].browser_download_url
        : this.error(
            'Could not find version specified. Use --listVersions to see all available versions',
            { exit: 130 },
          )
    }
    return this.error(`Error: Could not find version: ${response.statusText}`, {
      exit: 130,
    })
  }
}
