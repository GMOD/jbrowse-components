---
title: Command line tools
id: cli
toplevel: true
---

This document covers the CLI tools. Note: for @jbrowse/img static export tool,
see https://www.npmjs.com/package/@jbrowse/img

Note: the @jbrowse/cli may not do all types of operations, some use cases may
best be handled by creating your own tools to manipulate a config.json by hand
or by using a script file.

A simple script that does not use @jbrowse/cli at all may just look like this

```
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
// do something with config.tracks, config.assemblies, etc.
fs.writeFileSync('config.json', JSON.stringify(config, null, 2))
```

## Installation

The command line tools can be installed globally using `npm` as follows

```bash
$ npm install -g @jbrowse/cli
```

A CLI tool called `jbrowse` should then be available in the path. You can test
your installation with

```bash
$ jbrowse --version
```

It is also possible to do one-off executions using npx, e.g.

```bash
npx @jbrowse/cli create myfolder
```

It is likely preferable in most cases to install the tools globally with
`npm install @jbrowse/cli -g` however

```

JBrowse CLI

USAGE
  $ jbrowse <command> [options]

COMMANDS
  create               Downloads and installs the latest JBrowse 2 release
  add-assembly         Add an assembly to a JBrowse 2 configuration
  add-track            Add a track to a JBrowse 2 configuration
  text-index           Make a text-indexing file for any given track(s)
  admin-server         Start up a small admin server for JBrowse configuration
  upgrade              Upgrades JBrowse 2 to latest version
  make-pif             Creates pairwise indexed PAF (PIF), with bgzip and tabix
  sort-gff             Helper utility to sort GFF files for tabix
  sort-bed             Helper utility to sort BED files for tabix
  add-connection       Add a connection to a JBrowse 2 configuration
  add-track-json       Add a track configuration directly from a JSON hunk
  remove-track         Remove a track configuration from a JBrowse 2 configuration
  set-default-session  Set a default session with views and tracks

OPTIONS
  -h, --help     Show help
  -v, --version  Show version

Use "jbrowse <command> --help" for more information about a command.

```


## jbrowse create

```
Downloads and installs the latest JBrowse 2 release

Usage: jbrowse create [localPath] [options]

Options:
  -h, --help                 Show help

  -f, --force                Overwrites existing JBrowse 2 installation if
                             present in path

  -l, --listVersions         Lists out all versions of JBrowse 2

      --branch               Download a development build from a named git
                             branch

      --nightly              Download the latest development build from the main
                             branch

  -u, --url                  A direct URL to a JBrowse 2 release

  -t, --tag                  Version of JBrowse 2 to install. Format is v1.0.0.
                             Defaults to latest

Examples:

# Download latest release from github, and put in specific path
$ jbrowse create /path/to/new/installation

# Download latest release from github and force overwrite existing contents at path
$ jbrowse create /path/to/new/installation --force

# Download latest release from a specific URL
$ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip

# Download a specific tag from github
$ jbrowse create /path/to/new/installation --tag v1.0.0

# List available versions
$ jbrowse create --listVersions
```


## jbrowse add-assembly

