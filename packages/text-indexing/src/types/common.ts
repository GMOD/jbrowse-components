import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import type { LocalPathLocation, UriLocation, Track } from '../util'

// Method for handing off the parsing of a gff3 file URL. Calls the proper
// parser depending on if it is gzipped or not. Returns a @gmod/gff stream.
export async function createRemoteStream(urlIn: string) {
  const res = await fetch(urlIn)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${res.status} ${await res.text()}`,
    )
  }
  return res
}

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

export async function getLocalOrRemoteStream({
  file,
  out,
  onBytesReceived,
  onTotalBytes,
}: {
  file: string
  out: string
  onBytesReceived: (totalBytesReceived: number) => void
  onTotalBytes: (totalBytes: number) => void
}) {
  let receivedBytes = 0
  if (isURL(file)) {
    const result = await createRemoteStream(file)
    result.body.on('data', chunk => {
      receivedBytes += chunk.length
      onBytesReceived(receivedBytes)
    })
    onTotalBytes(+(result.headers.get('Content-Length') || 0))
    return result.body
  } else {
    const filename = path.isAbsolute(file) ? file : path.join(out, file)
    const stream = fs.createReadStream(filename)
    stream.on('data', chunk => {
      receivedBytes += chunk.length
      onBytesReceived(receivedBytes)
    })
    onTotalBytes(fs.statSync(filename).size)
    return stream
  }
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
  fs.writeFileSync(
    path.join(outDir, 'trix', `${name}_meta.json`),
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
