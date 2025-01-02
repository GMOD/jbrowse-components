import type PluginManager from '@jbrowse/core/PluginManager'

// load a UCSC hub
export async function loadHubSpec(
  {
    hubURL,
    // sessionTracks = [],
  }: {
    hubURL: string[]
    sessionTracks: Record<string, unknown>[]
  },
  pluginManager: PluginManager,
) {
  const rootModel = pluginManager.rootModel!

  try {
    const r = await fetch(hubURL[0]!)
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} fetching ${hubURL[0]}`)
    }
    // const d = await r.text()

    // @ts-expect-error
    rootModel.setSession({
      name: hubURL.join(','),
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
