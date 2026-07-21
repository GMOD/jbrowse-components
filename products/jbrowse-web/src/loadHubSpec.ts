import { isBaseSession } from '@jbrowse/product-core'
import { isWebSessionWithConnections } from '@jbrowse/web-core'

import type PluginManager from '@jbrowse/core/PluginManager'

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

// load a UCSC hub
export async function loadHubSpec(
  {
    hubURL,
    sessionName,
  }: {
    hubURL: string[]
    sessionName?: string
  },
  pluginManager: PluginManager,
) {
  const firstURL = hubURL[0]
  if (!firstURL) {
    return
  }
  const rootModel = pluginManager.rootModel!

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
      session.makeConnection(conn)
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
}
