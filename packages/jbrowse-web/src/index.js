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
      name: 'Sequence',
      adapter: {
        type: 'FromConfigAdapter',
        assemblyName: 'grc37 genes',
        features: [
          {
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
    assemblyName: 'grc37 genes',
    refName: 'JAK2',
    start: 0,
    end: 50000,
  },
])

firstView.zoomTo(0.06) // bpPerPx
firstView.showTrack(model.configuration.tracks[0], { height: 110 })

// finally, start the app
jbrowse.start()
