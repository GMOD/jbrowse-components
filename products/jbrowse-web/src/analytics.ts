// TODOANALYTICS
// lambda function called jbrowse-analytics needs to be migrated to a recent version of node
// in here, on load trigger lambda function AFTER the session loading logic is complete
// also need a trigger for google analytics
// make google analytics acc, import google analytics here and call in the same logic loop as lambda

import { util } from 'chai'

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

export async function writeAWSAnalytics(rootModel: any, url: string) {
  const { session } = rootModel
  const date = new Date()
  const stats = {
    ver: rootModel.version,
    'refSeq-count': session.assemblies.length,
    'refSeq-avgLen': session.assemblies.reduce(/* reduce to the avg length */),
    'tracks-count': session.tracks.length,
    plugins: '', // something with the plugin manager

    // screen geometry

    // time param to prevent caching
    t: date.getTime() / 1000,
    electron: typeof window !== 'undefined' && Boolean(window.electron),
    tzoffset: date.getTimezoneOffset(),
    loadTime: date.getTime() - 0 /* startTime*/ / 1000,
  }
  const data = new FormData()
  data.append('stats', JSON.stringify(stats))

  const response = await fetch(`${url}`, {
    method: 'POST',
    mode: 'cors',
    body: data,
  })

  if (response && response.ok) {
    console.log('success')
  }
}

export async function writeGAAnalytics() {}
