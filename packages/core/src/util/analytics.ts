import { readConfObject } from '../configuration/index.ts'
import { isElectron } from '../util/index.ts'

type AnalyticsObj = Record<string, any>

declare global {
  interface Window {
    dataLayer: unknown[]
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer?.push(args)
}

interface Track {
  type: string
}

export async function writeAWSAnalytics(
  rootModel: any,
  initialTimeStamp: number,
  sessionQuery?: string | null,
) {
  try {
    const url = 'https://analytics.jbrowse.org/api/v1'

    const multiAssemblyTracks = rootModel.jbrowse.tracks.filter(
      (track: any) => (readConfObject(track, 'assemblyNames') || []).length > 1,
    ).length

    const savedSessionCount = Object.keys(localStorage).filter(name =>
      name.includes('localSaved-'),
    ).length

    const { jbrowse: config, session, version: ver } = rootModel
    const { tracks, assemblies, plugins } = config

    const stats: AnalyticsObj = {
      ver,
      'plugins-count': plugins?.length || 0,
      'plugin-names': plugins?.map((p: any) => p.name).join(','),
      'assemblies-count': assemblies.length,
      'tracks-count': tracks.length,
      'session-tracks-count': session?.sessionTracks.length || 0,
      'open-views': session?.views.length || 0,
      'synteny-tracks-count': multiAssemblyTracks,
      'saved-sessions-count': savedSessionCount,
      'existing-session-param-type': sessionQuery?.split('-')[0] || 'none',
      'scn-h': window.screen.height,
      'scn-w': window.screen.width,
      'win-h': window.innerHeight,
      'win-w': window.innerWidth,
      electron: isElectron,
      loadTime: (Date.now() - initialTimeStamp) / 1000,
      jb2: true,
    }

    // eslint-disable-next-line unicorn/no-array-for-each
    tracks.forEach((track: Track) => {
      const key = `track-types-${track.type}`
      stats[key] = stats[key] + 1 || 1
    })

    // eslint-disable-next-line unicorn/no-array-for-each
    session?.sessionTracks.forEach((track: Track) => {
      const key = `sessionTrack-types-${track.type}`
      stats[key] = stats[key] + 1 || 1
    })

    const qs = Object.keys(stats)
      .map(key => `${key}=${stats[key]}`)
      .join('&')

    await fetch(`${url}?${qs}`)
  } catch (e) {
    console.error('Failed to write analytics to AWS.', e)
  }
}

export function setupGA4(measurementIds: string[]) {
  try {
    window.dataLayer = window.dataLayer || []

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementIds[0]}`
    document.head.append(script)

    gtag('js', new Date())
    for (const id of measurementIds) {
      gtag('config', id)
    }
  } catch (e) {
    console.error('Failed to setup GA4', e)
  }
}

export function gtagEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  try {
    gtag('event', eventName, params)
  } catch (e) {
    console.error('Failed to send GA4 event', e)
  }
}

export function doAnalytics(
  rootModel: any,
  initialTimestamp: number,
  initialSessionQuery: string | null | undefined,
) {
  if (
    rootModel &&
    !readConfObject(rootModel.jbrowse.configuration, 'disableAnalytics')
  ) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeAWSAnalytics(rootModel, initialTimestamp, initialSessionQuery)
    setupGA4(['G-MB7C521GCN'])
  }
}