```
Add an assembly to a JBrowse 2 configuration

Usage: jbrowse add-assembly <sequence> [options]

Options:
  -t, --type                 type of sequence, by default inferred from sequence
                             file

                             indexedFasta - An index FASTA (e.g. .fa or .fasta)
                             file; can optionally specify --faiLocation

                             bgzipFasta - A block-gzipped and indexed FASTA
                             (e.g. .fa.gz or .fasta.gz) file; can optionally
                             specify --faiLocation and/or --gziLocation

                             twoBit - A twoBit (e.g. .2bit) file

                             chromSizes - A chromosome sizes (e.g. .chrom.sizes)
                             file

                             custom - Either a JSON file location or inline JSON
                             that defines a custom sequence adapter; must
                             provide --name if using inline JSON [choices:
                             indexedFasta, bgzipFasta, twoBit, chromSizes,
                             custom]

  -n, --name                 Name of the assembly; if not specified, will be
                             guessed using the sequence file name

  -a, --alias                An alias for the assembly name (e.g. "hg38" if the
                             name of the assembly is "GRCh38"); can be specified
                             multiple times

      --displayName          The display name to specify for the assembly, e.g.
                             "Homo sapiens (hg38)" while the name can be a
                             shorter identifier like "hg38"

      --faiLocation          [default: <fastaLocation>.fai] FASTA index file or
                             URL

      --gziLocation          [default: <fastaLocation>.gzi] FASTA gzip index
                             file or URL

      --refNameAliases       Reference sequence name aliases file or URL;
                             assumed to be a tab-separated aliases file unless
                             --refNameAliasesType is specified

      --refNameAliasesType   Type of aliases defined by --refNameAliases; if
                             "custom", --refNameAliases is either a JSON file
                             location or inline JSON that defines a custom
                             sequence adapter [choices: aliases, custom]

      --refNameColors        A comma-separated list of color strings for the
                             reference sequence names; will cycle through colors
                             if there are fewer colors than sequences

      --target               path to config file in JB2 installation directory
                             to write out to. Creates ./config.json if
                             nonexistent

      --out                  synonym for target

  -h, --help                 Display help for command

  -l, --load                 Required flag when using a local file. Choose how
                             to manage the data directory. Copy, symlink, or
                             move the data directory to the JBrowse directory.
                             Or use inPlace to modify the config without doing
                             any file operations [choices: copy, symlink, move,
                             inPlace]

  -f, --force                Overwrite existing assembly and skip file existence
                             checks

Examples:

# add assembly to installation in current directory. assumes .fai file also exists, and copies GRCh38.fa and GRCh38.fa.fai to current directory
$ jbrowse add-assembly GRCh38.fa --load copy

# add assembly to a specific jb2 installation path using --out, and copies the .fa and .fa.fai file to /path/to/jb2
$ jbrowse add-assembly GRCh38.fa --out /path/to/jb2/ --load copy

# force indexedFasta for add-assembly without relying on file extension
$ jbrowse add-assembly GRCh38.xyz --type indexedFasta --load copy

# add displayName for an assembly
$ jbrowse add-assembly myFile.fa.gz --name hg38 --displayName "Homo sapiens (hg38)"

# use chrom.sizes file for assembly instead of a fasta file
$ jbrowse add-assembly GRCh38.chrom.sizes --load inPlace

# add assembly from preconfigured json file, expert option
$ jbrowse add-assembly GRCh38.config.json --load copy

# add assembly from a 2bit file, also note pointing direct to a URL so no --load flag needed
$ jbrowse add-assembly https://example.com/data/sample.2bit

# add a bgzip indexed fasta inferred by fa.gz extension. assumes .fa.gz.gzi and .fa.gz.fai files also exists
$ jbrowse add-assembly myfile.fa.gz --load copy
```


## jbrowse add-track

