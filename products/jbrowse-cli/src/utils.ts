import { promises as fsPromises, readFileSync } from 'node:fs'
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

// a JSON object, as opposed to a string/number/array/null. Parsed JSON reaches
// several commands as `unknown`, and the failure mode of not checking is that
// spreading a string yields an object of numeric keys.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  // config.json rather than being treated as the config file itself. A path
  // that isn't there at all is resolved from its name instead of rejected here,
  // so the caller's readConfigFile reports which config was missing and how to
  // make one rather than this leaking a bare stat ENOENT
  const stat = await ignoreNotFound(fsPromises.stat(output))
  const isDir = stat ? stat.isDirectory() : !output.endsWith('.json')
  return isDir ? path.join(output, 'config.json') : output
}

// `-` as a file argument means stdin, so a JSON hunk can be piped in rather than
// staged as a file: `jq … | jbrowse add-track-json -`
export const STDIN_ARG = '-'

let stdinConsumed = false

function readStdin() {
  // reading fd 0 twice yields nothing the second time, which would surface as a
  // baffling JSON parse error rather than the mistake it is
  if (stdinConsumed) {
    throw new Error('stdin ("-") can only be read once per command')
  }
  stdinConsumed = true
  return readFileSync(0, 'utf8')
}

export async function readJsonFile<T>(location: string): Promise<T> {
  const contents =
    location === STDIN_ARG
      ? readStdin()
      : await fsPromises.readFile(location, { encoding: 'utf8' })
  return JSON.parse(contents)
}

// reads the config of an existing install. Running a command from the wrong
// directory is the most common mistake, and a bare ENOENT does not say which
// directory was searched or what to do about it
export async function readConfigFile<T>(location: string): Promise<T> {
  // catching the code rather than testing the parsed value keeps a config that
  // legitimately parses to something falsy from reporting itself as missing
  return readJsonFile<T>(location).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `No JBrowse config found at ${path.resolve(location)}\n` +
          'Run "jbrowse create <dir>" to make a new installation, or point at an existing one with --out <dir>',
      )
    }
    throw error
  })
}

export async function writeJsonFile(location: string, contents: unknown) {
  debug(`Writing JSON file to ${process.cwd()} ${location}`)
  return fsPromises.writeFile(location, JSON.stringify(contents, null, 2))
}

