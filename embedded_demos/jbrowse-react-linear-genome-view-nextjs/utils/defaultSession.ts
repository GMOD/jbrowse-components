const session = {
  name: 'this session',
  margin: 0,
  view: {
    id: 'linearGenomeView',
    minimized: false,
    type: 'LinearGenomeView',
    offsetPx: 191980240,
    bpPerPx: 0.1554251851851852,
    displayedRegions: [
      {
        refName: '10',
        start: 0,
        end: 133797422,
        reversed: false,
        assemblyName: 'GRCh38',
      },
    ],
    tracks: [
      {
        id: '4aZAiE-A3',
        type: 'ReferenceSequenceTrack',
        configuration: 'GRCh38-ReferenceSequenceTrack',
        minimized: false,
        displays: [
          {
            id: 'AD3gqvG0_6',
            type: 'LinearReferenceSequenceDisplay',
            height: 180,
            configuration:
              'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
            showForward: true,
            showReverse: true,
            showTranslation: true,
          },
        ],
      },
      {
        id: 'T6uhrtY40O',
        type: 'AlignmentsTrack',
        configuration: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
        minimized: false,
        displays: [
          {
            id: 'FinKswChSr',
            type: 'LinearAlignmentsDisplay',
            PileupDisplay: {
              id: 'YAAaF494z',
              type: 'LinearPileupDisplay',
              height: 134,
              configuration: {
                type: 'LinearPileupDisplay',
                displayId:
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay_LinearPileupDisplay_xyz',
              },
              showSoftClipping: false,
              filterBy: {
                flagInclude: 0,
                flagExclude: 1540,
              },
            },
            SNPCoverageDisplay: {
              id: 'VTQ_VGbAVJ',
              type: 'LinearSNPCoverageDisplay',
              height: 45,
              configuration: {
                type: 'LinearSNPCoverageDisplay',
                displayId:
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay_snpcoverage_xyz',
              },
              selectedRendering: '',
              resolution: 1,
              constraints: {},
              filterBy: {
                flagInclude: 0,
                flagExclude: 1540,
              },
            },
            snpCovHeight: 45,
            configuration:
              'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay',
            height: 179,
            lowerPanelType: 'LinearPileupDisplay',
          },
        ],
      },
      {
        id: 'EUnTnpVI6',
        type: 'QuantitativeTrack',
        configuration: 'hg38.100way.phyloP100way',
        minimized: false,
        displays: [
          {
            id: 'mrlawr9Wtg',
            type: 'LinearWiggleDisplay',
            height: 100,
            configuration: 'hg38.100way.phyloP100way-LinearWiggleDisplay',
            selectedRendering: '',
            resolution: 1,
            constraints: {},
          },
        ],
      },
      {
        id: 'Cbnwl72EX',
        type: 'VariantTrack',
        configuration:
          'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
        minimized: false,
        displays: [
          {
            id: 'dvXz01Wf6w',
            type: 'LinearVariantDisplay',
            height: 100,
            configuration:
              'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf-LinearVariantDisplay',
          },
        ],
      },
    ],
    hideHeader: false,
    hideHeaderOverview: false,
    hideNoTracksActive: false,
    trackSelectorType: 'hierarchical',
    trackLabels: 'overlapping',
    showCenterLine: false,
    showCytobandsSetting: true,
    showGridlines: true,
  },
}

export default session
