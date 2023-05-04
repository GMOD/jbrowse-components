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
- [`jbrowse remove-track TRACK`](#jbrowse-remove-track-track)
- [`jbrowse set-default-session`](#jbrowse-set-default-session)
- [`jbrowse text-index`](#jbrowse-text-index)
- [`jbrowse upgrade [LOCALPATH]`](#jbrowse-upgrade-localpath)

## `jbrowse add-assembly SEQUENCE`

Add an assembly to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-assembly SEQUENCE

ARGUMENTS
  SEQUENCE
      sequence file or URL

      If TYPE is indexedFasta or bgzipFasta, the index file defaults to <location>.fai
      and can be optionally specified with --faiLocation
      If TYPE is bgzipFasta, the gzip index file defaults to <location>.gzi and can be
      optionally specified with --gziLocation

OPTIONS
  -a, --alias=alias
      An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38");
      can be specified multiple times

  -f, --force
      Equivalent to `--skipCheck --overwrite`

  -h, --help
      show CLI help

  -l, --load=copy|symlink|move|inPlace
      Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data
      directory to the JBrowse directory. Or use inPlace to modify the config without doing any file operations

  -n, --name=name
      Name of the assembly; if not specified, will be guessed using the sequence file name

  -t, --type=indexedFasta|bgzipFasta|twoBit|chromSizes|custom
      type of sequence, by default inferred from sequence file

      indexedFasta   An index FASTA (e.g. .fa or .fasta) file;
      can optionally specify --faiLocation

      bgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file;
      can optionally specify --faiLocation and/or --gziLocation

      twoBit         A twoBit (e.g. .2bit) file

      chromSizes     A chromosome sizes (e.g. .chrom.sizes) file

      custom         Either a JSON file location or inline JSON that defines a custom
      sequence adapter; must provide --name if using inline JSON

  --displayName=displayName
      The display name to specify for the assembly, e.g. "Homo sapiens (hg38)" while the name can be a shorter identifier
      like "hg38"

  --faiLocation=faiLocation
      [default: <fastaLocation>.fai] FASTA index file or URL

  --gziLocation=gziLocation
      [default: <fastaLocation>.gzi] FASTA gzip index file or URL

  --out=out
      synonym for target

  --overwrite
      Overwrite existing assembly if one with the same name exists

  --refNameAliases=refNameAliases
      Reference sequence name aliases file or URL; assumed to be a tab-separated aliases
      file unless --refNameAliasesType is specified

  --refNameAliasesType=aliases|custom
      Type of aliases defined by --refNameAliases; if "custom", --refNameAliases is either
      a JSON file location or inline JSON that defines a custom sequence adapter

  --refNameColors=refNameColors
      A comma-separated list of color strings for the reference sequence names; will cycle
      through colors if there are fewer colors than sequences

  --skipCheck
      Don't check whether or not the sequence file or URL exists or if you are in a JBrowse directory

  --target=target
      path to config file in JB2 installation directory to write out to.
      Creates ./config.json if nonexistent

EXAMPLES
  # add assembly to installation in current directory. assumes .fai file also exists, and copies GRCh38.fa and
  GRCh38.fa.fai to current directory
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
[src/commands/add-assembly.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/add-assembly.ts)_

## `jbrowse add-connection CONNECTIONURLORPATH`

Add a connection to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-connection CONNECTIONURLORPATH

ARGUMENTS
  CONNECTIONURLORPATH  URL of data directory
                       For hub file, usually called hub.txt
                       For JBrowse 1, location of JB1 data directory similar to http://mysite.com/jbrowse/data/

OPTIONS
  -a, --assemblyName=assemblyName  Assembly name of the connection If none, will default to the assembly in your config
                                   file

  -c, --config=config              Any extra config settings to add to connection in JSON object format, such as
                                   '{"uri":"url":"https://sample.com"}, "locationType": "UriLocation"}'

  -f, --force                      Equivalent to `--skipCheck --overwrite`

  -h, --help                       show CLI help

  -n, --name=name                  Name of the connection. Defaults to connectionId if not provided

  -t, --type=type                  type of connection, ex. JBrowse1Connection, UCSCTrackHubConnection, custom

  --connectionId=connectionId      Id for the connection that must be unique to JBrowse.  Defaults to
                                   'connectionType-assemblyName-currentTime'

  --out=out                        synonym for target

  --overwrite                      Overwrites any existing connections if same connection id

  --skipCheck                      Don't check whether or not the data directory URL exists or if you are in a JBrowse
                                   directory

  --target=target                  path to config file in JB2 installation directory to write out to.

EXAMPLES
  $ jbrowse add-connection http://mysite.com/jbrowse/data/
  $ jbrowse add-connection http://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection
  $ jbrowse add-connection http://mysite.com/path/to/hub.txt --assemblyName hg19
  $ jbrowse add-connection http://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection --assemblyName
  hg19
  $ jbrowse add-connection http://mysite.com/path/to/custom --type custom --config
  '{"uri":{"url":"https://mysite.com/path/to/custom"}, "locationType": "UriLocation"}' --assemblyName hg19
  $ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target
  /path/to/jb2/installation/config.json
```

_See code:
[src/commands/add-connection.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/add-connection.ts)_

## `jbrowse add-track TRACK`

Add a track to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-track TRACK

ARGUMENTS
  TRACK  Track file or URL

OPTIONS
  -a, --assemblyNames=assemblyNames     Assembly name or names for track as comma separated string. If none, will
                                        default to the assembly in your config file

  -d, --description=description         Optional description of the track

  -f, --force                           Equivalent to `--skipCheck --overwrite`

  -h, --help                            show CLI help

  -l, --load=copy|symlink|move|inPlace  Required flag when using a local file. Choose how to manage the track. Copy,
                                        symlink, or move the track to the JBrowse directory. Or inPlace to leave track
                                        alone

  -n, --name=name                       Name of the track. Will be defaulted to the trackId if none specified

  -t, --trackType=trackType             Type of track, by default inferred from track file

  --bed1=bed1                           Used only for mcscan anchors/simpleAnchors types

  --bed2=bed2                           Used only for mcscan anchors/simpleAnchors types

  --category=category                   Optional Comma separated string of categories to group tracks

  --config=config                       Any extra config settings to add to a track. i.e '{"defaultRendering":
                                        "density"}'

  --indexFile=indexFile                 Optional index file for the track

  --out=out                             synonym for target

  --overwrite                           Overwrites existing track if it shares the same trackId

  --protocol=protocol                   [default: uri] Force protocol to a specific value

  --skipCheck                           Skip check for whether or not the file or URL exists or if you are in a JBrowse
                                        directory

  --subDir=subDir                       when using --load a file, output to a subdirectory of the target dir

  --target=target                       path to config file in JB2 installation to write out to.

  --trackId=trackId                     trackId for the track, by default inferred from filename, must be unique
                                        throughout config

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
[src/commands/add-track.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/add-track.ts)_

## `jbrowse add-track-json TRACK`

Add a track configuration directly from a JSON hunk to the JBrowse 2
configuration

```
USAGE
  $ jbrowse add-track-json TRACK

ARGUMENTS
  TRACK  track JSON file or command line arg blob

OPTIONS
  -u, --update     update the contents of an existing track, matched based on trackId
  --out=out        synonym for target

  --target=target  path to config file in JB2 installation directory to write out to.
                   Creates ./config.json if nonexistent

EXAMPLES
  $ jbrowse add-track-json track.json
  $ jbrowse add-track-json track.json --update
```

_See code:
[src/commands/add-track-json.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/add-track-json.ts)_

## `jbrowse admin-server`

Start up a small admin server for JBrowse configuration

```
USAGE
  $ jbrowse admin-server

OPTIONS
  -h, --help                     show CLI help

  -p, --port=port                Specifified port to start the server on;
                                 Default is 9090.

  --bodySizeLimit=bodySizeLimit  [default: 25mb] Size limit of the update message; may need to increase if config is
                                 large.
                                 Argument is passed to bytes library for parsing: https://www.npmjs.com/package/bytes.

  --root=root                    path to the root of the JB2 installation.
                                 Creates ./config.json if nonexistent. note that you can navigate to
                                 ?config=path/to/subconfig.json in the web browser and it will write to
                                 rootDir/path/to/subconfig.json

EXAMPLES
  $ jbrowse admin-server
  $ jbrowse admin-server -p 8888
```

_See code:
[src/commands/admin-server.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/admin-server.ts)_

## `jbrowse create LOCALPATH`

Downloads and installs the latest JBrowse 2 release

```
USAGE
  $ jbrowse create LOCALPATH

ARGUMENTS
  LOCALPATH  Location where JBrowse 2 will be installed

OPTIONS
  -f, --force         Overwrites existing JBrowse 2 installation if present in path
  -h, --help          show CLI help
  -l, --listVersions  Lists out all versions of JBrowse 2

  -t, --tag=tag       Version of JBrowse 2 to install. Format is v1.0.0.
                      Defaults to latest

  -u, --url=url       A direct URL to a JBrowse 2 release

  --branch=branch     Download a development build from a named git branch

  --nightly           Download the latest development build from the main branch

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
[src/commands/create.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/create.ts)_

## `jbrowse help [COMMAND]`

display help for jbrowse

```
USAGE
  $ jbrowse help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.14/src/commands/help.ts)_

## `jbrowse remove-track TRACK`

Remove a track configuration from a JBrowse 2 configuration. Be aware that this
can cause crashes in saved sessions that refer to this track!

```
USAGE
  $ jbrowse remove-track TRACK

ARGUMENTS
  TRACK  track JSON file or command line arg blob

OPTIONS
  --out=out        synonym for target

  --target=target  path to config file in JB2 installation directory to write out to.
                   Creates ./config.json if nonexistent

EXAMPLE
  $ jbrowse remove-track-json trackId
```

_See code:
[src/commands/remove-track.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/remove-track.ts)_

## `jbrowse set-default-session`

Set a default session with views and tracks

```
USAGE
  $ jbrowse set-default-session

OPTIONS
  -c, --currentSession   List out the current default session
  -h, --help             show CLI help
  -n, --name=name        [default: New Default Session] Give a name for the default session
  -s, --session=session  set path to a file containing session in json format
  -t, --tracks=tracks    Track id or track ids as comma separated string to put into default session

  -v, --view=view        View type in config to be added as default session, i.e LinearGenomeView, CircularView,
                         DotplotView.
                         Must be provided if no default session file provided

  --delete               Delete any existing default session.

  --out=out              synonym for target

  --target=target        path to config file in JB2 installation directory to write out to

  --viewId=viewId        Identifier for the view. Will be generated on default

EXAMPLES
  $ jbrowse set-default-session --session /path/to/default/session.json
  $ jbrowse set-default-session --target /path/to/jb2/installation/config.json --view LinearGenomeView --tracks track1,
  track2, track3
  $ jbrowse set-default-session --view LinearGenomeView, --name newName --viewId view-no-tracks
  $ jbrowse set-default-session --currentSession # Prints out current default session
```

_See code:
[src/commands/set-default-session.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/set-default-session.ts)_

## `jbrowse text-index`

Make a text-indexing file for any given track(s).

```
USAGE
  $ jbrowse text-index

OPTIONS
  -a, --assemblies=assemblies  Specify the assembl(ies) to create an index for. If unspecified, creates an index for
                               each assembly in the config

  -h, --help                   show CLI help

  -q, --quiet                  Hide the progress bars

  --attributes=attributes      [default: Name,ID] Comma separated list of attributes to index

  --dryrun                     Just print out tracks that will be indexed by the process, without doing any indexing

  --exclude=exclude            [default: CDS,exon] Adds gene type to list of excluded types

  --file=file                  File or files to index (can be used to create trix indexes for embedded component use
                               cases not using a config.json for example)

  --fileId=fileId              Set the trackId used for the indexes generated with the --file argument

  --force                      Overwrite previously existing indexes

  --out=out                    Synonym for target

  --perTrack                   If set, creates an index per track

  --prefixSize=prefixSize      Specify the prefix size for the ixx index. We attempt to automatically calculate this,
                               but you can manually specify this too. If many genes have similar gene IDs e.g.
                               Z000000001, Z000000002 the prefix size should be larger so that they get split into
                               different bins

  --target=target              Path to config file in JB2 installation directory to read from.

  --tracks=tracks              Specific tracks to index, formatted as comma separated trackIds. If unspecified, indexes
                               all available tracks

EXAMPLES
  # indexes all tracks that it can find in the current directory's config.json
  $ jbrowse text-index

  # indexes specific trackIds that it can find in the current directory's config.json
  $ jbrowse text-index --tracks=track1,track2,track3

  # indexes all tracks in a directory's config.json or in a specific config file
  $ jbrowse text-index --out /path/to/jb2/

  # indexes only a specific assembly, and overwrite what was previously there using force (which is needed if a previous
   index already existed)
  $ jbrowse text-index -a hg19 --force

  # create index for some files for use in @jbrowse/react-linear-genome-view or similar
  $ jbrowse text-index --file myfile.gff3.gz --file myfile.vcfgz --out indexes
```

_See code:
[src/commands/text-index.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/text-index.ts)_

## `jbrowse upgrade [LOCALPATH]`

Upgrades JBrowse 2 to latest version

```
USAGE
  $ jbrowse upgrade [LOCALPATH]

ARGUMENTS
  LOCALPATH  [default: .] Location where JBrowse 2 is installed

OPTIONS
  -h, --help          show CLI help
  -l, --listVersions  Lists out all versions of JBrowse 2

  -t, --tag=tag       Version of JBrowse 2 to install. Format is v1.0.0.
                      Defaults to latest

  -u, --url=url       A direct URL to a JBrowse 2 release

  --branch=branch     Download a development build from a named git branch

  --clean             Removes old js,map,and LICENSE files in the installation

  --nightly           Download the latest development build from the main branch

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
[src/commands/upgrade.ts](https://github.com/GMOD/jbrowse-components/blob/v2.5.0/products/jbrowse-cli/src/commands/upgrade.ts)_

<!-- commandsstop -->

## Debugging

Debug logs (provided by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
