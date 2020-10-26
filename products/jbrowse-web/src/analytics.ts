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
// window.navigator.userAgent (what browser they are using), maybe look for simplier string x
// tzoffset x
// loadtime x
// amt of savedSessions (look for localSaved in their local storage) x

interface AnalyticsObj {
  [key: string]: any
}

interface Track {
  trackId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export async function writeAWSAnalytics(
  rootModel: any,
  url: string,
  initialTimeStamp: number,
) {
  const { session } = rootModel
  const refSeqCount: AnalyticsObj = {}

  //   session.assemblies.forEach((assembly: any, idx: number) => {
  //     const value = rootModel.assemblyManager.get(assembly)
  //     const index = `assembly${idx}`
  //     refSeqCount[index] = value
  //     // refSeqAvgLen[index] = figure this out later
  //   })
  const stats = {
    ver: rootModel.version,
    'refSeq-count': refSeqCount,
    'tracks-count': session.tracks.length,
    plugins: rootModel.jbrowse.plugins
      ? getSnapshot(rootModel.jbrowse.plugins)
      : '',
    'open-views': session.views.length,
    'synteny-tracks-count': session.tracks.filter(
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
    browser: window.navigator.userAgent,

    electron: typeof window !== 'undefined' && Boolean(window.electron),
    loadTime: Date.now() - initialTimeStamp,
  }
  const data = new FormData()
  data.append('stats', JSON.stringify(stats))

  // this is a GET request in JB1, ask if POST is okay
  const response = await fetch(`${url}`, {
    method: 'POST',
    mode: 'cors',
    body: JSON.stringify(stats),
  })

  // have some sort of return that isnt a console.log
  if (response && response.ok) {
    console.log('success')
  }
}

export async function writeGAAnalytics(
  rootModel: any,
  initialTimeStamp: number,
) {
  const jbrowseUser = 'UA-7115575-5'
  const accounts = [jbrowseUser]
  const stats: AnalyticsObj = {
    ver: rootModel.version,
    'tracks-count': rootModel.session.tracks.length, // this is all possible tracks
    plugins: rootModel.jbrowse.plugins
      ? getSnapshot(rootModel.jbrowse.plugins)
      : '',
    browser: window.navigator.userAgent,
    electron: typeof window !== 'undefined' && Boolean(window.electron),
    loadTime: Date.now() - initialTimeStamp,
  }

  // do we need custom GA accounts?
  // if needed,
  // getConf(self, 'googleAnalytics')
  // accounts.push(all accounts in the conf)

  // create script
  let analyticsScript =
    "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){ "
  analyticsScript +=
    '(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o), '
  analyticsScript +=
    'm=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m) '
  analyticsScript +=
    "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');"
  // for each acc? add pageview + custom variable
  accounts.forEach((user, viewerNum) => {
    if (user === jbrowseUser) {
      const gaData: AnalyticsObj = {}
      const googleDimensions =
        'ver tracks-count plugin browser electron loadTime'
      //   const googleMetrics = 'loadTime'

      googleDimensions.split(/\s+/).forEach((key, index) => {
        gaData[`dimension${index + 1}`] = stats[key]
      })

      gaData.metric1 = Math.round(stats.loadTime * 1000)

      analyticsScript += `ga('jbrowseTracker.send', 'pageview',${JSON.stringify(
        gaData,
      )});`
    } else {
      analyticsScript += `ga('customTracker${viewerNum}.send', 'pageview');`
    }
  })

  const analyticsScriptNode = document.createElement('script')
  analyticsScriptNode.innerHTML = analyticsScript

  document.getElementsByTagName('head')[0].appendChild(analyticsScriptNode)
}
