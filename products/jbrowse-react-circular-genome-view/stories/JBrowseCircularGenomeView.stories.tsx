import { useState } from 'react'

import { JBrowseCircularGenomeView, createViewState } from '../src/index.ts'

const JBrowseCircularGenomeViewStories = {
  title: 'Circular Genome View',
}

export default JBrowseCircularGenomeViewStories

export const Volvox = {
  render: () => {
    const [state] = useState(() =>
      createViewState({
        assembly: {
          name: 'volvox',
          aliases: ['vvx'],
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'TwoBitAdapter',
              uri: 'test_data/volvox/volvox.2bit',
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
              uri: 'test_data/volvox/volvox.dup.vcf.gz',
            },
          },
        ],
        defaultSession: {
          name: 'Storybook',
          view: {
            id: 'circularView',
            type: 'CircularView',
            init: {
              assembly: 'volvox',
              tracks: ['volvox_sv_test'],
            },
          },
        },
      }),
    )
    return <JBrowseCircularGenomeView viewState={state} />
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseCircularGenomeView, createViewState } from '@jbrowse/react-circular-genome-view2'

export const Volvox = () => {
  const [state] = useState(() =>
    createViewState({
      assembly: {
        name: 'volvox',
        aliases: ['vvx'],
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'volvox_refseq',
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'test_data/volvox/volvox.2bit',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'FromConfigAdapter',
            adapterId: 'W6DyPGJ0UU',
            features: [
              { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A', 'contigA'] },
              { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B', 'contigB'] },
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
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
          },
        },
      ],
      defaultSession: {
        name: 'Storybook',
        view: {
          id: 'circularView',
          type: 'CircularView',
          init: {
            assembly: 'volvox',
            tracks: ['volvox_sv_test'],
          },
        },
      },
    }),
  )
  return <JBrowseCircularGenomeView viewState={state} />
}`,
      },
    },
  },
}

export const ShowTrack = {
  render: () => {
    const [state] = useState(() => {
      const s = createViewState({
        assembly: {
          name: 'volvox',
          aliases: ['vvx'],
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'TwoBitAdapter',
              uri: 'test_data/volvox/volvox.2bit',
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
              uri: 'test_data/volvox/volvox.dup.vcf.gz',
            },
          },
        ],
      })
      // open a track imperatively instead of via defaultSession.view.init
      s.session.view.showTrack('volvox_sv_test')
      return s
    })

    return <JBrowseCircularGenomeView viewState={state} />
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseCircularGenomeView, createViewState } from '@jbrowse/react-circular-genome-view2'

export const ShowTrack = () => {
  const [state] = useState(() => {
    const s = createViewState({
      assembly: {
        name: 'volvox',
        aliases: ['vvx'],
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'volvox_refseq',
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'test_data/volvox/volvox.2bit',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'FromConfigAdapter',
            adapterId: 'W6DyPGJ0UU',
            features: [
              { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A', 'contigA'] },
              { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B', 'contigB'] },
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
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
          },
        },
      ],
    })
    // open a track imperatively instead of via defaultSession.view.init
    s.session.view.showTrack('volvox_sv_test')
    return s
  })

  return <JBrowseCircularGenomeView viewState={state} />
}`,
      },
    },
  },
}

const hg19Assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'Pd8Wh30ei9R',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
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
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
    },
  },
]

export const Human = {
  render: () => {
    const [state] = useState(() =>
      createViewState({
        assembly: hg19Assembly,
        tracks: hg19Tracks,
        defaultSession: {
          name: 'this session',
          view: {
            id: 'circularView',
            type: 'CircularView',
            init: {
              assembly: 'hg19',
              tracks: ['pacbio_sv_vcf'],
            },
          },
        },
      }),
    )
    return <JBrowseCircularGenomeView viewState={state} />
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react'
import { JBrowseCircularGenomeView, createViewState } from '@jbrowse/react-circular-genome-view2'

const hg19Assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'Pd8Wh30ei9R',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
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
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
    },
  },
]

export const Human = () => {
  const [state] = useState(() =>
    createViewState({
      assembly: hg19Assembly,
      tracks: hg19Tracks,
      defaultSession: {
        name: 'this session',
        view: {
          id: 'circularView',
          type: 'CircularView',
          init: {
            assembly: 'hg19',
            tracks: ['pacbio_sv_vcf'],
          },
        },
      },
    }),
  )
  return <JBrowseCircularGenomeView viewState={state} />
}`,
      },
    },
  },
}
