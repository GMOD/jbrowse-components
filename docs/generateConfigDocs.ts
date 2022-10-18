/* eslint-disable no-console */
import { extractWithComment } from './util'

function generateConfigDocs() {
  console.log(`---
id: config_reference
title: Config reference
toplevel: true
---`)

  extractWithComment(
    [
      'packages/core/pluggableElementTypes/models/baseTrackConfig.ts',
      'packages/core/pluggableElementTypes/models/baseConnectionConfig.ts',
      'packages/core/pluggableElementTypes/models/baseInternetAccountConfig.ts',
      'packages/core/assemblyManager/assemblyConfigSchema.ts',
      'packages/core/rpc/configSchema.ts',
      'packages/core/data_adapters/CytobandAdapter.ts',
      'plugins/alignments/src/AlignmentsTrack/index.ts',
      'plugins/alignments/src/BamAdapter/configSchema.ts',
      'plugins/alignments/src/CramAdapter/configSchema.ts',
      'plugins/alignments/src/HtsgetBamAdapter/configSchema.ts',
      'plugins/alignments/src/LinearAlignmentsDisplay/models/configSchema.ts',
      'plugins/alignments/src/LinearPileupDisplay/configSchema.ts',
      'plugins/alignments/src/LinearSNPCoverageDisplay/models/configSchema.ts',
      'plugins/alignments/src/PileupRenderer/configSchema.ts',
      'plugins/alignments/src/SNPCoverageAdapter/configSchema.ts',
      'plugins/alignments/src/SNPCoverageRenderer/configSchema.ts',
      'plugins/arc/src/ArcRenderer/configSchema.tsx',
      'plugins/arc/src/LinearArcDisplay/configSchema.tsx',
      'plugins/authentication/src/DropboxOAuthModel/configSchema.ts',
      'plugins/authentication/src/ExternalTokenModel/configSchema.ts',
      'plugins/authentication/src/GoogleDriveOAuthModel/configSchema.ts',
      'plugins/authentication/src/HTTPBasicModel/configSchema.ts',
      'plugins/authentication/src/OAuthModel/configSchema.ts',
      'plugins/bed/src/BedAdapter/configSchema.ts',
      'plugins/bed/src/BedTabixAdapter/configSchema.ts',
      'plugins/bed/src/BigBedAdapter/configSchema.ts',
      'plugins/circular-view/src/BaseChordDisplay/models/baseChordDisplayConfig.ts',
      'plugins/comparative-adapters/src/ChainAdapter/configSchema.ts',
      'plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts',
      'plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts',
      'plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts',
      'plugins/comparative-adapters/src/MashMapAdapter/configSchema.ts',
      'plugins/comparative-adapters/src/PAFAdapter/configSchema.ts',
      'plugins/config/src/FromConfigAdapter/configSchema.ts',
      'plugins/config/src/RefNameAliasAdapter/configSchema.ts',
      'plugins/data-management/src/HierarchicalTrackSelectorWidget/configSchema.ts',
      'plugins/data-management/src/ucsc-trackhub/configSchema.js',
      'plugins/dotplot-view/src/DotplotRenderer/configSchema.ts',
      'plugins/gff3/src/Gff3Adapter/configSchema.ts',
      'plugins/gff3/src/Gff3TabixAdapter/configSchema.ts',
      'plugins/gtf/src/GtfAdapter/configSchema.ts',
      'plugins/hic/src/index.ts',
      'plugins/hic/src/configSchema.ts',
      'plugins/hic/src/HicAdapter/configSchema.ts',
      'plugins/hic/src/HicRenderer/configSchema.ts',
      'plugins/hic/src/LinearHicDisplay/configSchema.ts',
      'plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts',
      'plugins/legacy-jbrowse/src/JBrowse1TextSeachAdapter/configSchema.ts',
      'plugins/legacy-jbrowse/src/NCListAdapter/configSchema.ts',
      'plugins/linear-comparative-view/src/LinearSyntenyRenderer/configSchema.ts',
      'plugins/linear-comparative-view/src/SyntenyTrack/configSchema.ts',
      'plugins/linear-comparative-view/src/LinearComparativeDisplay/index.ts',
      'plugins/linear-genome-view/src/LinearBareDisplay/configSchema.ts',
      'plugins/linear-genome-view/src/LinearBasicDisplay/configSchema.ts',
      'plugins/linear-genome-view/src/BasicTrack/configSchema.ts',
      'plugins/linear-genome-view/src/FeatureTrack/configSchema.ts',
      'plugins/lollipop/src/LinearLollipopDisplay/configSchema.ts',
      'plugins/lollipop/src/LollipopRenderer/configSchema.ts',
      'plugins/protein/src/ProteinReferenceSequenceRenderer/configSchema.js',
      'plugins/rdf/src/SPARQLAdapter/configSchema.ts',
      'plugins/sequence/src/BgzipFastaAdapter/configSchema.ts',
      'plugins/sequence/src/ChromSizesAdapter/configSchema.ts',
      'plugins/sequence/src/DivSequenceRenderer/configSchema.ts',
      'plugins/sequence/src/GCContentAdapter/configSchema.ts',
      'plugins/sequence/src/IndexedFastaAdapter/configSchema.ts',
      'plugins/sequence/src/LinearReferenceSequenceDisplay/configSchema.ts',
      'plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts',
      'plugins/sequence/src/SequenceSearchAdapter/configSchema.ts',
      'plugins/sequence/src/TwoBitAdapter/configSchema.ts',
      'plugins/svg/src/SvgFeatureRenderer/configSchema.ts',
      'plugins/trackhub-registry/src/trackhub-registry/configSchema.ts',
      'plugins/trix/src/TrixTextSearchAdapter/configSchema.ts',
      'plugins/variants/src/VariantTrack/configSchema.ts',
      'plugins/variants/src/LinearVariantDisplay/configSchema.ts',
      'plugins/variants/src/VcfAdapter/configSchema.ts',
      'plugins/variants/src/VcfTabixAdapter/configSchema.ts',
      'plugins/variants/src/StructuralVariantChordRenderer/configSchema.ts',
      'plugins/variants/src/ChordVariantDisplay/models/configSchema.ts',
      'plugins/wiggle/src/BigWigAdapter/configSchema.ts',
      'plugins/wiggle/src/DensityRenderer/configSchema.ts',
      'plugins/wiggle/src/LinePlotRenderer/configSchema.ts',
      'plugins/wiggle/src/LinearWiggleDisplay/models/configSchema.ts',
      'plugins/wiggle/src/MultiDensityRenderer/configSchema.ts',
      'plugins/wiggle/src/MultiQuantitativeTrack/configSchema.ts',
      'plugins/wiggle/src/QuantitativeTrack/configSchema.ts',
      'plugins/wiggle/src/MultiLineRenderer/configSchema.ts',
      'plugins/wiggle/src/MultiLinearWiggleDisplay/models/configSchema.ts',
      'plugins/wiggle/src/MultiRowLineRenderer/configSchema.ts',
      'plugins/wiggle/src/MultiRowXYPlotRenderer/configSchema.ts',
      'plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts',
      'plugins/wiggle/src/MultiXYPlotRenderer/configSchema.ts',
      'plugins/wiggle/src/XYPlotRenderer/configSchema.ts',
      'plugins/wiggle/src/configSchema.ts',
    ],
    obj => {
      if (obj.type === 'baseConfiguration') {
        console.log(`#### derives from: `)
        console.log('\n')
        console.log('```js')
        console.log(obj.node)
        console.log('```')
      } else if (obj.type === 'slot') {
        const name = obj.node
          .split('\n')
          .find(x => x.includes('!slot'))
          ?.replace('* !slot', '')
          .trim()

        console.log(`#### slot: ${name || obj.name}`)
        console.log('\n')
        console.log('\n')
        console.log('```js')
        console.log(obj.node)
        console.log('```')
      } else if (obj.type === 'config') {
        const name = obj.comment
          .split('\n')
          .find(x => x.includes('!config'))
          ?.replace('!config', '')
          .trim()

        const rest = obj.comment
          .split('\n')
          .filter(x => !x.includes('!config'))
          .join('\n')

        console.log(`## ${name || obj.name}`)
        console.log('\n')
        console.log(rest)
        console.log('\n')
      }
    },
  )
}

generateConfigDocs()
