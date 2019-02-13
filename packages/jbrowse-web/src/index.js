import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import './fonts/material-icons.css'
import 'typeface-roboto'
import JBrowse from './JBrowse'

import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

async function main() {
  const jbrowse = new JBrowse()

  // this is the main process, so start and register our service worker and web workers
  serviceWorker.register()
  const workerGroups = webWorkers.register()
  jbrowse.workerManager.addWorkers(workerGroups)

  // add the initial configuration
  await jbrowse.configure({
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
        type: 'BasicTrack',
        name: 'Wiggle track',
        category: ['Bar Category'],
        renderer: { type: 'WiggleRenderer' },
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: { uri: '/test_data/volvox.bw' },
          assemblyName: 'volvox',
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
      {
        type: 'FilteringTrack',
        name: 'Filter Test',
        renderer: { type: 'SvgFeatureRenderer' },
        filterAttributes: ['type', 'start', 'end'],
        adapter: {
          type: 'FromConfigAdapter',
          assemblyName: 'volvox',
          features: [
            {
              uniqueId: 'one',
              seq_id: 'ctgA',
              start: 100,
              end: 101,
              type: 'foo',
              name: 'Boris',
            },
            {
              uniqueId: 'two',
              seq_id: 'ctgA',
              start: 110,
              end: 111,
              type: 'bar',
              name: 'Theresa',
            },
            {
              uniqueId: 'three',
              seq_id: 'ctgA',
              start: 120,
              end: 121,
              type: 'baz',
              name: 'Nigel',
            },
            {
              uniqueId: 'four',
              seq_id: 'ctgA',
              start: 130,
              end: 131,
              type: 'quux',
              name: 'Geoffray',
            },
          ],
        },
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
}

main()
