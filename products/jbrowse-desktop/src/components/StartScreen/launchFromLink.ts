import {
  DEFAULT_SHARE_URL,
  loadSessionSpec,
  parseSessionSnapshotUrl,
  parseSessionSpecUrl,
} from '@jbrowse/app-core'
import {
  SHARE_PREFIX,
  fromUrlSafeB64,
  readSessionFromDynamo,
  shareEndpoint,
} from '@jbrowse/core/util'
import { resolveTrackId } from '@jbrowse/launch-args/trackIds'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { decodeSessionFromUrl } from '@jbrowse/product-core'

import type {
  ComparativeLaunchPlanJson,
  LaunchPlanJson,
  LinearLaunchPlanJson,
} from '../../../electron/ipc/channelTypes.ts'
import type { JBrowseConfig, JBrowseConfigInput } from './types.ts'
import type { ParsedSessionSnapshotUrl } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

// Turns a JBrowse Web link into a Desktop session. Web resolves these out of its
// address bar; Desktop gets the same result by parsing the link, loading the
// config it names, and running the identical loadSessionSpec — the
// LaunchView-<type> extension points it dispatches to are registered by the same
// plugins Desktop already loads.
//
// Both steps are injected, so the flow is exercisable without Electron and
// neither fetching nor session-file bookkeeping is duplicated here.
export interface LaunchFromLinkDeps {
  // fetch a hosted config, resolved and normalized the way Desktop loads any
  // other remote config (relative uris rebased, source url recorded)
  fetchConfig: (url: string) => Promise<JBrowseConfig>
  // build a plugin manager around that config, or around no config at all when
  // the spec carries its own assemblies
  createPluginManager: (config?: JBrowseConfig) => Promise<PluginManager>
  // vet plugins a link's own session asks for, the way fetchConfig vets a
  // config's: rejects when the user does not trust them
  trustPlugins: (plugins: PluginDefinition[]) => Promise<void>
}

function nonEmptyList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

// The snapshot a `share-` link names: fetched from the share service the
// link's own config points at, and decrypted with the password only the link
// holds. Web honors an empty or relative shareURL as relative to its page, so
// it is resolved against the page the link points at.
async function fetchSharedSnapshot(
  { session, password, pageUrl }: ParsedSessionSnapshotUrl,
  config: JBrowseConfig,
) {
  const configured = config.configuration?.shareURL
  const loadUrl = new URL(
    shareEndpoint(
      typeof configured === 'string' ? configured : DEFAULT_SHARE_URL,
      'load',
    ),
    pageUrl,
  ).href
  return JSON.parse(
    await fromUrlSafeB64(
      await readSessionFromDynamo(loadUrl, session, password ?? ''),
    ),
  ) as Record<string, unknown>
}

// A link that hands over a whole session: carried in it (`encoded-`/`json-`,
// what genomes.jbrowse.org's protein browser writes) or stored under an id
// (`share-`, what JBrowse Web's share button writes). The snapshot becomes the
// config's defaultSession, which is the session Desktop opens for any config,
// so nothing here re-implements applying one.
//
// Two keys of a web session have no slot in Desktop's: `sessionPlugins`, which
// join the config's plugins once trusted, and `sessionConnections`, which have
// nowhere to go yet and so stop the launch. MST drops an undeclared snapshot key
// in silence, so any other key Desktop's session did not take is reported on
// the session that opened without it.
async function launchSessionSnapshot(
  link: ParsedSessionSnapshotUrl,
  { fetchConfig, createPluginManager, trustPlugins }: LaunchFromLinkDeps,
) {
  const config = await fetchConfig(link.configUrl)
  const { sessionPlugins, sessionConnections, ...session } =
    link.session.startsWith(SHARE_PREFIX)
      ? await fetchSharedSnapshot(link, config)
      : await decodeSessionFromUrl(link.session)
  const connections = nonEmptyList(sessionConnections)
  if (connections.length) {
    throw new Error(
      `That link's session has ${connections.length} connection(s) of its own, which JBrowse Desktop cannot open from a link yet. Remove them in JBrowse Web and share the session again.`,
    )
  }
  const plugins = nonEmptyList(sessionPlugins) as PluginDefinition[]
  if (plugins.length) {
    await trustPlugins(plugins)
  }
  const pluginManager = await createPluginManager({
    ...config,
    plugins: [...(config.plugins ?? []), ...plugins],
    defaultSession: session,
  })
  const opened = pluginManager.rootModel?.session
  if (opened) {
    const taken = getSnapshot<Record<string, unknown>>(opened)
    const dropped = Object.keys(session).filter(key => !(key in taken))
    if (dropped.length) {
      opened.notifyError(
        `This link's session has settings JBrowse Desktop does not read (${dropped.join(', ')}), so it opened without them.`,
      )
    }
  }
  return pluginManager
}

// A url whose path ends in .json is a config, not a link to a view of one:
// a hub's own `config.json`, or one of genomes.jbrowse.org's per-assembly
// files. It describes no session, which is why parseSessionSpecUrl reports
// that it has none — true, and no use to someone whose link is the config.
// Checked only after that parse fails, so `config.json?session=spec-...` is
// still read as the spec link it is.
function namesAConfig(link: string) {
  try {
    return new URL(link).pathname.endsWith('.json')
  } catch {
    return false
  }
}

