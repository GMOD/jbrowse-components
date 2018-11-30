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
  description:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam aliquet ' +
    'leo sed magna porta, a luctus velit euismod. Suspendisse id nisl ut ' +
    'tellus egestas facilisis vel sit amet nunc. Nulla dolor nunc, feugiat ' +
    'ac auctor eu, lacinia in dui. Phasellus sed magna consectetur, mattis ' +
    'lacus at, porta nisi. Etiam et facilisis augue, ut elementum velit. ' +
    'Maecenas lacinia nulla vitae lacus rhoncus, in pharetra erat fermentum. ' +
    'Nullam ultrices congue neque, vel blandit urna pellentesque quis. ' +
    'Vivamus rutrum purus nunc. Integer et nisi congue, pharetra orci id, ' +
    'vehicula arcu. Integer luctus eros augue. Etiam sed leo turpis. Donec ' +
    'vehicula vehicula velit, in.',
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
model.views[0].showTrack(conf, { height: 200 })
model.addView('LinearGenomeView')
model.views[1].showTrack(conf2, { height: 100 })
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

model.views[0].activateTrackSelector()

window.MODEL = model
window.getSnapshot = getSnapshot

jbrowse.start()
