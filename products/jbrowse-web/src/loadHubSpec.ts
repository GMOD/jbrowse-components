import { isSessionModelWithConnections } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { isBaseSession } from '@jbrowse/product-core'
import { isWebSessionWithConnections } from '@jbrowse/web-core'
import { when } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// the hub.txt shortLabel line, used as a human-readable session name
export function parseHubShortLabel(hubTxt: string) {
  return hubTxt
    .split('\n')
    .find(line => line.startsWith('shortLabel'))
    ?.replace('shortLabel', '')
    .trim()
}

// a short, readable placeholder for a hub connection's name/category label
// before parseHubShortLabel resolves (or if hub.txt has no shortLabel line);
// avoids showing the full hub.txt URL in the track selector category header
export function shortHubLabel(url: string) {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return segments.at(-2) ?? segments.at(-1) ?? url
  } catch {
    return url
  }
}

// A hub's assemblies are added by its connection's `connect()`, so launching a
// view the moment the connection is made leaves the LGV reporting "Assembly X
// not found" until the fetch lands. Wait for the assembly instead — causal on
// both sides: proceed the instant it appears, and stop waiting once every
// connection has settled without producing it, so a &assembly= naming a genome
// the hub doesn't carry still reports itself through the view rather than
// hanging on a region that is never coming.
async function whenHubAssemblyResolves(
  session: AbstractSessionModel,
  assemblyName: string,
) {
  await when(() => {
    if (!isAlive(session)) {
      return true
    }
    if (session.assemblyManager.get(assemblyName)) {
      return true
    }
    return isSessionModelWithConnections(session)
      ? session.connectionInstances.every(c => !c.loading)
      : true
  })
}

// Applies the `&loc=`/`&tracks=`/... shorthand on top of a hub session. The
// loader ranks `&hubURL=` above that shorthand (a hub is the only URL param
// that brings its own assemblies and tracks, so a hand-written URL carrying
// both is asking to navigate *inside* the hub, not to drop it), which leaves
// the navigation for here.
async function launchHubView(
  session: AbstractSessionModel,
  viewInit: Partial<InitState> & { assembly: string },
  pluginManager: PluginManager,
) {
  try {
    await whenHubAssemblyResolves(session, viewInit.assembly)
    if (isAlive(session)) {
      await pluginManager.evaluateAsyncExtensionPointStrict(
        'LaunchView-LinearGenomeView',
        { session, ...viewInit },
      )
    }
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

// load a UCSC hub
export async function loadHubSpec(
  {
    hubURL,
    sessionName,
    viewInit,
  }: {
    hubURL: string[]
    sessionName?: string
    // the loc/assembly/tracks URL shorthand, when the link carried it alongside
    // the hub
    viewInit?: Partial<InitState>
  },
  pluginManager: PluginManager,
) {
  const firstURL = hubURL[0]
  if (!firstURL) {
    return
  }
  const rootModel = pluginManager.rootModel!

  // The launcher resolves everything against an assembly, and a hub's assemblies
  // are genome ids only the hub carries, so `&loc=` with no `&assembly=` has
  // nothing to launch against. Say that rather than dropping the navigation
  // silently — and leave the hub's own defaultPos launch in place, which is the
  // best guess available without a name.
  const { assembly } = viewInit ?? {}
  const launchInit = assembly ? { ...viewInit, assembly } : undefined

  // set the session synchronously so rootModel.session is defined before the
  // first render (the shortLabel-refined name is applied after the fetch
  // below). A deferred setSession would leave JBrowse rendering with no
  // session.
  rootModel.setSession?.({
    name: sessionName ?? firstURL,
    sessionConnections: hubURL.map(r => ({
      type: 'UCSCTrackHubConnection',
      connectionId: r,
      name: shortHubLabel(r),
      hubTxtLocation: {
        uri: r,
        locationType: 'UriLocation',
      },
    })),
  })
  const { session } = rootModel
  if (isWebSessionWithConnections(session)) {
    for (const conn of session.sessionConnections) {
      // silent when we are launching the view ourselves: a single-file hub's
      // doConnect otherwise opens a second LGV at the hub's own defaultPos,
      // competing with the location the link asked for
      session.makeConnection(conn, launchInit ? { silent: true } : undefined)
    }
  }

  try {
    const res = await fetch(firstURL)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${firstURL}`)
    }
    const sessionLabel = parseHubShortLabel(await res.text())

    if (sessionLabel) {
      if (!sessionName && isBaseSession(session)) {
        session.setName(sessionLabel)
      }
      if (isWebSessionWithConnections(session)) {
        session.sessionConnections
          .find(c => c.connectionId === firstURL)
          ?.setSlot('name', sessionLabel)
      }
    }
  } catch (e) {
    console.error(e)
    rootModel.session?.notifyError(`${e}`, e)
  }

  // after the block above, not inside it: a hub.txt that fails to fetch for the
  // session name must not also cost the link its navigation
  if (viewInit && isSessionModelWithConnections(session)) {
    if (launchInit) {
      await launchHubView(session, launchInit, pluginManager)
    } else {
      session.notify(
        '&loc= alongside &hubURL= also needs &assembly=, naming one of the hub genomes; the hub was opened at its own default location.',
        'warning',
      )
    }
  }
}