```
Add a track to a JBrowse 2 configuration

Usage: jbrowse add-track <track> [options]

Options:
  -h, --help                 Show help

  -t, --trackType            Type of track, by default inferred from track file

      --adapterType          Adapter type, by default inferred from track file

  -n, --name                 Name of the track. Will be defaulted to the trackId
                             if none specified

      --indexFile            Optional index file for the track

  -d, --description          Optional description of the track

  -a, --assemblyNames        Assembly name or names for track as comma separated
                             string. For pairwise synteny tracks the order is
                             query,target (reverse of minimap2/nucmer argument
                             order); for all-vs-all adapters
                             (AllVsAllPAFAdapter/AllVsAllIndexedPAFAdapter) list
                             every assembly the file covers, in any order

      --category             Optional comma separated string of categories to
                             group tracks

      --config               Any extra config settings to add to a track

      --color                Track color: a plain CSS color or a jexl callback.
                             Merged into displayDefaults

      --height               Track display height in pixels. Merged into
                             displayDefaults

      --displayDefaults      Inline JSON merged into the track displayDefaults
                             (labels, mouseover, jexlFilters, etc.)

      --multiwig             Build a MultiQuantitativeTrack from several BigWigs
                             (in place of the positional track arg): a
                             comma-separated list of BigWig files/URLs, or a
                             .json file holding an array of BigWig locations or
                             subadapter objects, each with its own name/color

      --target               Path to config file in JB2 installation to write
                             out to

      --out                  Synonym for target

      --subDir               When using --load a file, output to a subdirectory
                             of the target dir

      --trackId              trackId for the track, by default inferred from
                             filename

  -l, --load                 How to manage the track file relative to
                             config.json. Required for local files, omit for
                             URLs [choices: copy, symlink, move, inPlace]

  -f, --force                Overwrite existing track and any existing files

      --protocol             Force protocol to a specific value

      --bed1                 Used only for mcscan anchors/simpleAnchors types

      --bed2                 Used only for mcscan anchors/simpleAnchors types

Notes:

--load controls how the data file is placed relative to config.json: copy, move,
or symlink it into the install directory, or inPlace to reference a pre-staged
local file where it already sits. Omit --load entirely for URLs. The matching
index (.bai/.csi/.tbi/.fai) is inferred from the data file name; pass
--indexFile when it differs.

--config takes inline JSON (not a file path) that is merged into the generated
track config, so you can set fields the dedicated flags do not cover, e.g.
--config '{"metadata":{"skipTextIndex":true}}' to exclude the track from jbrowse
text-index.

--color and --height set the two most common appearance settings without writing
JSON. Wrap the value in single quotes and use double quotes inside a jexl
callback so nothing needs escaping, e.g. --color
'jexl:feature.strand==1?"blue":"red"'. --displayDefaults takes inline JSON for
any other appearance setting (labels, mouseover, jexlFilters).

--multiwig bundles several BigWigs into one MultiQuantitativeTrack, in place of
the positional track argument: pass a comma-separated list of BigWig files/URLs,
or a .json file with an array of BigWig locations or subadapter objects (each
carrying its own name/color/group). With --load, local list entries are copied
like any other track file.

For pairwise synteny adapters (PAF/Delta/Chain) --assemblyNames is query,target
— the reverse of the minimap2/nucmer input order. For the all-vs-all adapters
(AllVsAllPAFAdapter, AllVsAllIndexedPAFAdapter) it is instead the full list of
assemblies the file covers, in any order, since one all-vs-all file backs every
pair.

Examples:

# copy /path/to/my.bam and /path/to/my.bam.bai to current directory and adds track to config.json
$ jbrowse add-track /path/to/my.bam --load copy

# copy my.bam and my.bam.bai to /path/to/jb2/bam and adds track entry to /path/to/jb2/bam/config.json
$ jbrowse add-track my.bam --load copy --out /path/to/jb2 --subDir bam

# same as above, but specify path to bai file. needed for if the bai file does not have the extension .bam.bai
$ jbrowse add-track my.bam --indexFile my.bai --load copy

# creates symlink for /path/to/my.bam and adds track to config.json
$ jbrowse add-track /path/to/my.bam --load symlink

# add track from URL to config.json, no --load flag needed
$ jbrowse add-track https://mywebsite.com/my.bam

# --load inPlace adds a track without doing file operations
$ jbrowse add-track /url/relative/path.bam --load inPlace

# color a track by strand and set its height (no escaping: single-quote the value, double-quote inside the jexl)
$ jbrowse add-track genes.gff3.gz --load copy --color 'jexl:feature.strand==1?"blue":"red"' --height 200

# bundle several BigWigs into one MultiQuantitativeTrack (no positional track arg)
$ jbrowse add-track --multiwig a.bw,b.bw,c.bw --load copy --name "Coverage"

# ...or from a sources.json carrying per-row name/color for each BigWig
$ jbrowse add-track --multiwig sources.json --name "CATlas ATAC"
```


## jbrowse text-index

