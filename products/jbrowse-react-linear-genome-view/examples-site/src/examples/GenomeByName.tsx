import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function GenomeByName() {
  const state = useCreateViewState({
    jbrowseHub: 'hg38',
    init: {
      loc: 'BRCA1',
      tracks: [
        'hg38-phyloP100way',
        'hg38-ncbiRefSeqCurated',
        'hg38-cpgIslandExt',
      ],
    },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
