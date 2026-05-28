import type PluginManager from '@jbrowse/core/PluginManager'

// the hub.txt shortLabel line, used as a human-readable session name
export function parseHubShortLabel(hubTxt: string) {
  return hubTxt
    .split('\n')
    .find(line => line.startsWith('shortLabel'))
    ?.replace('shortLabel', '')
    .trim()
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
  const rootModel = pluginManager.rootModel!

  // set the session synchronously so rootModel.session is defined before the
  // first render (the shortLabel-refined name is applied after the fetch
  // below). A deferred setSession would leave JBrowse rendering with no
  // session.
  // @ts-expect-error
  rootModel.setSession({
    name: sessionName ?? hubURL[0],
    sessionConnections: hubURL.map(r => ({
      type: 'UCSCTrackHubConnection',
      connectionId: r,
      name: r,
      hubTxtLocation: {
        uri: r,
        locationType: 'UriLocation',
      },
    })),
  })
  const { session } = rootModel
  // @ts-expect-error
  session.makeConnection(session.sessionConnections[0])

  try {
    const res = await fetch(hubURL[0]!)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${hubURL[0]}`)
    }
    const sessionLabel = parseHubShortLabel(await res.text())

    if (!sessionName && sessionLabel) {
      // @ts-expect-error
      session.setName(sessionLabel)
    }
  } catch (e) {
    console.error(e)
    rootModel.session?.notifyError(`${e}`, e)
  }
}