```
Make a text-indexing file for any given track(s).

Usage: jbrowse text-index [options]

Options:
  -h, --help                 Show CLI help

      --tracks               Specific tracks to index, formatted as comma
                             separated trackIds. If unspecified, indexes all
                             available tracks

      --excludeTracks        Specific tracks to exclude from indexing, formatted
                             as comma separated trackIds. To exclude a track
                             permanently, set metadata.skipTextIndex on it in
                             config.json instead (see Notes)

      --target               Path to config file in JB2 installation directory
                             to read from.

      --out                  Synonym for target

      --attributes           Comma separated list of attributes to index
                             [default: Name,ID,symbol]

  -a, --assemblies           Specify the assembl(ies) to create an index for. If
                             unspecified, creates an index for each assembly in
                             the config

      --force                Overwrite previously existing indexes [default:
                             false]

  -q, --quiet                Hide the progress bars [default: false]

      --perTrack             If set, creates an index per track [default: false]

      --exclude              Comma separated list of feature types to exclude
                             from indexing [default: CDS,exon]

      --prefixSize           Specify the prefix size for the ixx index. We
                             attempt to automatically calculate this, but you
                             can manually specify this too. If many genes have
                             similar gene IDs e.g. Z000000001, Z000000002 the
                             prefix size should be larger so that they get split
                             into different bins

      --file                 File or files to index (can be used to create trix
                             indexes for embedded component use cases not using
                             a config.json for example)

      --fileId               Set the trackId used for the indexes generated with
                             the --file argument

      --dryrun               Just print out tracks that will be indexed by the
                             process, without doing any indexing

Notes:

Individual tracks in config.json can be permanently excluded from indexing by
setting "metadata": { "skipTextIndex": true } on the track. Such tracks are
skipped even when indexing all tracks or a whole assembly, so you do not have to
pass --excludeTracks on every run.

Only tracks with an indexable adapter type (e.g. Gff3TabixAdapter,
VcfTabixAdapter) are indexed; tracks with other adapter types are skipped
automatically.

Examples:

# indexes all tracks that it can find in the current directory's config.json
$ jbrowse text-index

# indexes specific trackIds that it can find in the current directory's config.json
$ jbrowse text-index --tracks=track1,track2,track3

# indexes all tracks except specific trackIds
$ jbrowse text-index --excludeTracks=track1,track2,track3

# indexes all tracks in a directory's config.json or in a specific config file
$ jbrowse text-index --out /path/to/jb2/

# indexes only a specific assembly, and overwrite what was previously there using force (which is needed if a previous index already existed)
$ jbrowse text-index -a hg19 --force

# create index for some files for use in @jbrowse/react-linear-genome-view2 or similar
$ jbrowse text-index --file myfile.gff3.gz --file myfile.vcfgz --out indexes
```


## jbrowse admin-server

```
Start up a small admin server for JBrowse configuration

Usage: jbrowse admin-server [options]

Options:
  -h, --help                 Show help

  -p, --port                 Specified port to start the server on (default:
                             9090)

      --root                 Path to the root of the JB2 installation

      --bodySizeLimit        Size limit of the update message (default: 25mb)

Notes:

The admin-server lets a browser session write changes back to config.json on
disk, authorized by a one-time key printed in the startup URL. It is meant for
local configuration only: run it on a trusted machine and do not expose the port
to untrusted networks or the public internet.

Examples:

# start the admin server for the JBrowse install in the current directory
$ jbrowse admin-server

# start on a specific port
$ jbrowse admin-server -p 8888

# point at a specific JBrowse installation directory
$ jbrowse admin-server --root /path/to/jb2/

# raise the body size limit for very large config updates
$ jbrowse admin-server --bodySizeLimit 100mb
```


## jbrowse upgrade

