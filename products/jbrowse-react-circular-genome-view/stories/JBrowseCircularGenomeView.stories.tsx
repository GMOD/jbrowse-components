import React from 'react'
import { createViewState, JBrowseCircularGenomeView } from '../src'

export const Volvox = () => {
  const defaultSession = {
    name: 'Storybook',
    view: {
      id: 'circularView',
      type: 'CircularView',
      bpPerPx: 90,
      tracks: [
        {
          id: 'jKuFuWoQr',
          type: 'VariantTrack',
          configuration: 'volvox_sv_test',
          displays: [
            {
              id: 'MASH_aVBnc',
              type: 'ChordVariantDisplay',
              configuration: 'volvox_sv_test-ChordVariantDisplay',
            },
          ],
        },
      ],
      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 50001,
          assemblyName: 'volvox',
        },
        {
          refName: 'ctgB',
          start: 0,
          end: 6079,
          assemblyName: 'volvox',
        },
      ],
    },
  }
  const state = createViewState({
    assembly: {
      name: 'volvox',
      aliases: ['vvx'],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox_refseq',
        metadata: {
          date: '2020-08-20',
        },
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: {
            uri: 'test_data/volvox/volvox.2bit',
            locationType: 'UriLocation',
          },
        },
      },
      refNameAliases: {
        adapter: {
          type: 'FromConfigAdapter',
          adapterId: 'W6DyPGJ0UU',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'alias1',
              aliases: ['A', 'contigA'],
            },
            {
              refName: 'ctgB',
              uniqueId: 'alias2',
              aliases: ['B', 'contigB'],
            },
          ],
        },
      },
    },
    tracks: [
      {
        type: 'VariantTrack',
        trackId: 'volvox_sv_test',
        name: 'volvox structural variant test',
        category: ['VCF'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'test_data/volvox/volvox.dup.vcf.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
    ],
    defaultSession,
  })
  return <JBrowseCircularGenomeView viewState={state} />
}

export const ShowTrack = () => {
  const defaultSession = {
    name: 'Storybook',
    view: {
      id: 'circularView',
      type: 'CircularView',
      bpPerPx: 90,

      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 50001,
          assemblyName: 'volvox',
        },
        {
          refName: 'ctgB',
          start: 0,
          end: 6079,
          assemblyName: 'volvox',
        },
      ],
    },
  }
  const state = createViewState({
    assembly: {
      name: 'volvox',
      aliases: ['vvx'],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox_refseq',
        metadata: {
          date: '2020-08-20',
        },
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: {
            uri: 'test_data/volvox/volvox.2bit',
            locationType: 'UriLocation',
          },
        },
      },
      refNameAliases: {
        adapter: {
          type: 'FromConfigAdapter',
          adapterId: 'W6DyPGJ0UU',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'alias1',
              aliases: ['A', 'contigA'],
            },
            {
              refName: 'ctgB',
              uniqueId: 'alias2',
              aliases: ['B', 'contigB'],
            },
          ],
        },
      },
    },
    tracks: [
      {
        type: 'VariantTrack',
        trackId: 'volvox_sv_test',
        name: 'volvox structural variant test',
        category: ['VCF'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'test_data/volvox/volvox.dup.vcf.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
    ],
    defaultSession,
  })

  state.session.view.showTrack('volvox_sv_test')
  return <JBrowseCircularGenomeView viewState={state} />
}

const hg19Assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'Pd8Wh30ei9R',
    adapter: {
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
        locationType: 'UriLocation',
      },
      faiLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
        locationType: 'UriLocation',
      },
      gziLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
        locationType: 'UriLocation',
      },
    },
  },
}

const hg19Tracks = [
  {
    type: 'VariantTrack',
    trackId: 'pacbio_sv_vcf',
    name: 'HG002 Pacbio SV (VCF)',
    assemblyNames: ['hg19'],
    category: ['GIAB'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    },
  },
]

const hg19DefaultSession = {
  name: 'this session',
  view: {
    id: 'circularView',
    type: 'CircularView',
    bpPerPx: 5000000,
    tracks: [
      {
        id: 'uPdLKHik1',
        type: 'VariantTrack',
        configuration: 'pacbio_sv_vcf',
        displays: [
          {
            id: 'v9QVAR3oaB',
            type: 'ChordVariantDisplay',
            configuration: 'pacbio_sv_vcf-ChordVariantDisplay',
          },
        ],
      },
    ],
  },
}

export const Human = () => {
  const state = createViewState({
    assembly: hg19Assembly,
    tracks: hg19Tracks,
    defaultSession: hg19DefaultSession,
  })
  return <JBrowseCircularGenomeView viewState={state} />
}

const JBrowseCircularGenomeViewStories = {
  title: 'Circular Genome View',
}

export default JBrowseCircularGenomeViewStories
