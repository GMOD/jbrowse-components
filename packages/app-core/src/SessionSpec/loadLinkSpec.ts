import { setConf } from '@jbrowse/core/configuration'
import { openLocation } from '@jbrowse/core/util/io'
import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { isBaseSession, isSessionWithConnections } from '@jbrowse/product-core'

import { hubConnectionSpec } from './lgvUrlInit.ts'
import { loadSessionSpec } from './loadSessionSpec.ts'

import type { SessionSpec } from './loadSessionSpec.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/** A link's spec and what the link said around it */
export interface LinkSpec {
  spec: SessionSpec
  sessionName?: string
  // what the link asked for that the spec cannot carry
  notice?: string
  // the first `&hubURL=`, which names the session
  hubUrl?: string
}

/** the hub.txt shortLabel line, a hub's human-readable name */
export function parseHubShortLabel(hubTxt: string) {
  return hubTxt
    .split('\n')
    .find(line => line.startsWith('shortLabel'))
    ?.replace('shortLabel', '')
    .trim()
}

// Through the location the hub's connection reads, so a hub that connects is
// one that names. A hub.txt that cannot be read is the connection's to report.
async function readHubShortLabel(hubUrl: string, pluginManager: PluginManager) {
  try {
    const { hubTxtLocation } = hubConnectionSpec(hubUrl)
    return parseHubShortLabel(
      await openLocation(hubTxtLocation, pluginManager).readFile('utf8'),
    )
  } catch {
    return undefined
  }
}

async function nameAfterHub(
  session: AbstractSessionModel,
  hubUrl: string,
  renameSession: boolean,
  pluginManager: PluginManager,
) {
  const label = await readHubShortLabel(hubUrl, pluginManager)
  if (label && isStateTreeNode(session) && isAlive(session)) {
    if (renameSession && isBaseSession(session)) {
      session.setName(label)
    }
    const connection = isSessionWithConnections(session)
      ? session.connections.find(c => c.connectionId === hubUrl)
      : undefined
    if (connection) {
      setConf(connection, 'name', label)
    }
  }
}

/**
 * Open the session a link describes: its spec, named by the link's
 * `sessionName` or else by its hub, with the link's notice shown on it.
 *
 * A hub link's session is named by the hub's url, then by its shortLabel once
 * hub.txt is read, which also names the hub's connection. The load does not
 * wait on that read.
 */
export async function loadLinkSpec(
  { spec, sessionName, notice, hubUrl }: LinkSpec,
  pluginManager: PluginManager,
) {
  const name = sessionName ?? hubUrl
  const loaded = loadSessionSpec(
    name ? { ...spec, sessionName: name } : spec,
    pluginManager,
  )
  const session = pluginManager.rootModel?.session
  if (session) {
    if (notice) {
      session.notify(notice, 'warning')
    }
    if (hubUrl) {
      void nameAfterHub(session, hubUrl, !sessionName, pluginManager)
    }
  }
  await loaded
}
