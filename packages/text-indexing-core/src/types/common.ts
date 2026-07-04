import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { createGunzip } from 'node:zlib'

import type { LocalPathLocation, Track, UriLocation } from '../util.ts'

export function isURL(fileName: string) {
  try {
    const url = new URL(fileName)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function convertFileUrlToPath(fileUrl: string): string | undefined {
  try {
    const url = new URL(fileUrl)
    if (url.protocol === 'file:') {
      return fileURLToPath(url)
    }
  } catch {
    // not a valid URL
  }
  return undefined
}

function webStreamToNodeReadable(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Readable {
  return new Readable({
    read() {
      reader
        .read()
        .then(({ done, value }) => {
          this.push(done ? null : Buffer.from(value))
        })
        .catch((e: unknown) => {
          this.destroy(e as Error)
        })
    },
  })
}

export async function getLocalOrRemoteStream({
  file,
  out,
  onStart,
  onUpdate,
}: {
  file: string
  out: string
  onStart: (totalBytes: number) => void
  onUpdate: (receivedBytes: number) => void
}): Promise<Readable> {
  let receivedBytes = 0

  if (isURL(file)) {
    const res = await fetch(file)
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${file} status ${res.status} ${await res.text()}`,
      )
    }
    const totalBytes = +(res.headers.get('Content-Length') || 0)
    onStart(totalBytes)

    const body = res.body
    if (!body) {
      throw new Error(`Failed to fetch ${file}: no response body`)
    }

    // A fetched body is either a node Readable (node-fetch) or a web
    // ReadableStream (global fetch). Readable.fromWeb rejects a web stream from
    // a foreign realm — Chromium's DOM ReadableStream in the Electron indexing
    // worker is not an instance of node:stream/web's — so drive the reader
    // ourselves, which works for both realms.
    const nodeStream =
      body instanceof Readable ? body : webStreamToNodeReadable(body.getReader())
    nodeStream.on('data', chunk => {
      receivedBytes += chunk.length
      onUpdate(receivedBytes)
    })

    return nodeStream
  } else {
    // Handle file:// URLs by converting to local path
    const localPath = convertFileUrlToPath(file) ?? file
    const filename = path.isAbsolute(localPath)
      ? localPath
      : path.join(out, localPath)
    const totalBytes = fs.statSync(filename).size
    onStart(totalBytes)

    const stream = fs.createReadStream(filename)
    stream.on('data', chunk => {
      receivedBytes += chunk.length
      onUpdate(receivedBytes)
    })

    return stream
  }
}

export function createReadlineInterface(stream: Readable, inLocation: string) {
  const inputStream = /\.b?gz$/i.test(inLocation)
    ? stream.pipe(createGunzip())
    : stream
  return readline.createInterface({ input: inputStream })
}

export function parseAttributes(
  infoString: string,
  decodeFunc: (s: string) => string,
) {
  const result: Record<string, string | undefined> = {}
  for (const field of infoString.split(';')) {
    const trimmed = field.trim()
    if (trimmed) {
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1)
        result[key] = decodeFunc(val).trim().replaceAll(',', ' ')
      }
    }
  }
  return result
}

export function makeLocation(
  location: string,
  protocol: string,
): UriLocation | LocalPathLocation {
  if (protocol === 'uri') {
    return { uri: location, locationType: 'UriLocation' }
  }
  if (protocol === 'localPath') {
    return {
      localPath: path.resolve(location),
      locationType: 'LocalPathLocation',
    }
  }
  throw new Error(`invalid protocol ${protocol}`)
}

// ordered most-specific-first so e.g. `.vcf.gz` matches before `.vcf`
const adapterGuesses = [
  {
    regex: /\.vcf\.b?gz$/i,
    type: 'VcfTabixAdapter',
    locationKey: 'vcfGzLocation',
  },
  {
    regex: /\.gff3?\.b?gz$/i,
    type: 'Gff3TabixAdapter',
    locationKey: 'gffGzLocation',
  },
  { regex: /\.gtf?$/i, type: 'GtfAdapter', locationKey: 'gtfLocation' },
  { regex: /\.vcf$/i, type: 'VcfAdapter', locationKey: 'vcfLocation' },
  { regex: /\.gff3?$/i, type: 'Gff3Adapter', locationKey: 'gffLocation' },
]

export function guessAdapterFromFileName(filePath: string): Track {
  const guess = adapterGuesses.find(g => g.regex.test(filePath))
  if (guess) {
    const name = path.basename(filePath)
    const protocol = isURL(filePath) ? 'uri' : 'localPath'
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: guess.type,
        [guess.locationKey]: makeLocation(filePath, protocol),
      },
    }
  } else {
    throw new Error(`Unsupported file type ${filePath}`)
  }
}

// replaces characters invalid in Windows filenames: \ / : * ? " < > |
export function sanitizeForFilename(name: string) {
  return name.replaceAll(/[\\/:*?"<>|]/g, '_')
}

export function generateMeta({
  configs,
  attributesToIndex,
  outDir,
  name,
  featureTypesToExclude,
  assemblyNames,
}: {
  configs: Track[]
  attributesToIndex: string[]
  outDir: string
  name: string
  featureTypesToExclude: string[]
  assemblyNames: string[]
}) {
  const safeName = sanitizeForFilename(name)
  fs.writeFileSync(
    path.join(outDir, 'trix', `${safeName}_meta.json`),
    JSON.stringify(
      {
        dateCreated: new Date().toISOString(),
        tracks: configs.map(config => {
          const { trackId, textSearching, adapter } = config
          return {
            trackId,
            attributesIndexed:
              textSearching?.indexingAttributes ?? attributesToIndex,
            excludedTypes:
              textSearching?.indexingFeatureTypesToExclude ??
              featureTypesToExclude,
            adapterConf: adapter,
          }
        }),
        assemblyNames,
      },
      null,
      2,
    ),
  )
}
