import { isSessionWithAddAssembly } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation, resolveUriLocation } from '@jbrowse/core/util/io'

import type {
  AbstractViewContainer,
  AssemblyHost,
  UriLocation,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface SampleNavigationTarget {
  assemblyName: string
  chr: string
  start: number
  end: number
  sampleLabel: string
  /** config to load the assembly from when the session doesn't have it */
  assemblyConfigLocation?: UriLocation
}

/** `chr:start-end`, 1-based inclusive, from the half-open span. */
export function navigationLocString({
  chr,
  start,
  end,
}: SampleNavigationTarget) {
  return `${chr}:${start + 1}-${end}`
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
 * Load the target assembly as a session assembly when the session doesn't
 * already have it.
 *
 * A portal hosting many genomes keeps one config per genome — an alignment's
 * species are not, and cannot be, all present in the config the user opened
 * (genomes.jbrowse.org has ~50k). Fetching just the one assembly at click time
 * is what makes the row navigable without inlining hundreds of assemblies into
 * every alignment's config. `addRelativeUris` is required for the same reason
 * `JB2TrackHubConnection` runs it: the fetched config's relative sequence URIs
 * must resolve against the config, not the page.
 */
export async function ensureAssembly(
  session: AbstractViewContainer & AssemblyHost,
  target: SampleNavigationTarget,
) {
  const { assemblyConfigLocation, assemblyName } = target
  if (assemblyConfigLocation && !session.assemblyManager.has(assemblyName)) {
    // resolveUriLocation applies baseUri, which addRelativeUris stamped on when
    // the declaring config was itself fetched from a url. A config handed over
    // as an object has none, and its uri is then whatever the author wrote —
    // which fetch resolves against the page, so resolve the same way here
    // rather than letting `new URL` throw on a relative one.
    const { uri } = resolveUriLocation(assemblyConfigLocation)
    const configUrl = new URL(uri, globalThis.location.href)
    const configJson: unknown = JSON.parse(
      await openLocation(assemblyConfigLocation).readFile('utf8'),
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
 * Open the aligned sample's own genome at the locus its MAF row covers.
 *
 * The view id is keyed on the display and the sample, so repeatedly following
 * the same species' rows re-navigates one view instead of stacking new ones.
 * A brand-new view launches declaratively via `init` (spinner while the
 * assembly loads, then self-navigation) rather than being navigated
 * imperatively — same reasoning as the spreadsheet view's location links.
 */
export async function openSampleInNewView(
  session: AbstractViewContainer & AssemblyHost,
  displayId: string,
  target: SampleNavigationTarget,
) {
  await ensureAssembly(session, target)
  const viewId = `${displayId}_${target.assemblyName}`
  const locString = navigationLocString(target)
  const view = session.views.find(v => v.id === viewId) as
    | LinearGenomeViewModel
    | undefined
  if (view) {
    await view.navToLocString(locString, target.assemblyName)
  } else {
    session.addView('LinearGenomeView', {
      id: viewId,
      assembly: target.assemblyName,
      loc: locString,
    })
  }
}
