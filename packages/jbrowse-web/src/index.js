import { getSnapshot } from 'mobx-state-tree'
import 'typeface-roboto'
import JBrowse from './JBrowse'

import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

const jbrowse = new JBrowse().configure()

serviceWorker.register()

const workerGroups = webWorkers.register()
jbrowse.addWorkers(workerGroups)

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

const conf = model.configuration.addTrackConf('AlignmentsTrack', {
  name: 'Alignments Test',
  category: ['Bar Category', 'Baz Category'],
  adapter: {
    type: 'BamAdapter',
    bamLocation: { uri: '/test_data/volvox-sorted.bam' },
    index: { location: { uri: '/test_data/volvox-sorted.bam.bai' } },
  },
})
const conf2 = model.configuration.addTrackConf('AlignmentsTrack', {
  name: 'Foo Test',
  category: ['Bee Category', 'Boo Category'],
  adapter: {
    type: 'BamAdapter',
    bamLocation: { uri: '/test_data/volvox-sorted.bam' },
    index: { location: { uri: '/test_data/volvox-sorted.bam.bai' } },
  },
})
// TODO: what tracks are available in a given view? how do we represent that and have it work with a track selector?
model.views[0].showTrack(conf)
model.addView('LinearGenomeView')
model.views[1].showTrack(conf2)
model.views[1].displayRegions([
  {
    assembly: 'volvox',
    refName: 'ctgB',
    start: 0,
    end: 200,
  },
  { assembly: 'volvox', refName: 'ctgA', start: 0, end: 100 },
])

// model.views[1].showTrack('bee', 'Bee Track', 'AlignmentsTrack')
// model.views[1].showTrack('bonk', 'Bonk Track', 'AlignmentsTrack')

model.addDrawerWidget('HierarchicalTrackSelectorDrawerWidget', undefined, {
  view: model.views[0],
})

model.views[0].activateTrackSelector()

window.MODEL = model
window.getSnapshot = getSnapshot

jbrowse.start()
