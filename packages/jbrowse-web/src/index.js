import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
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
  views: {
    LinearGenomeView: {},
  },
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
window.jbrowse = jbrowse
window.MODEL = model
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

const firstView = model.addView('LinearGenomeView')
firstView.displayRegions([
  {
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 50000,
  },
  { assembly: 'volvox', refName: 'ctgB', start: 0, end: 300 },
])

firstView.showTrack(model.configuration.tracks[0], { height: 200 })

const secondView = model.addView('LinearGenomeView')
secondView.showTrack(model.configuration.tracks[1], { height: 100 })
secondView.displayRegions([
  {
    assembly: 'volvox',
    refName: 'ctgB',
    start: 0,
    end: 200,
  },
  { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
])

firstView.activateTrackSelector()

// finally, start the app
jbrowse.start()
