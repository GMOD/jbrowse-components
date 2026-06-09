import { promises as fsPromises } from 'fs'
import path from 'path'
import zlib from 'zlib'

import fetch from './cliFetch.ts'

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

export function parseCommaSeparatedString(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map(s => s.trim())
      .filter(Boolean) ?? []
  )
}

export function ignoreNotFound<T>(promise: Promise<T>) {
  return promise.catch((err: unknown) => {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
    return null
  })
}

export function debug(message: string) {
  if (process.env.DEBUG) {
    console.log(`DEBUG: ${message}`)
  }
}

export async function resolveConfigPath(target?: string, out?: string) {
  const output = target || out || '.'
  // stat (not lstat) so a symlinked install directory resolves to its
  // config.json rather than being treated as the config file itself
  const stat = await fsPromises.stat(output)
  return stat.isDirectory() ? path.join(output, 'config.json') : output
}

export async function readJsonFile<T>(location: string): Promise<T> {
  const contents = await fsPromises.readFile(location, { encoding: 'utf8' })
  return JSON.parse(contents)
}

export async function writeJsonFile(location: string, contents: unknown) {
  debug(`Writing JSON file to ${process.cwd()} ${location}`)
  return fsPromises.writeFile(location, JSON.stringify(contents, null, 2))
}

