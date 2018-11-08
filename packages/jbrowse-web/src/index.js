import { getSnapshot } from 'mobx-state-tree'

import JBrowse from './JBrowse'
import 'typeface-roboto'
import './index.css'

const jbrowse = new JBrowse()

jbrowse.configure()

const { model } = jbrowse
model.addView('linear')
model.views[0].displayRegions([
  {
    assembly: 'volvox',
    ref: 'ctgA',
    start: 0,
    end: 200,
  },
  { assembly: 'volvox', ref: 'ctgB', start: 0, end: 100000000 },
])

model.views[0].showTrack('foo', 'Foo Track', 'tester')
model.views[0].showTrack('bar', 'Bar Track', 'tester')
model.views[0].showTrack('baz', 'Baz Track', 'tester')
model.addView('linear')
model.views[1].showTrack('bee', 'Bee Track', 'tester')
model.views[1].showTrack('bonk', 'Bonk Track', 'tester')
model.views[1].tracks[0].configuration.backgroundColor.set('red')

window.MODEL = model
window.getSnapshot = getSnapshot

jbrowse.start()
