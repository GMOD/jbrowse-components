import type PluginManager from '@jbrowse/core/PluginManager'

// load a UCSC hub
export async function loadHubSpec(
  {
    hubURL,
    sessionName,
    // sessionTracks = [],
  }: {
    hubURL: string[]
    sessionTracks: Record<string, unknown>[]
    sessionName?: string
  },
  pluginManager: PluginManager,
) {
  const rootModel = pluginManager.rootModel!

  try {
    const res = await fetch(hubURL[0]!)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${hubURL[0]}`)
    }
    const d = await res.text()
    const sessionLabel = d
      .split('\n')
      .find(d => d.startsWith('shortLabel'))
      ?.replace('shortLabel', '')
      .trim()

    // @ts-expect-error
    rootModel.setSession({
      name: sessionName ?? sessionLabel ?? hubURL[0],
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
  } catch (e) {
    console.error(e)
    rootModel.session?.notifyError(`${e}`, e)
  }
}
