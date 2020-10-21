/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSnapshot } from 'mobx-state-tree'

// TODOANALYTICS
// lambda function called jbrowse-analytics needs to be migrated to a recent version of node
// in here, on load trigger lambda function AFTER the session loading logic is complete
// also need a trigger for google analytics
// make google analytics acc, import google analytics here and call in the same logic loop as lambda
// consider a different dynamodb table

// jb1 post object
// var stats = {
//   ver: this.version || 'dev',
//   'refSeqs-count': this.refSeqOrder.length,
//   'refSeqs-avgLen':
//     ! this.refSeqOrder.length
//       ? null
//       : dojof.reduce(
//           dojo.map( this.refSeqOrder,
//                     function(name) {
//                         var ref = this.allRefs[name];
//                         if( !ref )
//                             return 0;
//                         return ref.end - ref.start;
//                     },
//                     this
//                   ),
//           '+'
//       ),
//   'tracks-count': this.config.tracks.length,
//   'plugins': dojof.keys( this.plugins ).sort().join(','),

//   // screen geometry
//   'scn-h': scn ? scn.height : null,
//   'scn-w': scn ? scn.width  : null,
//   // window geometry
//   'win-h':document.body.offsetHeight,
//   'win-w': document.body.offsetWidth,
//   // container geometry
//   'el-h': this.container.offsetHeight,
//   'el-w': this.container.offsetWidth,

//   // time param to prevent caching
//   t: date.getTime()/1000,
//   electron: Util.isElectron(),

//   // also get local time zone offset
//   tzoffset: date.getTimezoneOffset(),

//   loadTime: (date.getTime() - this.startTime)/1000
// };

// in new loader, will be an action
// async postToLambda, and async postToGA
// send post and then put in the after create call

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

interface RefSeq {
  [key: string]: any
}

export async function writeAWSAnalytics(rootModel: any, url: string) {
  const { session } = rootModel
  const date = new Date()

  const refSeqCount: RefSeq = {}

  console.log(rootModel)
  session.assemblies.forEach((assembly: any, idx: number) => {
    const value = rootModel.assemblyManager.get(assembly)
    const index = `assembly${idx}`
    refSeqCount[index] = value
    // refSeqAvgLen[index] = figure this out later
  })
  const stats = {
    ver: rootModel.version,
    'refSeq-count': refSeqCount,
    'refSeq-avgLen': 0, // session.assemblies.reduce(/* reduce to the avg length */),
    'tracks-count': session.tracks.length, // this is all possible tracks
    plugins: rootModel.jbrowse.plugins
      ? getSnapshot(rootModel.jbrowse.plugins)
      : '', // something with the plugin manager, not pluginManager.plugins, most of those are core plugins and always there
    'open-views': session.views.length,

    // screen geometry
    'scn-h': window.screen.height,
    'scn-w': window.screen.width,

    // window geometry
    'win-h': document.body.offsetHeight,
    'win-w': document.body.offsetWidth,

    // dont worry about container geometry

    // time param to prevent caching
    t: date.getTime() / 1000,
    electron: typeof window !== 'undefined' && Boolean(window.electron),
    tzoffset: date.getTimezoneOffset(),
    loadTime: new Date().getTime() - date.getTime() / 1000, // potentially look if react records load times, probably need the date object though
  }
  const data = new FormData()
  data.append('stats', JSON.stringify(stats))

  const response = await fetch(`${url}`, {
    method: 'POST',
    mode: 'cors',
    body: data,
  })

  // current progress, cors work, need to see how to upload the custom doc.dynamoDB() npm package to lambda
  if (response && response.ok) {
    console.log('success')
  }
}

// need to create a script element and write it like in jb1 before calling
// jb1 GA
// phones home to google analytics
// _reportGoogleUsageStats: function( stats ) {
//     var thisB = this;
//     // jbrowse.org account always
//     var jbrowseUser = 'UA-7115575-2'
//     var accounts = [ jbrowseUser ];

//     // add any custom Google Analytics accounts from config (comma-separated or array)
//     if( this.config.googleAnalytics ) {
//         var userAccounts = this.config.googleAnalytics.accounts;
//         if( accounts && ! lang.isArray(userAccounts) ) {
//             userAccounts = userAccounts.replace(/^\s*|\s*$/,'').split(/\s*,\s*/)
//         }
//         accounts.push.apply( accounts, userAccounts );
//     }

//     var analyticsScript = "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){ ";
//     analyticsScript += "(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o), ";
//     analyticsScript += "m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m) ";
//     analyticsScript += "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');";

//     // set up users
//     accounts.forEach(function(user,trackerNum) {
//         // if we're adding jbrowse.org user, also include new dimension references (replacing ga.js custom variables)
//         if ( user == jbrowseUser) {
//             analyticsScript += "ga('create', '"+user+"', 'auto', 'jbrowseTracker');";
//         }
//         else {
//             analyticsScript += "ga('create', '"+user+"', 'auto', 'customTracker"+trackerNum+"');";
//         }
//     });

//     // send pageviews and custom variables
//     accounts.forEach(function(user,viewerNum) {
//         if ( user == jbrowseUser) {
//             var gaData = {};
//             var googleDimensions = 'tracks-count refSeqs-count refSeqs-avgLen ver loadTime electron plugins';
//             var googleMetrics = 'loadTime';

//             googleDimensions.split(/\s+/).forEach( function(key,index) {
//                 gaData['dimension'+(index+1)] = stats[key];
//             });

//             gaData.metric1 = Math.round(stats.loadTime*1000);

//             analyticsScript += "ga('jbrowseTracker.send', 'pageview',"+JSON.stringify(gaData)+");";
//         }
//         else {
//             analyticsScript += "ga('customTracker"+viewerNum+".send', 'pageview');";
//         }
//     });

//     var analyticsScriptNode = document.createElement('script');
//     analyticsScriptNode.innerHTML = analyticsScript;

//     document.getElementsByTagName('head')[0].appendChild(analyticsScriptNode); // important, append the script to the head
// },
export async function writeGAAnalytics() {
  // jbrowse.org account always
  const jbrowseUser = 'UA-7115575-5'
  const accounts = [jbrowseUser]
  const stats: RefSeq = {}
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
      const gaData: RefSeq = {}
      const googleDimensions =
        'tracks-count refSeqs-count refSeqs-avgLen ver loadTime electron plugins'
      const googleMetrics = 'loadTime'

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

  document.getElementsByTagName('head')[0].appendChild(analyticsScriptNode) // important, append the script to the head
  // then append to head
}
