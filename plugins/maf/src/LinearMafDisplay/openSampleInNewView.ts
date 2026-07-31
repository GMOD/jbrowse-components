import { isSessionWithAddAssembly } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation } from '@jbrowse/core/util/io'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface SampleNavigationTarget {
  assemblyName: string
  chr: string
  start: number
  end: number
  sampleLabel: string
  /** config to load the assembly from when the session doesn't have it */
  assemblyConfigUrl?: string
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
async function ensureAssembly(
  session: AbstractSessionModel,
  target: SampleNavigationTarget,
) {
  const { assemblyConfigUrl, assemblyName } = target
  if (assemblyConfigUrl && !session.assemblyManager.has(assemblyName)) {
    const configJson: unknown = JSON.parse(
      await openLocation({
        uri: assemblyConfigUrl,
        locationType: 'UriLocation',
      }).readFile('utf8'),
    )
    const assemblyConf = findAssemblyConf(configJson, assemblyName)
    if (!assemblyConf) {
      throw new Error(
        `Assembly ${assemblyName} not found in ${assemblyConfigUrl}`,
      )
    }
    addRelativeUris(assemblyConf, new URL(assemblyConfigUrl))
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
  session: AbstractSessionModel,
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
      init: { assembly: target.assemblyName, loc: locString },
    })
  }
}