export async function readInlineOrFileJson<T>(inlineOrFileName: string) {
  // checked before the inline attempt rather than falling through it, so the
  // intent is explicit (JSON.parse('-') happens to throw, but not by design)
  if (inlineOrFileName === STDIN_ARG) {
    return readJsonFile<T>(STDIN_ARG)
  }
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

async function fetchGithubVersions() {
  const versions: GithubRelease[] = []
  for await (const iter of fetchVersions()) {
    versions.push(...iter)
  }

  return versions
}

// Authenticated when the environment offers a token, because GitHub's anonymous
// API allows 60 requests an hour PER IP and CI runners share addresses: a
// `jbrowse create --tag v4.3.0` step fails partway through an otherwise green
// run, on nobody's diff, at whatever hour someone else's job exhausted the
// budget. jbrowse-plugin-protein3d and -msaview both lost a pinned-host e2e leg
// to it within a minute of each other on 2026-08-17. GITHUB_TOKEN is already in
// the environment of every Actions job, and raises the ceiling to 5000.
function githubToken() {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
}

// fetch + parse JSON from the GitHub API, throwing on a non-ok response. The
// lone cast localizes the unavoidable response.json(): Promise<unknown>
async function fetchJson<T>(url: string): Promise<T> {
  const token = githubToken()
  const response = await fetch(
    url,
    token ? { headers: { authorization: `Bearer ${token}` } } : {},
  )
  if (!response.ok) {
    // 403 unauthenticated is nearly always the rate limit rather than anything
    // about this url, and the caller above turns a throw into "could not find
    // version", which sends the reader looking for a version that is right
    // there. Say which it is.
    throw new Error(
      response.status === 403 && !token
        ? `HTTP 403 fetching ${url} -- probably GitHub's 60/hour anonymous rate limit. Set GITHUB_TOKEN to raise it.`
        : `HTTP ${response.status} fetching ${url}`,
    )
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

// The prefix a branch build is deployed under is slash-free. push.yml collapses
// `/` to `-` before it syncs (`SAFE_REF="${REF_NAME//\//-}"`) and then asserts
// the result is [A-Za-z0-9_.-], because the prefix is an S3 path and a nested
// branch name would otherwise open a directory in it. The zip inside is named
// from the same collapsed ref.
//
// So the collapse has to happen on this side too, or `--branch port/foo` asks
// for code/jb2/port/foo/jbrowse-web-port/foo.zip and 404s — for a build that
// was deployed, and is sitting at code/jb2/port-foo/. Slashes are the normal
// case for a branch name here (port/*, dependabot/*, anyone's feature/*).
function getBranch(branch: string) {
  const safeBranch = branch.replaceAll('/', '-')
  return `https://s3.amazonaws.com/jbrowse.org/code/jb2/${safeBranch}/jbrowse-web-${safeBranch}.zip`
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
async function resolveReleaseUrl({ url, nightly, branch, tag }: ReleaseFlags) {
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

async function fetchReleaseArchive(
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

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

// Walks the central directory rather than the local headers, because its
// offsets/sizes stay accurate even when a local header defers them to a data
// descriptor. Yielding entries keeps the pointer arithmetic in one place, so
// everything downstream works in terms of entries.
function* centralDirectoryEntries(archive: Buffer): Generator<ZipEntry> {
  const eocd = findEndOfCentralDirectory(archive)
  const entryCount = archive.readUInt16LE(eocd + 10)
  let ptr = archive.readUInt32LE(eocd + 16)

  for (let i = 0; i < entryCount; i++) {
    if (archive.readUInt32LE(ptr) !== CDH_SIG) {
      throw new Error('Corrupt ZIP: bad central directory header')
    }
    const nameLen = archive.readUInt16LE(ptr + 28)
    const extraLen = archive.readUInt16LE(ptr + 30)
    const commentLen = archive.readUInt16LE(ptr + 32)
    yield {
      name: archive.toString('utf8', ptr + 46, ptr + 46 + nameLen),
      method: archive.readUInt16LE(ptr + 10),
      compressedSize: archive.readUInt32LE(ptr + 20),
      localOffset: archive.readUInt32LE(ptr + 42),
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
}

function inflateEntry(
  archive: Buffer,
  { localOffset, compressedSize, method }: ZipEntry,
) {
  // the local header's name/extra lengths can differ from the central one, so
  // the data offset has to be computed from the local header
  const nameLen = archive.readUInt16LE(localOffset + 26)
  const extraLen = archive.readUInt16LE(localOffset + 28)
  const dataStart = localOffset + 30 + nameLen + extraLen
  const raw = archive.subarray(dataStart, dataStart + compressedSize)
  return method === 0 ? raw : zlib.inflateRawSync(raw)
}

// Extracts a ZIP archive (a JBrowse web build) into destPath with the built-in
// node:zlib. Replaces the `decompress` dependency and its large, unmaintained
// transitive tree without pulling in a new one.
export async function extractZip(archive: Buffer, destPath: string) {
  await Promise.all(
    [...centralDirectoryEntries(archive)]
      // directory entries (trailing slash) carry no file data; the files below
      // create their own parent dirs
      .filter(entry => !entry.name.endsWith('/'))
      .map(entry =>
        writeZipEntry(destPath, entry.name, inflateEntry(archive, entry)),
      ),
  )
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

// help text is authored as one long string where \n\n is a paragraph break and a
// bare \n is insignificant whitespace, so unfold it back into paragraphs
function paragraphs(text: string) {
  return text.split('\n\n').map(p => p.replaceAll('\n', ' '))
}

// greedily pack words into lines no wider than `width`. A word longer than the
// width gets a line to itself rather than being broken.
function wrapParagraph(paragraph: string, width: number): string[] {
  if (paragraph.length <= width) {
    return [paragraph]
  }
  const lines: string[] = []
  for (const word of paragraph.split(' ')) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= width) {
      lines[lines.length - 1] = `${last} ${word}`
    } else {
      lines.push(word)
    }
  }
  return lines
}

function wrapText(text: string, width: number, indent: string) {
  return (
    paragraphs(text)
      // a blank line separates paragraphs
      .flatMap((p, i) => (i === 0 ? [] : ['']).concat(wrapParagraph(p, width)))
      // indent continuation lines, but leave the blank separators empty rather
      // than filling them with trailing indent whitespace
      .map((line, i) => (i === 0 || !line ? line : indent + line))
      .join('\n')
  )
}

// the subset of a parseArgs option definition that printHelp renders (the
// definitions also carry `type`/`multiple`, which are ignored here)
interface HelpOption {
  short?: string
  description?: string
  choices?: readonly string[]
  default?: string | boolean
}

// one rendered `-x, --name  description [choices: ...] [default: ...]` line, with
// the description wrapped under the name column
function formatOption(
  name: string,
  opt: HelpOption,
  termWidth: number,
): string {
  const prefix = opt.short ? `  -${opt.short}, ` : ' '.repeat(6)
  const namePadded = `--${name}`.padEnd(22, ' ')
  const indent = ' '.repeat(prefix.length + namePadded.length + 1)

  const desc = [
    // every command declares a bare help flag; give it uniform wording so the
    // rendered `-h, --help` line is never blank
    opt.description ?? (name === 'help' ? 'Show help' : ''),
    opt.choices && ` [choices: ${opt.choices.join(', ')}]`,
    opt.default !== undefined && ` [default: ${opt.default}]`,
  ]
    .filter(Boolean)
    .join('')

  const wrapped = desc ? wrapText(desc, termWidth - indent.length, indent) : ''
  return `${prefix}${namePadded} ${wrapped}`.trimEnd()
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
  console.log(
    [
      wrapText(description, termWidth, ''),
      `\nUsage: ${usage || 'jbrowse <command> [options]'}`,
      '\nOptions:',
      // a blank line after each option, so long wrapped descriptions stay
      // visually separated
      ...Object.entries(options).map(
        ([name, opt]) => `${formatOption(name, opt, termWidth)}\n`,
      ),
      ...(notes ? [`Notes:\n\n${wrapText(notes, termWidth, '')}\n`] : []),
      ...(examples.length ? ['Examples:\n', examples.join('\n')] : []),
    ].join('\n'),
  )
}
