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

```sh-session
$ npm install -g @jbrowse/cli
```

A CLI tool called `jbrowse` should then be available in the path. You can test
your installation with

```sh-session
$ jbrowse --version
```

It is also possible to do one-off executions using npx, e.g.

```sh-session
npx @jbrowse/cli create myfolder
```

It is likely preferable in most cases to install the tools globally with
`npm install @jbrowse/cli -g` however

## Commands

<!-- commands -->

- [`jbrowse add-assembly SEQUENCE`](#jbrowse-add-assembly-sequence)
- [`jbrowse add-connection CONNECTIONURLORPATH`](#jbrowse-add-connection-connectionurlorpath)
- [`jbrowse add-track TRACK`](#jbrowse-add-track-track)
- [`jbrowse add-track-json TRACK`](#jbrowse-add-track-json-track)
- [`jbrowse admin-server`](#jbrowse-admin-server)
- [`jbrowse create LOCALPATH`](#jbrowse-create-localpath)
- [`jbrowse help [COMMAND]`](#jbrowse-help-command)
- [`jbrowse make-pif FILE`](#jbrowse-make-pif-file)
- [`jbrowse remove-track TRACK`](#jbrowse-remove-track-track)
- [`jbrowse set-default-session`](#jbrowse-set-default-session)
- [`jbrowse sort-bed FILE`](#jbrowse-sort-bed-file)
- [`jbrowse sort-gff FILE`](#jbrowse-sort-gff-file)
- [`jbrowse text-index`](#jbrowse-text-index)
- [`jbrowse upgrade [LOCALPATH]`](#jbrowse-upgrade-localpath)

## `jbrowse add-assembly SEQUENCE`

Add an assembly to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-assembly SEQUENCE [-t indexedFasta|bgzipFasta|twoBit|chromSizes|custom] [-n <value>] [-a
    <value>...] [--displayName <value>] [--faiLocation <value>] [--gziLocation <value>] [--refNameAliasesType
    aliases|custom --refNameAliases <value>] [--refNameColors <value>] [--target <value>] [--out <value>] [-h] [-l
    copy|symlink|move|inPlace] [--skipCheck] [--overwrite] [-f]

ARGUMENTS
  SEQUENCE
      sequence file or URL

      If TYPE is indexedFasta or bgzipFasta, the index file defaults to <location>.fai
      and can be optionally specified with --faiLocation
      If TYPE is bgzipFasta, the gzip index file defaults to <location>.gzi and can be
      optionally specified with --gziLocation

FLAGS
  -a, --alias=<value>...
      An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38");
      can be specified multiple times

  -f, --force
      Equivalent to `--skipCheck --overwrite`

  -h, --help
      Show CLI help.

  -l, --load=<option>
      Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data
      directory to the JBrowse directory. Or use inPlace to modify the config without doing any file operations
      <options: copy|symlink|move|inPlace>

  -n, --name=<value>
      Name of the assembly; if not specified, will be guessed using the sequence file name

  -t, --type=<option>
      type of sequence, by default inferred from sequence file

      indexedFasta   An index FASTA (e.g. .fa or .fasta) file;
      can optionally specify --faiLocation

      bgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file;
      can optionally specify --faiLocation and/or --gziLocation

      twoBit         A twoBit (e.g. .2bit) file

      chromSizes     A chromosome sizes (e.g. .chrom.sizes) file

      custom         Either a JSON file location or inline JSON that defines a custom
      sequence adapter; must provide --name if using inline JSON
      <options: indexedFasta|bgzipFasta|twoBit|chromSizes|custom>

  --displayName=<value>
      The display name to specify for the assembly, e.g. "Homo sapiens (hg38)" while the name can be a shorter identifier
      like "hg38"

  --faiLocation=<value>
      [default: <fastaLocation>.fai] FASTA index file or URL

  --gziLocation=<value>
      [default: <fastaLocation>.gzi] FASTA gzip index file or URL

  --out=<value>
      synonym for target

  --overwrite
      Overwrite existing assembly if one with the same name exists

  --refNameAliases=<value>
      Reference sequence name aliases file or URL; assumed to be a tab-separated aliases
      file unless --refNameAliasesType is specified

  --refNameAliasesType=<option>
      Type of aliases defined by --refNameAliases; if "custom", --refNameAliases is either
      a JSON file location or inline JSON that defines a custom sequence adapter
      <options: aliases|custom>

  --refNameColors=<value>
      A comma-separated list of color strings for the reference sequence names; will cycle
      through colors if there are fewer colors than sequences

  --skipCheck
      Don't check whether or not the sequence file or URL exists or if you are in a JBrowse directory

  --target=<value>
      path to config file in JB2 installation directory to write out to.
      Creates ./config.json if nonexistent

DESCRIPTION
  Add an assembly to a JBrowse 2 configuration

EXAMPLES
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

_See code:
[src/commands/add-assembly.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/add-assembly.ts)_

## `jbrowse add-connection CONNECTIONURLORPATH`

Add a connection to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-connection CONNECTIONURLORPATH [-t <value>] [-a <value>] [-c <value>] [--connectionId <value>] [-n
    <value>] [--target <value>] [--out <value>] [-h] [--skipCheck] [--overwrite] [-f]

ARGUMENTS
  CONNECTIONURLORPATH  URL of data directory
                       For hub file, usually called hub.txt
                       For JBrowse 1, location of JB1 data directory similar to http://mysite.com/jbrowse/data/

FLAGS
  -a, --assemblyNames=<value>  For UCSC, optional: Comma separated list of assembly name(s) to filter from this
                               connection. For JBrowse: a single assembly name
  -c, --config=<value>         Any extra config settings to add to connection in JSON object format, such as
                               '{"uri":"url":"https://sample.com"}, "locationType": "UriLocation"}'
  -f, --force                  Equivalent to `--skipCheck --overwrite`
  -h, --help                   Show CLI help.
  -n, --name=<value>           Name of the connection. Defaults to connectionId if not provided
  -t, --type=<value>           type of connection, ex. JBrowse1Connection, UCSCTrackHubConnection, custom
      --connectionId=<value>   Id for the connection that must be unique to JBrowse.  Defaults to
                               'connectionType-assemblyName-currentTime'
      --out=<value>            synonym for target
      --overwrite              Overwrites any existing connections if same connection id
      --skipCheck              Don't check whether or not the data directory URL exists or if you are in a JBrowse
                               directory
      --target=<value>         path to config file in JB2 installation directory to write out to.

DESCRIPTION
  Add a connection to a JBrowse 2 configuration

EXAMPLES
  $ jbrowse add-connection http://mysite.com/jbrowse/data/ -a hg19

  $ jbrowse add-connection http://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection -a hg38

  $ jbrowse add-connection http://mysite.com/path/to/hub.txt

  $ jbrowse add-connection http://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection

  $ jbrowse add-connection http://mysite.com/path/to/custom --type custom --config '{"uri":{"url":"https://mysite.com/path/to/custom"}, "locationType": "UriLocation"}' -a hg19

  $ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target /path/to/jb2/installation/config.json
```

_See code:
[src/commands/add-connection.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/add-connection.ts)_

## `jbrowse add-track TRACK`

Add a track to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-track TRACK [-t <value>] [-n <value>] [--indexFile <value>] [-d <value>] [-a <value>]
    [--category <value>] [--config <value>] [--target <value>] [--out <value>] [--subDir <value>] [-h] [--trackId
    <value>] [-l copy|symlink|move|inPlace] [--skipCheck] [--overwrite] [-f] [--protocol <value>] [--bed1 <value>]
    [--bed2 <value>]

ARGUMENTS
  TRACK  Track file or URL

FLAGS
  -a, --assemblyNames=<value>  Assembly name or names for track as comma separated string. If none, will default to the
                               assembly in your config file
  -d, --description=<value>    Optional description of the track
  -f, --force                  Equivalent to `--skipCheck --overwrite`
  -h, --help                   Show CLI help.
  -l, --load=<option>          Required flag when using a local file. Choose how to manage the track. Copy, symlink, or
                               move the track to the JBrowse directory. Or inPlace to leave track alone
                               <options: copy|symlink|move|inPlace>
  -n, --name=<value>           Name of the track. Will be defaulted to the trackId if none specified
  -t, --trackType=<value>      Type of track, by default inferred from track file
      --bed1=<value>           Used only for mcscan anchors/simpleAnchors types
      --bed2=<value>           Used only for mcscan anchors/simpleAnchors types
      --category=<value>       Optional Comma separated string of categories to group tracks
      --config=<value>         Any extra config settings to add to a track. i.e '{"defaultRendering": "density"}'
      --indexFile=<value>      Optional index file for the track
      --out=<value>            synonym for target
      --overwrite              Overwrites existing track if it shares the same trackId
      --protocol=<value>       [default: uri] Force protocol to a specific value
      --skipCheck              Skip check for whether or not the file or URL exists or if you are in a JBrowse directory
      --subDir=<value>         when using --load a file, output to a subdirectory of the target dir
      --target=<value>         path to config file in JB2 installation to write out to.
      --trackId=<value>        trackId for the track, by default inferred from filename, must be unique throughout
                               config

DESCRIPTION
  Add a track to a JBrowse 2 configuration

EXAMPLES
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
```

_See code:
[src/commands/add-track.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/add-track.ts)_

## `jbrowse add-track-json TRACK`

Add a track configuration directly from a JSON hunk to the JBrowse 2
configuration

```
USAGE
  $ jbrowse add-track-json TRACK [-u] [--target <value>] [--out <value>]

ARGUMENTS
  TRACK  track JSON file or command line arg blob

FLAGS
  -u, --update          update the contents of an existing track, matched based on trackId
      --out=<value>     synonym for target
      --target=<value>  path to config file in JB2 installation directory to write out to.
                        Creates ./config.json if nonexistent

DESCRIPTION
  Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration

EXAMPLES
  $ jbrowse add-track-json track.json

  $ jbrowse add-track-json track.json --update
```

_See code:
[src/commands/add-track-json.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/add-track-json.ts)_

## `jbrowse admin-server`

Start up a small admin server for JBrowse configuration

```
USAGE
  $ jbrowse admin-server [-p <value>] [--root <value>] [--bodySizeLimit <value>] [-h]

FLAGS
  -h, --help                   Show CLI help.
  -p, --port=<value>           Specifified port to start the server on;
                               Default is 9090.
      --bodySizeLimit=<value>  [default: 25mb] Size limit of the update message; may need to increase if config is
                               large.
                               Argument is passed to bytes library for parsing: https://www.npmjs.com/package/bytes.
      --root=<value>           path to the root of the JB2 installation.
                               Creates ./config.json if nonexistent. note that you can navigate to
                               ?config=path/to/subconfig.json in the web browser and it will write to
                               rootDir/path/to/subconfig.json

DESCRIPTION
  Start up a small admin server for JBrowse configuration

EXAMPLES
  $ jbrowse admin-server

  $ jbrowse admin-server -p 8888
```

_See code:
[src/commands/admin-server.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/admin-server.ts)_

## `jbrowse create LOCALPATH`

Downloads and installs the latest JBrowse 2 release

```
USAGE
  $ jbrowse create LOCALPATH [-h] [-f] [-l] [--branch <value>] [--nightly] [-u <value>] [-t <value>]

ARGUMENTS
  LOCALPATH  Location where JBrowse 2 will be installed

FLAGS
  -f, --force           Overwrites existing JBrowse 2 installation if present in path
  -h, --help            Show CLI help.
  -l, --listVersions    Lists out all versions of JBrowse 2
  -t, --tag=<value>     Version of JBrowse 2 to install. Format is v1.0.0.
                        Defaults to latest
  -u, --url=<value>     A direct URL to a JBrowse 2 release
      --branch=<value>  Download a development build from a named git branch
      --nightly         Download the latest development build from the main branch

DESCRIPTION
  Downloads and installs the latest JBrowse 2 release

EXAMPLES
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

_See code:
[src/commands/create.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/create.ts)_

## `jbrowse help [COMMAND]`

Display help for jbrowse.

```
USAGE
  $ jbrowse help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for jbrowse.
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.18/src/commands/help.ts)_

## `jbrowse make-pif FILE`

creates pairwise indexed PAF (PIF), with bgzip and tabix

```
USAGE
  $ jbrowse make-pif FILE [--out <value>] [--csi] [-h]

ARGUMENTS
  FILE  PAF file as input

FLAGS
  -h, --help         Show CLI help.
      --csi          Create a CSI index for the PIF file instead of TBI
      --out=<value>  Where to write the output file. will write ${file}.pif.gz and ${file}.pif.gz.tbi

DESCRIPTION
  creates pairwise indexed PAF (PIF), with bgzip and tabix

EXAMPLES
  $ jbrowse pif input.paf # creates input.pif.gz in same directory



  $ jbrowse pif input.paf --out output.pif.gz # specify output file, creates output.pif.gz.tbi also
```

_See code:
[src/commands/make-pif.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/make-pif.ts)_

## `jbrowse remove-track TRACK`

Remove a track configuration from a JBrowse 2 configuration. Be aware that this
can cause crashes in saved sessions that refer to this track!

```
USAGE
  $ jbrowse remove-track TRACK [--target <value>] [--out <value>]

ARGUMENTS
  TRACK  track JSON file or command line arg blob

FLAGS
  --out=<value>     synonym for target
  --target=<value>  path to config file in JB2 installation directory to write out to.
                    Creates ./config.json if nonexistent

DESCRIPTION
  Remove a track configuration from a JBrowse 2 configuration. Be aware that this can cause crashes in saved sessions
  that refer to this track!

EXAMPLES
  $ jbrowse remove-track-json trackId
```

_See code:
[src/commands/remove-track.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/remove-track.ts)_

## `jbrowse set-default-session`

Set a default session with views and tracks

```
USAGE
  $ jbrowse set-default-session [-s <value>] [-n <value>] [-c] [--target <value>] [--out <value>] [--delete] [-h]

FLAGS
  -c, --currentSession   List out the current default session
  -h, --help             Show CLI help.
  -n, --name=<value>     [default: New Default Session] Give a name for the default session
  -s, --session=<value>  set path to a file containing session in json format (required, unless using
                         delete/currentSession flags)
      --delete           Delete any existing default session.
      --out=<value>      synonym for target
      --target=<value>   path to config file in JB2 installation directory to write out to

DESCRIPTION
  Set a default session with views and tracks

EXAMPLES
  # set default session for the config.json in your current directory

  $ jbrowse set-default-session --session /path/to/default/session.json



  # make session.json the defaultSession on the specified target config.json file

  $ jbrowse set-default-session --target /path/to/jb2/installation/config.json --session session.json



  # print current default session

  $ jbrowse set-default-session --currentSession # Prints out current default session
```

_See code:
[src/commands/set-default-session.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/set-default-session.ts)_

## `jbrowse sort-bed FILE`

Helper utility to sort GFF files for tabix. Moves all lines starting with # to
the top of the file, and sort by refname and start position using unix utilities
sort and grep

```
USAGE
  $ jbrowse sort-bed FILE [-h]

ARGUMENTS
  FILE  GFF file

FLAGS
  -h, --help  Show CLI help.

DESCRIPTION
  Helper utility to sort GFF files for tabix. Moves all lines starting with # to the top of the file, and sort by
  refname and start position using unix utilities sort and grep

EXAMPLES
  # sort gff and pipe to bgzip

  $ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz

  $ tabix sorted.gff.gz
```

_See code:
[src/commands/sort-bed.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/sort-bed.ts)_

## `jbrowse sort-gff FILE`

Helper utility to sort GFF files for tabix. Moves all lines starting with # to
the top of the file, and sort by refname and start position using unix utilities
sort and grep

```
USAGE
  $ jbrowse sort-gff FILE [-h]

ARGUMENTS
  FILE  GFF file

FLAGS
  -h, --help  Show CLI help.

DESCRIPTION
  Helper utility to sort GFF files for tabix. Moves all lines starting with # to the top of the file, and sort by
  refname and start position using unix utilities sort and grep

EXAMPLES
  # sort gff and pipe to bgzip

  $ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz

  $ tabix sorted.gff.gz
```

_See code:
[src/commands/sort-gff.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/sort-gff.ts)_

## `jbrowse text-index`

Make a text-indexing file for any given track(s).

```
USAGE
  $ jbrowse text-index [-h] [--tracks <value>] [--target <value>] [--out <value>] [--attributes <value>] [-a
    <value>] [--force] [-q] [--perTrack] [--exclude <value>] [--prefixSize <value>] [--file <value>...] [--fileId
    <value>...] [--dryrun]

FLAGS
  -a, --assemblies=<value>  Specify the assembl(ies) to create an index for. If unspecified, creates an index for each
                            assembly in the config
  -h, --help                Show CLI help.
  -q, --quiet               Hide the progress bars
      --attributes=<value>  [default: Name,ID] Comma separated list of attributes to index
      --dryrun              Just print out tracks that will be indexed by the process, without doing any indexing
      --exclude=<value>     [default: CDS,exon] Adds gene type to list of excluded types
      --file=<value>...     File or files to index (can be used to create trix indexes for embedded component use cases
                            not using a config.json for example)
      --fileId=<value>...   Set the trackId used for the indexes generated with the --file argument
      --force               Overwrite previously existing indexes
      --out=<value>         Synonym for target
      --perTrack            If set, creates an index per track
      --prefixSize=<value>  Specify the prefix size for the ixx index. We attempt to automatically calculate this, but
                            you can manually specify this too. If many genes have similar gene IDs e.g. Z000000001,
                            Z000000002 the prefix size should be larger so that they get split into different bins
      --target=<value>      Path to config file in JB2 installation directory to read from.
      --tracks=<value>      Specific tracks to index, formatted as comma separated trackIds. If unspecified, indexes all
                            available tracks

DESCRIPTION
  Make a text-indexing file for any given track(s).

EXAMPLES
  # indexes all tracks that it can find in the current directory's config.json

  $ jbrowse text-index



  # indexes specific trackIds that it can find in the current directory's config.json

  $ jbrowse text-index --tracks=track1,track2,track3



  # indexes all tracks in a directory's config.json or in a specific config file

  $ jbrowse text-index --out /path/to/jb2/



  # indexes only a specific assembly, and overwrite what was previously there using force (which is needed if a previous index already existed)

  $ jbrowse text-index -a hg19 --force



  # create index for some files for use in @jbrowse/react-linear-genome-view or similar

  $ jbrowse text-index --file myfile.gff3.gz --file myfile.vcfgz --out indexes
```

_See code:
[src/commands/text-index.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/text-index.ts)_

## `jbrowse upgrade [LOCALPATH]`

Upgrades JBrowse 2 to latest version

```
USAGE
  $ jbrowse upgrade [LOCALPATH] [-h] [-l] [-t <value>] [--branch <value>] [--nightly] [--clean] [-u <value>]

ARGUMENTS
  LOCALPATH  [default: .] Location where JBrowse 2 is installed

FLAGS
  -h, --help            Show CLI help.
  -l, --listVersions    Lists out all versions of JBrowse 2
  -t, --tag=<value>     Version of JBrowse 2 to install. Format is v1.0.0.
                        Defaults to latest
  -u, --url=<value>     A direct URL to a JBrowse 2 release
      --branch=<value>  Download a development build from a named git branch
      --clean           Removes old js,map,and LICENSE files in the installation
      --nightly         Download the latest development build from the main branch

DESCRIPTION
  Upgrades JBrowse 2 to latest version

EXAMPLES
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

_See code:
[src/commands/upgrade.ts](https://github.com/GMOD/jbrowse-components/blob/v2.17.0/products/jbrowse-cli/src/commands/upgrade.ts)_

<!-- commandsstop -->

## Debugging

Debug logs (provided by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
