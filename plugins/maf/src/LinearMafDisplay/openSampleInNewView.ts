import { isSessionWithAddAssembly } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation, resolveUriLocation } from '@jbrowse/core/util/io'
import {
  annotationTrackIds,
  openAssemblyInLinearView,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AbstractViewContainer,
  AssemblyHost,
  TrackCatalog,
  UriLocation,
} from '@jbrowse/core/util'

export interface SampleNavigationTarget {
  assemblyName: string
  refName: string
  start: number
  end: number
  sampleLabel: string
  /** config to load the assembly from when the session doesn't have it */
  assemblyConfigLocation?: UriLocation
}

/** `refName:start-end`, 1-based inclusive, from the half-open span. */
export function navigationLocString({
  refName,
  start,
  end,
}: SampleNavigationTarget) {
  return `${refName}:${start + 1}-${end}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The `assemblies` entry named `assemblyName` in a fetched config.json. */
export function findAssemblyConf(configJson: unknown, assemblyName: string) {
  const assemblies = isRecord(configJson) ? configJson.assemblies : undefined
  return Array.isArray(assemblies)
    ? assemblies.find(
        (a: unknown): a is Record<string, unknown> =>
          isRecord(a) && a.name === assemblyName,
      )
    : undefined
}

/**
 * Load the target assembly as a session assembly when the session lacks it.
 * Fetching the one config at click time keeps hundreds of assemblies out of
 * every alignment's config; `addRelativeUris` makes its relative sequence URIs
 * resolve against the config, not the page.
 */
export async function ensureAssembly(
  session: AbstractViewContainer & AssemblyHost,
  target: SampleNavigationTarget,
  pluginManager: PluginManager,
) {
  const { assemblyConfigLocation, assemblyName } = target
  if (assemblyConfigLocation && !session.assemblyManager.has(assemblyName)) {
    // A config handed over as an object has no `baseUri`; resolve its uri
    // against the page as fetch would, so `new URL` does not throw on a
    // relative one.
    const { uri } = resolveUriLocation(assemblyConfigLocation)
    const configUrl = new URL(uri, globalThis.location.href)
    const configJson: unknown = JSON.parse(
      await openLocation(assemblyConfigLocation, pluginManager).readFile(
        'utf8',
      ),
    )
    const assemblyConf = findAssemblyConf(configJson, assemblyName)
    if (!assemblyConf) {
      throw new Error(`Assembly ${assemblyName} not found in ${configUrl.href}`)
    }
    addRelativeUris(assemblyConf, configUrl)
    if (!isSessionWithAddAssembly(session)) {
      throw new Error(
        `This session cannot load ${assemblyName}; open a config that already has it`,
      )
    }
    session.addSessionAssembly(assemblyConf)
  }
}

/**
 * Open the aligned sample's own genome at the locus its MAF row covers, with
 * the session's annotation for it. The view id keys on the display and sample,
 * so following the same species again re-navigates one view.
 */
export async function openSampleInNewView(
  session: AbstractViewContainer & AssemblyHost & TrackCatalog,
  displayId: string,
  target: SampleNavigationTarget,
  pluginManager: PluginManager,
) {
  await ensureAssembly(session, target, pluginManager)
  const { assemblyName } = target
  await openAssemblyInLinearView({
    session,
    id: `${displayId}_${assemblyName}`,
    assemblyName,
    loc: navigationLocString(target),
    tracks: annotationTrackIds(session, assemblyName),
  })
}