export async function launchFromLink(
  link: string,
  deps: LaunchFromLinkDeps,
): Promise<PluginManager> {
  const { fetchConfig, createPluginManager } = deps
  const snapshotLink = parseSessionSnapshotUrl(link)
  if (snapshotLink) {
    return launchSessionSnapshot(snapshotLink, deps)
  }
  let parsed
  try {
    parsed = parseSessionSpecUrl(link)
  } catch (e) {
    if (!namesAConfig(link)) {
      throw e
    }
  }
  if (parsed) {
    // a spec carrying its own sessionAssemblies needs no config; anything else
    // resolves its assembly/track names against the config the link points at
    const config = parsed.configUrl
      ? await fetchConfig(parsed.configUrl)
      : undefined
    const pluginManager = await createPluginManager(config)
    const { spec, sessionName } = parsed
    await loadSessionSpec(
      sessionName ? { ...spec, sessionName } : spec,
      pluginManager,
    )
    return pluginManager
  } else {
    // no spec to run: the config's own defaultSession is the session, the same
    // as opening that config from a file
    return createPluginManager(await fetchConfig(link))
  }
}

export interface LaunchFromPlanDeps {
  fetchConfig: LaunchFromLinkDeps['fetchConfig']
  createPluginManager: (config?: JBrowseConfigInput) => Promise<PluginManager>
  // a config.json on disk, its relative paths resolved against its folder
  readConfigFile: (path: string) => Promise<JBrowseConfigInput>
}

function reportUnapplied(pluginManager: PluginManager, unapplied: string[]) {
  if (unapplied.length) {
    pluginManager.rootModel?.session?.notify(
      `JBrowse Desktop did not apply these command-line arguments: ${unapplied.join(', ')}`,
      'warning',
    )
  }
}

/**
 * Turns a command line's plan into a session: the config it names, fetched
 * through the same plugin-trust gate a linked one passes, then one view of the
 * plan's genomes, files and tracks. A hosted config's genome is only known once
 * it is fetched, so its name is filled in here.
 */
export async function launchFromPlan(
  plan: LaunchPlanJson,
  deps: LaunchFromPlanDeps,
) {
  const pluginManager =
    plan.type === 'LinearGenomeView'
      ? await launchLinearPlan(plan, deps)
      : await launchComparativePlan(plan, deps)
  reportUnapplied(pluginManager, plan.unapplied)
  return pluginManager
}

// every genome comes from a file, so no config is fetched
async function launchComparativePlan(
  plan: ComparativeLaunchPlanJson,
  { createPluginManager }: LaunchFromPlanDeps,
) {
  const pluginManager = await createPluginManager(undefined)
  const view = {
    ...plan.view,
    type: plan.type,
    views: plan.views,
    tracks: plan.tracks.map(track => track.trackId),
  }
  await loadSessionSpec(
    {
      sessionAssemblies: plan.assemblies,
      sessionTracks: plan.tracks,
      views: [view],
    },
    pluginManager,
  )
  return pluginManager
}

async function launchLinearPlan(
  plan: LinearLaunchPlanJson,
  { fetchConfig, createPluginManager, readConfigFile }: LaunchFromPlanDeps,
) {
  const config = plan.config
    ? /^https?:\/\//i.test(plan.config)
      ? await fetchConfig(plan.config)
      : await readConfigFile(plan.config)
    : undefined
  const assembly = canonicalAssembly(plan, config)
  const configTracks = (config?.tracks ?? []).filter(
    t => typeof t.trackId === 'string',
  )
  // a file's trackId is exact; a --track token gets jb2export's leniency
  const fileIds = new Set(plan.tracks.map(t => t.trackId))
  const pluginManager = await createPluginManager(config)
  await loadSessionSpec(
    {
      sessionAssemblies: plan.assembly ? [plan.assembly] : [],
      sessionTracks: plan.tracks.map(track =>
        track.assemblyNames ? track : { ...track, assemblyNames: [assembly] },
      ),
      views: [
        {
          ...plan.view,
          type: 'LinearGenomeView',
          assembly,
          ...(plan.loc ? { loc: plan.loc } : {}),
          tracks: plan.show.map(({ trackId: token, modifiers }) => ({
            trackId: fileIds.has(token)
              ? token
              : resolveTrackId(configTracks, token, assembly),
            modifiers,
          })),
        },
      ],
    },
    pluginManager,
  )
  return pluginManager
}

/**
 * The config's own name for the assembly the plan asks for, so an alias on the
 * command line still matches `<assembly>-` trackIds and lands in track configs
 * as the canonical name.
 */
function canonicalAssembly(
  plan: LinearLaunchPlanJson,
  config: JBrowseConfigInput | undefined,
) {
  const requested = plan.assemblyName ?? config?.assemblies?.[0]?.name
  if (!requested) {
    throw new Error(`${plan.config} has no assemblies`)
  }
  if (!config) {
    return requested
  }
  const configAssemblies = config.assemblies ?? []
  const match = configAssemblies.find(
    a => a.name === requested || a.aliases?.includes(requested),
  )
  if (!match) {
    throw new Error(
      `${plan.config} has no assembly ${requested}; it has ${configAssemblies.map(a => a.name).join(', ')}`,
    )
  }
  return match.name
}