export async function readInlineOrFileJson<T>(inlineOrFileName: string) {
  let result: T
  // see if it's inline JSON
  try {
    result = JSON.parse(inlineOrFileName) as T
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
  const versions: GithubRelease[] = []
  for await (const iter of fetchVersions()) {
    versions.push(...iter)
  }

  return versions
}

async function getLatest() {
  for await (const versions of fetchVersions()) {
    // if a release was just uploaded, or an erroneous build was made then it
    // might have no build asset
    const release = versions.find(r => !r.prerelease && r.assets?.length)
    if (release?.assets) {
      const file = release.assets.find(f =>
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

async function* fetchVersions() {
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

async function getTag(tag: string) {
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

async function getBranch(branch: string) {
  return `https://s3.amazonaws.com/jbrowse.org/code/jb2/${branch}/jbrowse-web-${branch}.zip`
}

// resolves the JBrowse release download URL from the create/upgrade flags,
// preferring an explicit --url, then --nightly, --branch, and finally --tag
// (or the latest release)
export async function resolveReleaseUrl({
  url,
  nightly,
  branch,
  tag,
}: {
  url?: string
  nightly?: boolean
  branch?: string
  tag?: string
}) {
  return (
    url ||
    (nightly ? await getBranch('main') : '') ||
    (branch ? await getBranch(branch) : '') ||
    (tag ? await getTag(tag) : await getLatest())
  )
}

export async function fetchReleaseArchive(
  locationUrl: string,
  validateZipContentType: boolean,
) {
  console.log(`Fetching ${locationUrl}...`)
  const response = await fetch(locationUrl)
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} fetching ${locationUrl}: ${response.statusText}`,
    )
  }

  const type = response.headers.get('content-type')
  if (
    validateZipContentType &&
    type !== 'application/zip' &&
    type !== 'application/octet-stream'
  ) {
    throw new Error(
      'The URL provided does not seem to be a JBrowse installation URL',
    )
  }

  return Buffer.from(await response.arrayBuffer())
}

// ZIP record signatures (little-endian)
const EOCD_SIG = 0x06054b50 // end of central directory
const CDH_SIG = 0x02014b50 // central directory header

// Extracts a ZIP archive (a JBrowse web build) into destPath. Walks the central
// directory for accurate per-entry offsets/sizes (which stays correct even when
// local headers use data descriptors), then inflates each entry with the
// built-in node:zlib. Replaces the `decompress` dependency and its large,
// unmaintained transitive tree without pulling in a new one.
export async function extractZip(archive: Buffer, destPath: string) {
  const eocd = findEndOfCentralDirectory(archive)
  const entryCount = archive.readUInt16LE(eocd + 10)
  let ptr = archive.readUInt32LE(eocd + 16)

  const writes: Promise<void>[] = []
  for (let i = 0; i < entryCount; i++) {
    if (archive.readUInt32LE(ptr) !== CDH_SIG) {
      throw new Error('Corrupt ZIP: bad central directory header')
    }
    const method = archive.readUInt16LE(ptr + 10)
    const compressedSize = archive.readUInt32LE(ptr + 20)
    const nameLen = archive.readUInt16LE(ptr + 28)
    const extraLen = archive.readUInt16LE(ptr + 30)
    const commentLen = archive.readUInt16LE(ptr + 32)
    const localOffset = archive.readUInt32LE(ptr + 42)
    const name = archive.toString('utf8', ptr + 46, ptr + 46 + nameLen)
    ptr += 46 + nameLen + extraLen + commentLen

    // directory entries (trailing slash) carry no file data; files below create
    // their own parent dirs
    if (!name.endsWith('/')) {
      // the local header's name/extra lengths can differ from the central one
      const localNameLen = archive.readUInt16LE(localOffset + 26)
      const localExtraLen = archive.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + localNameLen + localExtraLen
      const raw = archive.subarray(dataStart, dataStart + compressedSize)
      const data = method === 0 ? raw : zlib.inflateRawSync(raw)
      writes.push(writeZipEntry(destPath, name, data))
    }
  }
  await Promise.all(writes)
}

async function writeZipEntry(destPath: string, name: string, data: Buffer) {
  const outPath = path.join(destPath, name)
  await fsPromises.mkdir(path.dirname(outPath), { recursive: true })
  await fsPromises.writeFile(outPath, data)
}

function findEndOfCentralDirectory(archive: Buffer) {
  // the EOCD sits at the end, after an optional comment of up to 64KB, so scan
  // backwards for its signature
  for (let i = archive.length - 22; i >= 0; i--) {
    if (archive.readUInt32LE(i) === EOCD_SIG) {
      return i
    }
  }
  throw new Error('Corrupt ZIP: no end-of-central-directory record')
}

function wrapText(text: string, width: number, indent: string) {
  // Normalize: join single \n into spaces, preserve \n\n as paragraph breaks
  const normalized = text
    .replace(/\n\n/g, '\0')
    .replace(/\n/g, ' ')
    .replace(/\0/g, '\n\n')
  const lines = []
  for (const line of normalized.split('\n')) {
    if (line.length <= width) {
      lines.push(line)
    } else {
      const words = line.split(' ')
      let current = ''
      for (const word of words) {
        if (current.length + word.length + 1 <= width) {
          current += (current ? ' ' : '') + word
        } else {
          if (current) {
            lines.push(current)
          }
          current = word
        }
      }
      if (current) {
        lines.push(current)
      }
    }
  }
  return lines.join(`\n${indent}`)
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
  const termWidth = process.stdout.columns || 80
  console.log(description)
  console.log(`\nUsage: ${usage || 'jbrowse <command> [options]'}`)
  console.log('\nOptions:')
  for (const [name, option] of Object.entries(options)) {
    const opt = option as Record<string, unknown>
    const shortFlag = opt.short
    const prefix = shortFlag ? `  -${shortFlag}, ` : ' '.repeat(6)
    const namePadded = `--${name}`.padEnd(22, ' ')
    const indent = ' '.repeat(prefix.length + namePadded.length + 1)
    const descWidth = termWidth - indent.length

    let desc = (opt.description as string) || ''
    if (opt.choices) {
      desc += ` [choices: ${(opt.choices as string[]).join(', ')}]`
    }
    if (opt.default !== undefined) {
      desc += ` [default: ${opt.default}]`
    }

    const wrapped = desc ? wrapText(desc, descWidth, indent) : ''
    console.log(`${prefix}${namePadded} ${wrapped}\n`)
  }
  console.log(examples.join('\n'))
}
