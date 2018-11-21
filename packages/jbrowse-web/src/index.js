import { getSnapshot } from 'mobx-state-tree'
import 'typeface-roboto'
import JBrowse from './JBrowse'

const jbrowse = new JBrowse()

jbrowse.configure()

const { model } = jbrowse
model.addView('LinearGenomeView')
model.views[0].displayRegions([
  {
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 200,
  },
  { assembly: 'volvox', refName: 'ctgB', start: 0, end: 100000000 },
])

const conf = model.configuration.addTrackConf('AlignmentsTrack', {
  name: 'Foo Track',
})
model.views[0].showTrack(conf)
// model.views[0].showTrack('foo', 'Foo Track', 'AlignmentsTrack')
// model.views[0].showTrack('bar', 'Bar Track', 'AlignmentsTrack')
// model.views[0].showTrack('baz', 'Baz Track', 'AlignmentsTrack')
// model.addView('LinearGenomeView')
// model.views[1].showTrack('bee', 'Bee Track', 'AlignmentsTrack')
// model.views[1].showTrack('bonk', 'Bonk Track', 'AlignmentsTrack')

model.addDrawerWidget('HierarchicalTrackSelectorDrawerWidget')

window.MODEL = model
window.getSnapshot = getSnapshot

jbrowse.start()