```
Upgrades JBrowse 2 to latest version

Usage: jbrowse upgrade [localPath] [options]

Options:
  -h, --help                 Display help for command

  -l, --listVersions         Lists out all versions of JBrowse 2

  -t, --tag                  Version of JBrowse 2 to install. Format is v1.0.0.
                             Defaults to latest

      --branch               Download a development build from a named git
                             branch

      --nightly              Download the latest development build from the main
                             branch

      --clean                Removes old js,map,and LICENSE files in the
                             installation

  -u, --url                  A direct URL to a JBrowse 2 release

Examples:

# Upgrades current directory to latest jbrowse release
$ jbrowse upgrade

# Upgrade jbrowse instance at a specific filesystem path
$ jbrowse upgrade /path/to/jbrowse2/installation

# Upgrade to a specific tag
$ jbrowse upgrade /path/to/jbrowse2/installation --tag v1.0.0

# List versions available on github
$ jbrowse upgrade --listVersions

# Upgrade from a specific URL
$ jbrowse upgrade --url https://sample.com/jbrowse2.zip

# Get nightly release from main branch
$ jbrowse upgrade --nightly
```


## jbrowse make-pif

```
creates pairwise indexed PAF (PIF), with bgzip and tabix

Usage: jbrowse make-pif <file> [options]

Options:
  -h, --help                 Show help

      --out                  Where to write the output file. will write
                             ${file}.pif.gz and ${file}.pif.gz.tbi

      --csi                  Create a CSI index for the PIF file instead of TBI

      --coarse               Minimum insertion/deletion length (bp) at which a
                             coarse-tier row is split into multiple pieces so
                             each row stays tight — 0 emits an unsplit coarse
                             tier. Defaults to 10000. The no-CIGAR coarse tier
                             (prefix T/Q) is emitted alongside the per-row CIGAR
                             fine tier by default so whole-genome synteny views
                             can auto-switch to it; pass --no-coarse to omit it.

      --no-coarse            Do not emit the coarse no-CIGAR tier; write only
                             the per-row CIGAR fine tier.

Notes:

Use --csi for assemblies containing sequences longer than ~512 Mb. The default
TBI index cannot address coordinates beyond 2^29 (~536 Mb), so a CSI index is
required for large chromosomes (e.g. some plant and amphibian genomes). Requires
sh, sort, bgzip, and tabix on the PATH.

Examples:

# creates input.pif.gz and input.pif.gz.tbi in the same directory
$ jbrowse make-pif input.paf

# specify the output file, also creates output.pif.gz.tbi
$ jbrowse make-pif input.paf --out output.pif.gz

# use a CSI index for assemblies with chromosomes longer than ~512 Mb
$ jbrowse make-pif input.paf --csi

# emit an unsplit coarse tier (alongside the fine tier)
$ jbrowse make-pif input.paf --coarse 0

# emit only the per-row CIGAR fine tier, skipping the coarse tier
$ jbrowse make-pif input.paf --no-coarse
```


## jbrowse sort-gff

```
Helper utility to sort GFF (and GTF, which shares the same refname/start column
layout) files for tabix. Moves all lines starting with # to the top of the file,
and sort by refname and start position using unix utilities sort and grep

Usage: jbrowse sort-gff [file] [options]

Options:
  -h, --help                 Show help

Examples:

# sort gff and pipe to bgzip
$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz
$ tabix sorted.gff.gz

# sort gff from stdin
$ cat input.gff | jbrowse sort-gff | bgzip > sorted.gff.gz

# also works on GTF
$ jbrowse sort-gff input.gtf | bgzip > sorted.gtf.gz
$ tabix -p gff sorted.gtf.gz
```


## jbrowse sort-bed

```
Helper utility to sort BED files for tabix. Moves all lines starting with # to
the top of the file, and sort by refname and start position using unix utilities
sort and grep

Usage: jbrowse sort-bed [file] [options]

Options:
  -h, --help                 Show help

Examples:

# sort bed and pipe to bgzip
$ jbrowse sort-bed input.bed | bgzip > sorted.bed.gz
$ tabix sorted.bed.gz

# OR pipe data via stdin: cat file.bed | jbrowse sort-bed | bgzip > sorted.bed.gz
```


## jbrowse add-connection

