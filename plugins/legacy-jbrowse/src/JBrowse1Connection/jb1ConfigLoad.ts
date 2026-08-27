import { openLocation } from '@jbrowse/core/util/io'

import { parseJb1 } from './jb1ConfigParse.ts'
import { fillTemplate, isTrack } from './util.ts'

import type { Config, ProtoTrack, Track } from './types.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

// JBrowse 1 kept a data directory's track list in either or both of these, so
// a missing one is normal rather than an error
const TRACK_LISTS = ['trackList.json', 'tracks.conf']

/**
 * Read the track list out of a JBrowse 1 data directory. Only the tracks and
 * the data root survive: the rest of a JBrowse 1 config — display defaults,
 * `refSeqs`, `nameUrl`, the synthesized `stores` — describes the JBrowse 1
 * browser, which is not the thing being configured here.
 */
export async function fetchJb1(dataDir: FileLocation): Promise<Config> {
  const dataRoot = locationPath(dataDir).replace(/\/$/, '')
  const tracks: Track[] = []
  const seen = new Set<string>()

  async function read(path: string) {
    if (seen.has(path)) {
      return
    }
    seen.add(path)
    const config = await readConfig(dataDir, path)
    if (!config) {
      return
    }
    tracks.push(...regularizeTracks(config.tracks, { dataRoot }))
    const dir = path.replace(/\/[^/]*$/, '')
    for (const include of [config.include ?? []].flat()) {
      await read(/^\w[\w+.-]*:/.test(include) ? include : `${dir}/${include}`)
    }
  }

  for (const name of TRACK_LISTS) {
    await read(`${dataRoot}/${name}`)
  }

  return { dataRoot, tracks }
}

function locationPath(location: FileLocation) {
  return 'uri' in location
    ? location.uri
    : 'localPath' in location
      ? location.localPath
      : ''
}

async function readConfig(dataDir: FileLocation, path: string) {
  const location: FileLocation =
    'localPath' in dataDir
      ? { localPath: path, locationType: 'LocalPathLocation' }
      : { uri: path, locationType: 'UriLocation' }
  let text: string
  try {
    text = await openLocation(location).readFile('utf8')
  } catch {
    return undefined
  }
  return parseJb1(text, path)
}

/**
 * JBrowse 1 accepted `tracks` as an array, as a single track, or as an object
 * keyed by label; let a track hold its settings in a `config` subobject; and
 * let any string value interpolate `{dataRoot}`.
 */
function regularizeTracks(
  tracks: Config['tracks'],
  fillWith: { dataRoot: string },
): Track[] {
  const list = Array.isArray(tracks)
    ? tracks
    : !tracks
      ? []
      : isTrack(tracks)
        ? [tracks]
        : Object.entries(tracks).map(([label, track]) => ({ label, ...track }))

  return (list as Track[]).map(track => {
    const { config, ...rest } = track as ProtoTrack
    const flat = { ...config, ...rest }
    return Object.fromEntries(
      Object.entries(flat).map(([key, value]) => [
        key,
        typeof value === 'string' ? fillTemplate(value, fillWith) : value,
      ]),
    )
  }) as Track[]
}
