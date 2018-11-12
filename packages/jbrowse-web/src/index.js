import { getSnapshot } from 'mobx-state-tree'

import JBrowse from './JBrowse'
import 'typeface-roboto'
import './index.css'

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

model.views[0].showTrack('foo', 'Foo Track', 'AlignmentsTrack')
model.views[0].showTrack('bar', 'Bar Track', 'AlignmentsTrack')
model.views[0].showTrack('baz', 'Baz Track', 'AlignmentsTrack')
model.addView('LinearGenomeView')
model.views[1].showTrack('bee', 'Bee Track', 'AlignmentsTrack')
model.views[1].showTrack('bonk', 'Bonk Track', 'AlignmentsTrack')
model.views[1].tracks[0].configuration.backgroundColor.set('red')

window.MODEL = model
window.getSnapshot = getSnapshot

jbrowse.start()
