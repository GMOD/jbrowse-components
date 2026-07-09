import { promises as fsPromises } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import fetch from './cliFetch.ts'

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets?: {
    browser_download_url: string
    name: string
  }[]
}

export function parseCommaSeparatedString(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map(s => s.trim())
      .filter(Boolean) ?? []
  )
}

// throws a uniform "missing argument" error (with the same usage string passed
// to printHelp) when a required positional is absent, and narrows the value to
// string for the caller
export function requirePositional(
  value: string | undefined,
  name: string,
  usage: string,
): asserts value is string {
  if (!value) {
    throw new Error(`Missing required argument: ${name}\nUsage: ${usage}`)
  }
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
    result = JSON.parse(inlineOrFileName)
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

// fetch + parse JSON from the GitHub API, throwing on a non-ok response. The
// lone cast localizes the unavoidable response.json(): Promise<unknown>
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }
  return response.json() as Promise<T>
}

// the jbrowse-web build is the asset we unpack; a release can have no matching
// asset if it was just uploaded or its build failed
function findWebAssetUrl(release: GithubRelease) {
  return release.assets?.find(f => f.name.includes('jbrowse-web'))
    ?.browser_download_url
}

async function getLatest() {
  for await (const versions of fetchVersions()) {
    const release = versions.find(r => !r.prerelease && r.assets?.length)
    if (release) {
      const file = findWebAssetUrl(release)
      if (file) {
        return file
      } else {
        throw new Error('no jbrowse-web download found')
      }
    }
  }

  throw new Error('no version tags found')
}

async function* fetchVersions() {
  let page = 1
  let done = false

  while (!done) {
    const result = await fetchJson<GithubRelease[]>(
      `https://api.github.com/repos/GMOD/jbrowse-components/releases?page=${page}`,
    )
    if (result.length === 0) {
      done = true
    } else {
      yield result.filter(release => release.tag_name.startsWith('v'))
      page++
    }
  }
}

async function getTag(tag: string) {
  const release = await fetchJson<GithubRelease>(
    `https://api.github.com/repos/GMOD/jbrowse-components/releases/tags/${tag}`,
  )
  const file = findWebAssetUrl(release)
  if (file) {
    return file
  } else {
    throw new Error(
      'Could not find version specified. Use --listVersions to see all available versions',
    )
  }
}

function getBranch(branch: string) {
  return `https://s3.amazonaws.com/jbrowse.org/code/jb2/${branch}/jbrowse-web-${branch}.zip`
}

interface ReleaseFlags {
  url?: string
  nightly?: boolean
  branch?: string
  tag?: string
}

// resolves the JBrowse release download URL from the create/upgrade flags,
// preferring an explicit --url, then --nightly, --branch, and finally --tag
// (or the latest release)
export async function resolveReleaseUrl({
  url,
  nightly,
  branch,
  tag,
}: ReleaseFlags) {
  return url
    ? url
    : nightly
      ? getBranch('main')
      : branch
        ? getBranch(branch)
        : tag
          ? getTag(tag)
          : getLatest()
}

// shared by create/upgrade: resolve the release URL then download it. Returns
// both so the caller can log which URL was unpacked.
export async function downloadRelease(flags: ReleaseFlags) {
  const locationUrl = await resolveReleaseUrl(flags)
  const archive = await fetchReleaseArchive(locationUrl, !!flags.url)
  return { locationUrl, archive }
}

export async function printVersions() {
  const versions = (await fetchGithubVersions()).map(v => v.tag_name)
  console.log(`All JBrowse versions:\n${versions.join('\n')}`)
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
  // guard against zip-slip: a crafted entry name (e.g. ../../etc/foo) must not
  // let path.join escape destPath, since --url accepts arbitrary archives
  const rel = path.relative(destPath, outPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Corrupt ZIP: entry escapes destination directory: ${name}`)
  }
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
    .replaceAll('\n\n', '\0')
    .replaceAll('\n', ' ')
    .replaceAll('\u{0}', '\n\n')
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
  // indent continuation lines, but leave blank paragraph-separator lines empty
  // rather than filling them with trailing indent whitespace
  return lines
    .map((line, i) => (i === 0 || !line ? line : indent + line))
    .join('\n')
}

// the subset of a parseArgs option definition that printHelp renders (the
// definitions also carry `type`/`multiple`, which are ignored here)
interface HelpOption {
  short?: string
  description?: string
  choices?: readonly string[]
  default?: string | boolean
}

export function printHelp({
  description,
  options,
  examples,
  notes,
  usage,
}: {
  description: string
  options: Record<string, HelpOption>
  examples: string[]
  notes?: string
  usage?: string
}) {
  const termWidth = process.stdout.columns || 80
  console.log(wrapText(description, termWidth, ''))
  console.log(`\nUsage: ${usage || 'jbrowse <command> [options]'}`)
  console.log('\nOptions:')
  for (const [name, opt] of Object.entries(options)) {
    const prefix = opt.short ? `  -${opt.short}, ` : ' '.repeat(6)
    const namePadded = `--${name}`.padEnd(22, ' ')
    const indent = ' '.repeat(prefix.length + namePadded.length + 1)
    const descWidth = termWidth - indent.length

    // every command declares a bare help flag; give it uniform wording so the
    // rendered `-h, --help` line is never blank
    let desc = opt.description ?? (name === 'help' ? 'Show help' : '')
    if (opt.choices) {
      desc += ` [choices: ${opt.choices.join(', ')}]`
    }
    if (opt.default !== undefined) {
      desc += ` [default: ${opt.default}]`
    }

    const wrapped = desc ? wrapText(desc, descWidth, indent) : ''
    console.log(`${`${prefix}${namePadded} ${wrapped}`.trimEnd()}\n`)
  }
  if (notes) {
    console.log(`Notes:\n\n${wrapText(notes, termWidth, '')}\n`)
  }
  if (examples.length) {
    console.log('Examples:\n')
    console.log(examples.join('\n'))
  }
}