```
Add a connection to a JBrowse 2 configuration

Usage: jbrowse add-connection <connectionUrlOrPath> [options]

Options:
  -h, --help                 Show help

  -t, --type                 Type of connection (e.g. JBrowse1Connection,
                             UCSCTrackHubConnection, custom)

  -a, --assemblyNames        For UCSC: optional comma separated list of assembly
                             names to filter. For JBrowse1: a single assembly
                             name

  -c, --config               Extra config settings to add to connection in JSON
                             object format

      --connectionId         Id for the connection that must be unique to
                             JBrowse

  -n, --name                 Name of the connection. Defaults to connectionId if
                             not provided

      --target               Path to config file in JB2 installation directory
                             to write out to

      --out                  Synonym for target

  -f, --force                Overwrite existing connection if one with the same
                             id exists

Examples:

# add a JBrowse 1 data directory connection (type inferred from the jbrowse/data path)
$ jbrowse add-connection https://mysite.com/jbrowse/data/ -a hg19

# force the JBrowse1Connection type for a non-standard data folder path
$ jbrowse add-connection https://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection -a hg38

# add a UCSC track hub (type inferred from the hub.txt filename)
$ jbrowse add-connection https://mysite.com/path/to/hub.txt

# force the UCSCTrackHubConnection type for a hub file not named hub.txt
$ jbrowse add-connection https://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection

# add a custom connection type with extra config
$ jbrowse add-connection https://mysite.com/path/to/custom --type custom --config '{"uri":{"url":"https://mysite.com/path/to/custom"}, "locationType": "UriLocation"}' -a hg19

# set an explicit id/name and write to a specific config file
$ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target /path/to/jb2/installation/config.json
```


## jbrowse add-track-json

```
Add a track configuration directly from a JSON hunk to the JBrowse 2
configuration

Usage: jbrowse add-track-json <track> [options]

Options:
  -h, --help                 Show help

  -u, --update               Update the contents of an existing track, matched
                             based on trackId

      --target               Path to config file in JB2 installation directory
                             to write out to

      --out                  Synonym for target

Examples:

# add a track from a JSON file
$ jbrowse add-track-json track.json

# update an existing track (matched by trackId) with new JSON contents
$ jbrowse add-track-json track.json --update

# pass the track config inline instead of via a file
$ jbrowse add-track-json '{"type":"FeatureTrack","trackId":"genes","assemblyNames":["hg38"],"adapter":{"type":"Gff3TabixAdapter","gffGzLocation":{"uri":"genes.gff.gz"}}}'

# write to a config.json in a specific installation directory
$ jbrowse add-track-json track.json --out /path/to/jb2/
```


## jbrowse remove-track

```
Remove a track configuration from a JBrowse 2 configuration. Be aware that this
can cause crashes in saved sessions that refer to this track!

Usage: jbrowse remove-track <trackId> [options]

Options:
  -h, --help                 Show help

      --target               Path to config file in JB2 installation directory
                             to write out to

      --out                  Synonym for target

Examples:

# remove a track from the config.json in the current directory
$ jbrowse remove-track my_track_id

# remove a track from a config.json in a specific installation directory
$ jbrowse remove-track my_track_id --out /path/to/jb2/

# remove a track from a specific config file
$ jbrowse remove-track my_track_id --target /path/to/jb2/config.json
```


## jbrowse set-default-session

```
Set a default session with views and tracks

Usage: jbrowse set-default-session [options]

Options:
  -s, --session              set path to a file containing session in json
                             format (required, unless using
                             delete/currentSession flags)

  -n, --name                 Give a name for the default session (overrides any
                             name in the session file; defaults to "New Default
                             Session")

  -c, --currentSession       List out the current default session

      --target               path to config file in JB2 installation directory
                             to write out to

      --out                  synonym for target

      --delete               Delete any existing default session.

  -h, --help                 Show help

Examples:

# set default session for the config.json in your current directory
$ jbrowse set-default-session --session /path/to/default/session.json

# make session.json the defaultSession on the specified target config.json file
$ jbrowse set-default-session --target /path/to/jb2/installation/config.json --session session.json

# override the name stored in the session file
$ jbrowse set-default-session --session session.json --name "My default view"

# print the current default session
$ jbrowse set-default-session --currentSession

# remove the existing default session
$ jbrowse set-default-session --delete
```


