import { useEffect, useState } from 'react'

// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app2'
import { JBrowseApp, createViewState } from '../../src'

type ViewModel = ReturnType<typeof createViewState>

export const HumanDemo = () => {
  const [viewState, setViewState] = useState<ViewModel>()

  useEffect(() => {
    const state = createViewState({
      config: {
        assemblies: [
          {
            name: 'GRCh38',
            aliases: ['hg38'],
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'GRCh38-ReferenceSequenceTrack',
              adapter: {
                type: 'BgzipFastaAdapter',
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
              },
            },
            refNameAliases: {
              adapter: {
                type: 'RefNameAliasAdapter',
                uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
              },
            },
          },
        ],
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'genes',
            name: 'NCBI RefSeq Genes',
            assemblyNames: ['GRCh38'],
            category: ['Genes'],
            adapter: {
              type: 'Gff3TabixAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
            },
            textSearching: {
              textSearchAdapter: {
                type: 'TrixTextSearchAdapter',
                textSearchAdapterId: 'gff3tabix_genes-index',
                ixFilePath: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
                },
                ixxFilePath: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx',
                },
                metaFilePath: {
                  uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz_meta.json',
                },
                assemblyNames: ['GRCh38'],
              },
            },
          },
          {
            type: 'FeatureTrack',
            trackId: 'repeats_hg38',
            name: 'Repeats',
            assemblyNames: ['hg38'],
            category: ['Annotation'],
            adapter: {
              type: 'BigBedAdapter',
              uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
            },
          },
          {
            type: 'AlignmentsTrack',
            trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            name: 'NA12878 Exome',
            assemblyNames: ['GRCh38'],
            category: ['1000 Genomes', 'Alignments'],
            adapter: {
              type: 'CramAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',

              sequenceAdapter: {
                type: 'BgzipFastaAdapter',
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
              },
            },
          },
          {
            type: 'VariantTrack',
            trackId:
              'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
            name: '1000 Genomes Variant Calls',
            assemblyNames: ['GRCh38'],
            category: ['1000 Genomes', 'Variants'],
            adapter: {
              type: 'VcfTabixAdapter',
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
            },
          },
          {
            type: 'QuantitativeTrack',
            trackId: 'hg38.100way.phyloP100way',
            name: 'hg38.100way.phyloP100way',
            category: ['Conservation'],
            assemblyNames: ['hg38'],
            adapter: {
              type: 'BigWigAdapter',
              uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
            },
          },
        ],
        defaultSession: {
          name: 'Human demo',
          margin: 0,
          views: [
            {
              id: 'linearGenomeView',
              type: 'LinearGenomeView',
              init: {
                loc: '1:100,000-110,000',
                assembly: 'hg38',
                tracks: [
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
                  'hg38.100way.phyloP100way',
                ],
              },
            },
          ],
        },
      },
    })
    setViewState(state)
  }, [])

  if (!viewState) {
    return null
  }

  return (
    <>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/HumanDemo.tsx">
        Source code
      </a>
      <JBrowseApp viewState={viewState} />
    </>
  )
}
