import { promises as fsPromises } from 'fs'
import path from 'path'

import parseJSON from 'json-parse-better-errors'

import fetch from './fetchWithProxy'

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

export function debug(message: string) {
  if (process.env.DEBUG) {
    console.log(`DEBUG: ${message}`)
  }
}

export async function readFile(location: string) {
  return fsPromises.readFile(location, { encoding: 'utf8' })
}

export async function readJsonFile<T>(location: string): Promise<T> {
  const contents = await fsPromises.readFile(location, { encoding: 'utf8' })
  return parseJSON(contents)
}

export async function writeJsonFile(location: string, contents: unknown) {
  debug(`Writing JSON file to ${process.cwd()} ${location}`)
  return fsPromises.writeFile(location, JSON.stringify(contents, null, 2))
}

export async function resolveFileLocation(
  location: string,
  check = true,
  inPlace = false,
) {
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
      console.warn(
        `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
      )
    }
    return inPlace ? location : filePath
  }
  throw new Error(`Could not resolve to a file or a URL: "${location}"`)
}

export async function readInlineOrFileJson<T>(inlineOrFileName: string) {
  let result: T
  // see if it's inline JSON
  try {
    result = parseJSON(inlineOrFileName) as T
  } catch (error) {
    debug(
      `Not valid inline JSON, attempting to parse as filename: '${inlineOrFileName}'`,
    )
    // not inline JSON, must be location of a JSON file
    result = await readJsonFile(inlineOrFileName)
  }
  return result
}

export async function fetchGithubVersions() {
  let versions: GithubRelease[] = []
  for await (const iter of fetchVersions()) {
    versions = [...versions, ...iter]
  }

  return versions
}

export async function getLatest() {
  for await (const versions of fetchVersions()) {
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

export async function* fetchVersions() {
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

export async function getTag(tag: string) {
  const response = await fetch(
    `https://api.github.com/repos/GMOD/jbrowse-components/releases/tags/${tag}`,
  )
  if (response.ok) {
    const result = (await response.json()) as GithubRelease
    const file = result.assets?.find(f =>
      f.name.includes('jbrowse-web'),
    )?.browser_download_url

    if (!file) {
      throw new Error(
        'Could not find version specified. Use --listVersions to see all available versions',
      )
    }
    return file
  }
  throw new Error(`Could not find version: ${response.statusText}`)
}

export async function getBranch(branch: string) {
  return `https://s3.amazonaws.com/jbrowse.org/code/jb2/${branch}/jbrowse-web-${branch}.zip`
}

export function printHelp({
  description,
  options,
  examples,
  usage,
}: {
  description: string
  options: Record<string, unknown>
  examples: string[]
  usage?: string
}) {
  console.log(description)
  console.log(`\nUsage: ${usage || 'jbrowse <command> [options]'}`)
  console.log('\nOptions:')
  for (const [name, option] of Object.entries(options)) {
    const short =
      'short' in (option as any) && (option as any).short
        ? `-${(option as any).short}`
        : '   '
    const namePadded = `--${name}`.padEnd(25, ' ')
    const desc = (option as any).description?.replace(
      /\n/g,
      `\n${' '.repeat(29)}`,
    )
    console.log(`  ${short}, ${namePadded} ${desc}`)
  }
  console.log(`\n${examples.join('\n')}`)
}
