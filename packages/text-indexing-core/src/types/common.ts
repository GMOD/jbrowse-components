import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { Readable } from 'stream'
import { fileURLToPath } from 'url'
import { createGunzip } from 'zlib'

import type { LocalPathLocation, Track, UriLocation } from '../util.ts'

// Checks if the passed in string is a valid URL.
// Returns a boolean.
export function isURL(FileName: string) {
  let url: URL | undefined

  try {
    url = new URL(FileName)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

// Convert file:// URLs to local paths (handles Windows paths correctly)
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

    const nodeStream =
      body instanceof Readable
        ? body
        : // @ts-ignore web vs node ReadableStream type mismatch
          Readable.fromWeb(body)
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

export function createReadlineInterface(
  stream: Readable,
  inLocation: string,
): readline.Interface {
  const isGzipped = /.b?gz$/.exec(inLocation)

  let inputStream: Readable
  if (isGzipped) {
    const gunzip = createGunzip()
    inputStream = stream.pipe(gunzip)
  } else {
    inputStream = stream
  }

  const rl = readline.createInterface({
    input: inputStream,
  })
  return rl
}

// Efficient attribute parsing for GFF3/VCF info fields
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

export function makeLocation(location: string, protocol: string) {
  if (protocol === 'uri') {
    return { uri: location, locationType: 'UriLocation' } as UriLocation
  }
  if (protocol === 'localPath') {
    return {
      localPath: path.resolve(location),
      locationType: 'LocalPathLocation',
    } as LocalPathLocation
  }
  throw new Error(`invalid protocol ${protocol}`)
}

export function guessAdapterFromFileName(filePath: string): Track {
  // const uri = isURL(filePath) ? filePath : path.resolve(filePath)
  const protocol = isURL(filePath) ? 'uri' : 'localPath'
  const name = path.basename(filePath)
  if (/\.vcf\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name: name,
      assemblyNames: [],
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gff3?\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gtf?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'GtfAdapter',
        gtfLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.vcf$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'VcfAdapter',
        vcfLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gff3?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3Adapter',
        gffLocation: makeLocation(filePath, protocol),
      },
    }
  } else {
    throw new Error(`Unsupported file type ${filePath}`)
  }
}

// Sanitize a string to be safe for use in filenames on all platforms
// Replaces characters that are invalid in Windows filenames: \ / : * ? " < > |
export function sanitizeForFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

/**
 * Generates metadata of index given a filename (trackId or assembly)
 */
export async function generateMeta({
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
              textSearching?.indexingAttributes || attributesToIndex,
            excludedTypes:
              textSearching?.indexingFeatureTypesToExclude ||
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
