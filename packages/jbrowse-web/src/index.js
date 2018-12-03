import { getSnapshot } from 'mobx-state-tree'
import 'typeface-roboto'
import JBrowse from './JBrowse'

import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

const jbrowse = new JBrowse()

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()
const workerGroups = webWorkers.register()
jbrowse.addWorkers(workerGroups)

// add the initial configuration
jbrowse.configure({
  tracks: [
    {
      type: 'AlignmentsTrack',
      name: 'Alignments Test',
      category: ['Bar Category', 'Baz Category'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { uri: '/test_data/volvox-sorted.bam' },
        index: { location: { uri: '/test_data/volvox-sorted.bam.bai' } },
      },
    },
    {
      type: 'AlignmentsTrack',
      name: 'Foo Test',
      category: ['Bee Category', 'Boo Category'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { uri: '/test_data/volvox-sorted.bam' },
        index: { location: { uri: '/test_data/volvox-sorted.bam.bai' } },
      },
    },
  ],
})

// poke some things for testing (this stuff will eventually be removed)
const { model } = jbrowse
model.addView('LinearGenomeView')
model.views[0].displayRegions([
  {
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,

    end: 50000,
  },
  { assembly: 'volvox', refName: 'ctgB', start: 0, end: 100000000 },
])

model.views[0].showTrack(model.configuration.tracks[0], { height: 200 })
model.addView('LinearGenomeView')
model.views[1].showTrack(model.configuration.tracks[1], { height: 100 })
model.views[1].displayRegions([
  {
    assembly: 'volvox',
    refName: 'ctgB',
    start: 0,
    end: 200,
  },
  { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
])

model.views[0].activateTrackSelector()

window.MODEL = model
window.getSnapshot = getSnapshot

// finally, start the app
jbrowse.start()
