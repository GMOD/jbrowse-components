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
      type: 'BasicTrack',
      name: 'Sequence',
      renderer: { type: 'DivSequenceRenderer' },
      adapter: {
        type: 'FromConfigAdapter',
        assemblyName: 'grc37 proteins',
        features: [
          {
            uniqueId: 'protein_seq',
            seq_id: 'JAK2',
            start: 0,
            end: 1132,
            seq: `
            MGMACLTMTEMEGTSTSSIYQNGDISGNANSMKQIDPVLQVYLYHSLGKSEADYLTFPSG
            EYVAEEICIAASKACGITPVYHNMFALMSETERIWYPPNHVFHIDESTRHNVLYRIRFYF
            PRWYCSGSNRAYRHGISRGAEAPLLDDFVMSYLFAQWRHDFVHGWIKVPVTHETQEECLG
            MAVLDMMRIAKENDQTPLAIYNSISYKTFLPKCIRAKIQDYHILTRKRIRYRFRRFIQQF
            SQCKATARNLKLKYLINLETLQSAFYTEKFEVKEPGSGPSGEEIFATIIITGNGGIQWSR
            GKHKESETLTEQDLQLYCDFPNIIDVSIKQANQEGSNESRVVTIHKQDGKNLEIELSSLR
            EALSFVSLIDGYYRLTADAHHYLCKEVAPPAVLENIQSNCHGPISMDFAISKLKKAGNQT
            GLYVLRCSPKDFNKYFLTFAVERENVIEYKHCLITKNENEEYNLSGTKKNFSSLKDLLNC
            YQMETVRSDNIIFQFTKCCPPKPKDKSNLLVFRTNGVSDVPTSPTLQRPTHMNQMVFHKI
            RNEDLIFNESLGQGTFTKIFKGVRREVGDYGQLHETEVLLKVLDKAHRNYSESFFEAASM
            MSKLSHKHLVLNYGVCVCGDENILVQEFVKFGSLDTYLKKNKNCINILWKLEVAKQLAWA
            MHFLEENTLIHGNVCAKNILLIREEDRKTGNPPFIKLSDPGISITVLPKDILQERIPWVP
            PECIENPKNLNLATDKWSFGTTLWEICSGGDKPLSALDSQRKLQFYEDRHQLPAPKWAEL
            ANLINNCMDYEPDFRPSFRAIIRDLNSLFTPDYELLTENDMLPNMRIGALGFSGAFEDRD
            PTQFEERHLKFLQQLGKGNFGSVEMCRYDPLQDNTGEVVAVKKLQHSTEEHLRDFEREIE
            ILKSLQHDNIVKYKGVCYSAGRRNLKLIMEYLPYGSLRDYLQKHKERIDHIKLLQYTSQI
            CKGMEYLGTKRYIHRDLATRNILVENENRVKIGDFGLTKVLPQDKEYYKVKEPGESPIFW
            YAPESLTESKFSVASDVWSFGVVLYELFTYIEKSKSPPAEFMRMIGNDKQGQMIVFHLIE
            LLKNNGRLPRPDGCPDEIYMIMTECWNNNVNQRPSFRDLALRVDQIRDNMAG`.replace(
              /\s/g,
              '',
            ),
          },
        ],
      },
    },
    {
      type: 'FilteringTrack',
      name: 'Variants',
      renderer: { type: 'SvgFeatureRenderer' },
      adapter: {
        type: 'FromConfigAdapter',
        assemblyName: 'grc37 proteins',
        features: [
          {
            uniqueId: 'one',
            seq_id: 'JAK2',
            start: 100,
            end: 101,
            type: 'zonk',
          },
          {
            uniqueId: 'two',
            seq_id: 'JAK2',
            start: 110,
            end: 111,
            type: 'zee',
          },
          {
            uniqueId: 'three',
            seq_id: 'JAK2',
            start: 120,
            end: 121,
            type: 'ziz',
          },
          {
            uniqueId: 'four',
            seq_id: 'JAK2',
            start: 130,
            end: 131,
            type: 'zoz',
          },
          {
            uniqueId: 'five',
            seq_id: 'JAK2',
            start: 140,
            end: 141,
            type: 'nee',
          },
          {
            uniqueId: 'six',
            seq_id: 'JAK2',
            start: 100,
            end: 101,
            type: 'noo',
          },
        ],
      },
    },
  ],
  assemblies: {
    'grc37 proteins': {
      sequenceType: 'protein',
    },
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
    assemblyName: 'grc37 proteins',
    refName: 'JAK2',
    start: 0,
    end: 50000,
  },
])

firstView.zoomTo(0.06) // bpPerPx
firstView.horizontalScroll(-6500)
firstView.showTrack(model.configuration.tracks[1], { height: 110 })

// finally, start the app
jbrowse.start()
