/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSnapshot } from 'mobx-state-tree'

// TODOANALYTICS
// consider a different dynamodb table

// jb2 object
// version
// # of assemblies, session.assemblies.length
// refSeq-count per assembly, map through assemblies do rootModel.assemblyManager.get(eachAssembly)
// refSeq-Count: {
//     assmelby1: values
//     assembly2: value
// }
// refSeq-avLen is avg length. similar structure to above
// number of views open on session load, session.views.length
// number of open tracks (try to do this one)

// jb2 object
// ver x
// isElectron x
// open-views x
// additional plugins x
// number of tracks in the config x
// number of tracks where assemblyNames > 1 (number of synteny tracks) x
// screen geometry x
// window geometry x
// tzoffset x
// loadtime x
// amt of savedSessions (look for localSaved in their local storage) x
// is from jb2

interface AnalyticsObj {
  [key: string]: any
}

interface Track {
  trackId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export async function writeAWSAnalytics(
  rootModel: any,
  initialTimeStamp: number,
) {
  const url =
    'https://mdvkjocq3e.execute-api.us-east-1.amazonaws.com/default/jbrowse-analytics'

  // stats to be recorded in db
  const stats: AnalyticsObj = {
    ver: rootModel.version,
    'assemblies-count': rootModel.jbrowse.assemblies.length,
    'tracks-count': rootModel.jbrowse.tracks.length,
    plugins: rootModel.jbrowse.plugins
      ? getSnapshot(rootModel.jbrowse.plugins)
      : '',
    'open-views': rootModel?.session?.views.length || undefined,
    'synteny-tracks-count': rootModel.jbrowse.tracks.filter(
      (track: Track) => track.assemblyNames.length > 1,
    ).length,
    'saved-sessions-count': Object.keys(localStorage).filter(name =>
      name.includes('localSaved-'),
    ).length,

    // screen geometry
    'scn-h': window.screen.height,
    'scn-w': window.screen.width,

    // window geometry
    'win-h': document.body.offsetHeight,
    'win-w': document.body.offsetWidth,

    electron: typeof window !== 'undefined' && Boolean(window.electron),
    loadTime: (Date.now() - initialTimeStamp) / 1000,
    jb2: true,
  }

  rootModel.jbrowse.tracks.forEach((track: Track) => {
    stats[`track-types-${track.type}`] =
      stats[`track-types-${track.type}`] + 1 || 1
  })

  // put stats into a query string for get request
  const qs = Object.keys(stats)
    .map(key => `${key}=${stats[key]}`)
    .join('&')

  await fetch(`${url}?${qs}`, {
    method: 'GET',
    mode: 'cors',
  })
}

export async function writeGAAnalytics(
  rootModel: any,
  initialTimeStamp: number,
) {
  const jbrowseUser = 'UA-7115575-5'
  const stats: AnalyticsObj = {
    'tracks-count': rootModel.jbrowse.tracks.length, // this is all possible tracks
    ver: rootModel.version,
    electron: typeof window !== 'undefined' && Boolean(window.electron),
    loadTime: Date.now() - initialTimeStamp,
    plugins: rootModel.jbrowse.plugins
      ? getSnapshot(rootModel.jbrowse.plugins)
      : undefined,
  }

  // create script
  let analyticsScript =
    "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){ "
  analyticsScript +=
    '(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o), '
  analyticsScript +=
    'm=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m) '
  analyticsScript +=
    "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');"
  analyticsScript += `ga('create', '${jbrowseUser}', 'auto', 'jbrowseTracker');`

  const gaData: AnalyticsObj = {}
  const googleDimensions = 'tracks-count ver electron loadTime plugins'

  googleDimensions.split(/\s+/).forEach((key, index) => {
    gaData[`dimension${index + 1}`] = stats[key]
  })

  gaData.metric1 = Math.round(stats.loadTime)

  // analyticsScript += `ga('jbrowseTracker.send', 'pageview',${JSON.stringify(
  //   gaData,
  // )});`
  analyticsScript += "ga('jbrowseTracker.send', 'pageview');"

  const analyticsScriptNode = document.createElement('script')
  analyticsScriptNode.innerHTML = analyticsScript

  document.getElementsByTagName('head')[0].appendChild(analyticsScriptNode)
}
