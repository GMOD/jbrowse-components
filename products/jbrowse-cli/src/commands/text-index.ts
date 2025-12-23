import { parseArgs } from 'util'

import { printHelp } from '../utils'
import {
  aggregateIndex,
  indexFileList,
  perTrackIndex,
} from './text-index-utils/index'

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
        'Specific tracks to exclude from indexing, formatted as comma separated trackIds',
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
      default: 'Name,ID',
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
      description: 'Adds gene type to list of excluded types',
      default: 'CDS,exon',
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

  const examples = [
    "# indexes all tracks that it can find in the current directory's config.json",
    '$ jbrowse text-index',
    '',
    "# indexes specific trackIds that it can find in the current directory's config.json",
    '$ jbrowse text-index --tracks=track1,track2,track3',
    '',
    '# indexes all tracks except specific trackIds',
    '$ jbrowse text-index --exclude-tracks=track1,track2,track3',
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
