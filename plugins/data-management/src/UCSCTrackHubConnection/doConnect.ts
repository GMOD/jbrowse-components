import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import { getConf } from '@jbrowse/core/configuration'
import {
  getEnv,
  getSession,
  isLocalPathLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { generateAssembly } from './generateAssembly.ts'
import { generateTracks } from './ucscTrackHub.ts'
import {
  fetchGenomesFile,
  fetchTrackDbFile,
  formatHubLoadSummary,
  hubBaseUrl,
  makeLocFromUri,
} from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { UCSCTrackHubConnectionConfigModel } from './configSchema.ts'
import type { HubLocation } from './util.ts'
import type { RaStanza } from '@gmod/ucsc-hub'
import type PluginManager from '@jbrowse/core/PluginManager'

type Self = ConnectionDoConnectArg<UCSCTrackHubConnectionConfigModel>

// fetch a single genome's trackDb (resolved against the genomes.txt location)
// and convert it into jbrowse track configs
async function loadGenomeTracks({
  genome,
  genomeName,
  genomesBaseUri,
  pluginManager,
}: {
  genome: RaStanza
  genomeName: string
  genomesBaseUri: string
  pluginManager: PluginManager
}) {
  const db = genome.data.trackDb
  if (!db) {
    throw new Error(`trackDb not found for ${genomeName}`)
  }
  const loc = makeLocFromUri(db, genomesBaseUri)
  const trackDb = await fetchTrackDbFile(loc, pluginManager)
  return generateTracks({
    trackDb,
    trackDbLoc: loc,
    assemblyName: genomeName,
  })
}

type Session = ReturnType<typeof getSession>

// a track hub names a genome without supplying its sequence
function canAttach(session: Session, genome: RaStanza, genomeName: string) {
  return (
    session.assemblyManager.has(genomeName) ||
    !!(session.addSessionAssembly && genome.data.twoBitPath)
  )
}

function ensureAssembly(
  session: Session,
  genome: RaStanza,
  genomeName: string,
  baseUri: string,
) {
  const { twoBitPath } = genome.data
  if (session.assemblyManager.has(genomeName)) {
    return true
  } else if (session.addSessionAssembly && twoBitPath) {
    session.addSessionAssembly(generateAssembly(genome, twoBitPath, baseUri))
    return true
  } else {
    return false
  }
}

async function connectSingleFileHub(
  self: Self,
  hubFileText: string,
  hubFileLocation: HubLocation,
) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)
  const { genome, tracks } = new SingleFileHub(hubFileText)
  const genomeName = genome.name!
  if (
    !ensureAssembly(session, genome, genomeName, hubBaseUrl(hubFileLocation))
  ) {
    // the hub's single genome isn't present and can't be added, so its tracks
    // would have nowhere to attach
    throw new Error(
      `Cannot load hub: assembly ${genomeName} is not present and ${
        genome.data.twoBitPath
          ? 'this session cannot add assemblies'
          : 'the hub supplies no sequence for it'
      }`,
    )
  }
  self.addTrackConfs(
    generateTracks({
      trackDb: tracks,
      trackDbLoc: hubFileLocation,
      assemblyName: genomeName,
    }),
  )
  if (!self.silent) {
    // Launch through the extension point rather than session.addView so a
    // plugin that hooks LaunchView-LinearGenomeView sees hub-driven launches
    // too. Awaited because a plugin's handler may be async, and Strict
    // because lazyConnect owns the failure policy (snackbar + break the
    // connection) and every other line here reports by throwing — the
    // swallowing variant would let a hub with an unresolvable assembly
    // report success and open nothing.
    await pluginManager.evaluateAsyncExtensionPointStrict(
      'LaunchView-LinearGenomeView',
      {
        session,
        assembly: genomeName,
        tracklist: true,
        loc: genome.data.defaultPos,
      },
    )
  }
}

async function connectMultiGenomeHub(
  self: Self,
  hubFileText: string,
  hubFileLocation: HubLocation,
) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)
  const genomeFile = new HubFile(hubFileText).data.genomesFile
  if (!genomeFile) {
    throw new Error('genomesFile not found on hub')
  }
  const assemblyNames = getConf(self, 'assemblyNames')
  const genomesLoc = makeLocFromUri(genomeFile, hubBaseUrl(hubFileLocation))
  const genomesFile = await fetchGenomesFile(genomesLoc, pluginManager)
  const genomesBaseUri = hubBaseUrl(genomesLoc)
  const trackCounts: Record<string, number> = {}
  const notLoadedAssemblies: string[] = []
  const unreadAssemblies: { genomeName: string; error: unknown }[] = []
  for (const [genomeName, genome] of Object.entries(genomesFile.data)) {
    if (
      isAlive(self) &&
      (assemblyNames.length === 0 || assemblyNames.includes(genomeName))
    ) {
      if (canAttach(session, genome, genomeName)) {
        try {
          const tracks = await loadGenomeTracks({
            genome,
            genomeName,
            genomesBaseUri,
            pluginManager,
          })
          if (isAlive(self)) {
            ensureAssembly(session, genome, genomeName, genomesBaseUri)
            self.addTrackConfs(tracks)
            trackCounts[genomeName] = tracks.length
          }
        } catch (error) {
          unreadAssemblies.push({ genomeName, error })
        }
      } else {
        notLoadedAssemblies.push(genomeName)
      }
    }
  }

  if (isAlive(self)) {
    const [firstUnread] = unreadAssemblies
    if (firstUnread && Object.keys(trackCounts).length === 0) {
      throw firstUnread.error
    }
    if (firstUnread) {
      for (const { error } of unreadAssemblies) {
        console.error(error)
      }
      session.notify(
        `${getConf(self, 'name')}: could not read the tracks of these assemblies: ${unreadAssemblies.map(u => u.genomeName).join(', ')}`,
        'warning',
      )
    }
    const summary = formatHubLoadSummary(trackCounts, notLoadedAssemblies)
    if (!self.silent && summary) {
      session.notify(
        summary,
        Object.keys(trackCounts).length > 0 ? 'success' : 'warning',
      )
    }
  }
}

// lazyConnect wraps this in the shared connect-failure handler
export async function doConnect(self: Self) {
  const { pluginManager } = getEnv(self)
  const hubFileLocation = getConf(self, 'hubTxtLocation')
  if (
    !isUriLocation(hubFileLocation) &&
    !isLocalPathLocation(hubFileLocation)
  ) {
    throw new Error('UCSC track hubs must be loaded from a URL or local file')
  }
  const hubFileText = await openLocation(
    hubFileLocation,
    pluginManager,
  ).readFile('utf8')
  if (isAlive(self)) {
    await (hubFileText.includes('useOneFile on')
      ? connectSingleFileHub(self, hubFileText, hubFileLocation)
      : connectMultiGenomeHub(self, hubFileText, hubFileLocation))
  }
}
