import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import './fonts/material-icons.css'
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
  views: [{ type: 'LinearGenomeView' }],
  tracks: [
    {
      type: 'SequenceTrack',
      name: 'Reference sequence',
      category: ['Bar Category'],
      defaultRendering: 'div',
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: { uri: '/test_data/volvox.2bit' },
        assemblyName: 'volvox',
      },
    },
    {
      type: 'WiggleTrack',
      name: 'Wiggle track',
      category: ['Bar Category'],
      defaultRendering: 'wiggle',
      adapter: {
        type: 'BigWigAdapter',
        twoBitLocation: { uri: '/test_data/volvox.bw' },
      },
    },
    {
      type: 'AlignmentsTrack',
      name: 'volvox-sorted red/blue',
      category: ['Bar Category', 'Baz Category'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { uri: '/test_data/volvox-sorted.bam' },
        index: { location: { uri: '/test_data/volvox-sorted.bam.bai' } },
        assemblyName: 'volvox',
      },
    },
    {
      type: 'AlignmentsTrack',
      name: 'volvox-sorted all green',
      category: ['Bee Category', 'Boo Category'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { uri: '/test_data/volvox-sorted.bam' },
        index: { location: { uri: '/test_data/volvox-sorted.bam.bai' } },
        assemblyName: 'vvx',
      },
      renderers: { PileupRenderer: { alignmentColor: 'green' } },
    },
  ],
  assemblies: {
    volvox: {
      aliases: ['vvx'],
      seqNameAliases: {
        A: ['ctgA', 'contigA'],
        B: ['ctgB', 'contigB'],
      },
    },
  },
})

// poke some things for testing (this stuff will eventually be removed)
const { model } = jbrowse
window.jbrowse = jbrowse
window.MODEL = model
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

model.addMenuBar('MainMenuBar')
model.menuBars[0].unshiftMenu({
  name: 'Admin',
  menuItems: [
    {
      name: 'Download configuration',
      icon: 'get_app',
      callback: 'downloadConfiguration',
    },
  ],
})

const firstView = model.addView('LinearGenomeView')
firstView.displayRegions([
  {
    assemblyName: 'vvx',
    refName: 'contigA',
    start: 0,
    end: 50000,
  },
  { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 300 },
])

firstView.zoomTo(0.06) // bpPerPx
firstView.showTrack(model.configuration.tracks[0], { height: 110 })
firstView.showTrack(model.configuration.tracks[1], { height: 110 })
firstView.showTrack(model.configuration.tracks[2], { height: 200 })

const secondView = model.addView('LinearGenomeView')
secondView.showTrack(model.configuration.tracks[1], { height: 100 })
secondView.displayRegions([
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
  {
    assemblyName: 'volvox',
    refName: 'ctgB',
    start: 0,
    end: 2000,
  },
])

firstView.activateTrackSelector()

// finally, start the app
jbrowse.start()
