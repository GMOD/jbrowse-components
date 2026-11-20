import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import { getConf } from '@jbrowse/core/configuration'
import {
  getEnv,
  getSession,
  isLocalPathLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
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

type Session = ReturnType<typeof getSession>

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

function canAttach(session: Session, genome: RaStanza, genomeName: string) {
  return (
    session.assemblyManager.has(genomeName) ||
    !!(session.addSessionAssembly && genome.data.twoBitPath)
  )
}

function attach(
  session: Session,
  genome: RaStanza,
  genomeName: string,
  baseUri: string,
) {
  const { twoBitPath } = genome.data
  if (!session.assemblyManager.has(genomeName) && twoBitPath) {
    session.addSessionAssembly?.(generateAssembly(genome, twoBitPath, baseUri))
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
  if (!canAttach(session, genome, genomeName)) {
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
  attach(session, genome, genomeName, hubBaseUrl(hubFileLocation))
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
  const genomes = Object.entries(genomesFile.data).filter(
    ([genomeName]) =>
      assemblyNames.length === 0 ||
      assemblyNames.some(name =>
        isSameAssemblyName(name, genomeName, session.assemblyManager),
      ),
  )
  if (assemblyNames.length > 0 && genomes.length === 0) {
    throw new Error(
      `none of this hub's genomes is named ${assemblyNames.join(', ')}, as assemblyNames asks`,
    )
  }
  for (const [genomeName, genome] of genomes) {
    if (isAlive(self)) {
      if (canAttach(session, genome, genomeName)) {
        try {
          const tracks = await loadGenomeTracks({
            genome,
            genomeName,
            genomesBaseUri,
            pluginManager,
          })
          if (isAlive(self)) {
            attach(session, genome, genomeName, genomesBaseUri)
            self.addTrackConfs(tracks)
            trackCounts[genomeName] = tracks.length
          }
        } catch (error) {
          if (isAlive(self)) {
            attach(session, genome, genomeName, genomesBaseUri)
            unreadAssemblies.push({ genomeName, error })
          }
        }
      } else {
        notLoadedAssemblies.push(genomeName)
      }
    }
  }

  if (isAlive(self)) {
    const loadedAny = Object.keys(trackCounts).length > 0
    const [firstUnread] = unreadAssemblies
    if (firstUnread) {
      if (!loadedAny) {
        throw firstUnread.error
      }
      for (const { error } of unreadAssemblies) {
        console.error(error)
      }
    }
    const summary = formatHubLoadSummary(
      trackCounts,
      notLoadedAssemblies,
      unreadAssemblies.map(unread => unread.genomeName),
    )
    if (summary && (firstUnread || !self.silent)) {
      session.notify(summary, loadedAny && !firstUnread ? 'success' : 'warning')
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
