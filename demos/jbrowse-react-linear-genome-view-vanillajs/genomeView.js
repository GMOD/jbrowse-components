/* global JBrowseReactLinearGenomeView React, ReactDOM */
import assembly from './assembly.js'
import tracks from './tracks.js'

const { createViewState, JBrowseLinearGenomeView } =
  JBrowseReactLinearGenomeView

const updates = document.getElementById('update')

const defaultSession = {
  name: 'this session',
  view: {
    id: 'linearGenomeView',
    type: 'LinearGenomeView',
    tracks: [
      {
        id: '7PWx6ki1_',
        type: 'ReferenceSequenceTrack',
        configuration: 'GRCh38-ReferenceSequenceTrack',
        displays: [
          {
            id: 'pa_7lx6FDh',
            type: 'LinearReferenceSequenceDisplay',
            height: 210,
            configuration:
              'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
          },
        ],
      },
      {
        id: 'KHwe41KXk',
        type: 'AlignmentsTrack',
        configuration: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
        displays: [
          {
            id: '_-kwYVczT8',
            type: 'LinearAlignmentsDisplay',
            PileupDisplay: {
              id: '1HTk32IDZJ',
              type: 'LinearPileupDisplay',
              height: 100,
              configuration: {
                type: 'LinearPileupDisplay',
                displayId:
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay_pileup_xyz',
              },
            },
            SNPCoverageDisplay: {
              id: 'ZBXRXmuDrc',
              type: 'LinearSNPCoverageDisplay',
              height: 45,
              configuration: {
                type: 'LinearSNPCoverageDisplay',
                displayId:
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay_snpcoverage_xyz',
              },
            },
            configuration:
              'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay',
            height: 250,
          },
        ],
      },
    ],
  },
}
const state = new createViewState({
  assembly,
  tracks,
  location: '1:100,987,269..100,987,368',
  defaultSession,
  onChange: patch => {
    updates.innerHTML += JSON.stringify(patch) + '\n'
  },
})

function navTo(event) {
  state.session.view.navToLocString(event.target.dataset.location)
}
const buttons = document.getElementsByTagName('button')
for (const button of buttons) {
  if (button.dataset.type === 'gene_button') {
    button.addEventListener('click', navTo)
  }
}

const textArea = document.getElementById('viewstate')
document.getElementById('showviewstate').addEventListener('click', () => {
  textArea.innerHTML = JSON.stringify(state.session.view, undefined, 2)
})

const domContainer = document.getElementById('jbrowse_linear_genome_view')
ReactDOM.render(
  React.createElement(JBrowseLinearGenomeView, { viewState: state }),
  domContainer,
)
