import { parseArgs } from 'node:util'

import {
  defaultAttributesToIndex,
  indexableAdapters,
} from '@jbrowse/text-indexing-core'

import { printHelp } from '../../utils.ts'
import { aggregateIndex, indexFileList, perTrackIndex } from './index.ts'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Show CLI help',
    },
    tracks: {
      type: 'string',
      description:
        'Specific tracks to index, formatted as comma separated trackIds. If unspecified, indexes all available tracks',
    },
    excludeTracks: {
      type: 'string',
      description:
        'Specific tracks to exclude from indexing, formatted as comma separated trackIds. To exclude a track permanently, set metadata.skipTextIndex on it in config.json instead (see Notes)',
    },
    target: {
      type: 'string',
      description:
        'Path to config file in JB2 installation directory to read from.',
    },
    out: { type: 'string', description: 'Synonym for target' },
    attributes: {
      type: 'string',
      description: 'Comma separated list of attributes to index',
      default: defaultAttributesToIndex.join(','),
    },
    assemblies: {
      type: 'string',
      short: 'a',
      description:
        'Specify the assembl(ies) to create an index for. If unspecified, creates an index for each assembly in the config',
    },
    force: {
      type: 'boolean',
      default: false,
      description: 'Overwrite previously existing indexes',
    },
    quiet: {
      type: 'boolean',
      short: 'q',
      default: false,
      description: 'Hide the progress bars',
    },
    perTrack: {
      type: 'boolean',
      default: false,
      description: 'If set, creates an index per track',
    },
    exclude: {
      type: 'string',
      description:
        'Comma separated list of feature types to exclude from indexing',
      default: 'CDS,exon',
    },
    include: {
      type: 'string',
      description:
        'Comma separated list of feature types to index, dropping every other type. Unset by default, which indexes every type --exclude does not name. GFF3 only',
    },
    prefixSize: {
      type: 'string',
      description:
        'Specify the prefix size for the ixx index. We attempt to automatically calculate this, but you can manually specify this too. If many genes have similar gene IDs e.g. Z000000001, Z000000002 the prefix size should be larger so that they get split into different bins',
    },
    file: {
      type: 'string',
      multiple: true,
      description:
        'File or files to index (can be used to create trix indexes for embedded component use cases not using a config.json for example)',
    },
    fileId: {
      type: 'string',
      multiple: true,
      description:
        'Set the trackId used for the indexes generated with the --file argument',
    },
    dryrun: {
      type: 'boolean',
      description:
        'Just print out tracks that will be indexed by the process, without doing any indexing',
    },
  } as const
  const { values: flags } = parseArgs({
    args,
    options,
  })

  const description = 'Make a text-indexing file for any given track(s).'

  const notes =
    'Individual tracks in config.json can be permanently excluded from ' +
    'indexing by setting "metadata": { "skipTextIndex": true } on the track. ' +
    'Such tracks are skipped even when indexing all tracks or a whole ' +
    'assembly, so you do not have to pass --excludeTracks on every run.\n\n' +
    // read off the table rather than restated, because the hand-written version
    // of this sentence outlived GtfTabixAdapter's absence from it
    `Only tracks with an indexable adapter type (${Object.keys(indexableAdapters).sort().join(', ')}) are indexed; ` +
    'tracks with other adapter types are skipped automatically.\n\n' +
    'GTF has no Name/ID attributes, so the default --attributes also match ' +
    'their GTF spellings (gene_name, transcript_name, gene_id, transcript_id).' +
    '\n\n' +
    '--exclude names types not to index; --include names the only types to ' +
    'index. Reach for --include when the file draws from a vocabulary you do ' +
    'not control: an NCBI RefSeq GFF3 uses 115 feature types, 80 of them leaf ' +
    'records with no name to search (a match is labelled with a bare UUID, a ' +
    'cDNA_match with an MD5, every biological_region with the string ' +
    '"biological region"), so a deny list leaks whichever type is added next ' +
    'while the allow list — gene, pseudogene and the transcript types — does ' +
    'not grow. Both may be given: --include admits, --exclude then narrows. ' +
    'Either can also be set per track in config.json as ' +
    'textSearching.indexingFeatureTypesToInclude / ' +
    'indexingFeatureTypesToExclude, which takes precedence over the flag.'

  const examples = [
    "# indexes all tracks that it can find in the current directory's config.json",
    '$ jbrowse text-index',
    '',
    "# indexes specific trackIds that it can find in the current directory's config.json",
    '$ jbrowse text-index --tracks=track1,track2,track3',
    '',
    '# indexes all tracks except specific trackIds',
    '$ jbrowse text-index --excludeTracks=track1,track2,track3',
    '',
    "# indexes all tracks in a directory's config.json or in a specific config file",
    '$ jbrowse text-index --out /path/to/jb2/',
    '',
    '# indexes only a specific assembly, and overwrite what was previously there using force (which is needed if a previous index already existed)',
    '$ jbrowse text-index -a hg19 --force',
    '',
    '# create index for some files for use in @jbrowse/react-linear-genome-view2 or similar',
    '$ jbrowse text-index --file myfile.gff3.gz --file myfile.vcfgz --out indexes',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse text-index [options]',
      options,
    })
    return
  }

  const { perTrack, file } = flags

  if (file) {
    await indexFileList(flags)
  } else if (perTrack) {
    await perTrackIndex(flags)
  } else {
    await aggregateIndex(flags)
  }
}
