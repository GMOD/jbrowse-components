---
title: Command line tools
id: cli
toplevel: true
---

This document covers the CLI tools.

## Installation

The command line tools can be installed using `npm` as follows

```sh-session
$ npm install -g @jbrowse/cli
```

You can test your installation with

```sh-session
$ jbrowse --version
```

It is also possible to do one-off executions using npx, e.g.

```sh-session
npx @jbrowse/cli create myfolder
```

It is likely preferable in most cases to install the tools first however

## Commands

<!-- commands -->

- [`jbrowse add-assembly SEQUENCE`](#jbrowse-add-assembly-sequence)
- [`jbrowse add-connection CONNECTIONURLORPATH`](#jbrowse-add-connection-connectionurlorpath)
- [`jbrowse add-track TRACK`](#jbrowse-add-track-track)
- [`jbrowse add-track-json TRACK`](#jbrowse-add-track-json-track)
- [`jbrowse admin-server`](#jbrowse-admin-server)
- [`jbrowse create LOCALPATH`](#jbrowse-create-localpath)
- [`jbrowse help [COMMAND]`](#jbrowse-help-command)
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
  $ jbrowse add-assembly GRCh38.fa --load copy
  $ jbrowse add-assembly GRCh38.fasta.with.custom.extension.xyz --type indexedFasta --load move
  $ jbrowse add-assembly myFile.fa.gz --name GRCh38 --alias hg38 --load inPlace
  $ jbrowse add-assembly GRCh38.chrom.sizes --load inPlace
  $ jbrowse add-assembly GRCh38.config.json --load copy
  $ jbrowse add-assembly https://example.com/data/sample.2bit
  $ jbrowse add-assembly GRCh38.fa --target /path/to/jb2/installation/customconfig.json --load copy
```

_See code: [src/commands/add-assembly.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/add-assembly.ts)_

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
                                   '{"uri":"url":"https://sample.com"}}'

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
  '{"uri":{"url":"https://mysite.com/path/to/custom"}}' --assemblyName hg19
  $ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target
  /path/to/jb2/installation/config.json
```

_See code: [src/commands/add-connection.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/add-connection.ts)_

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
  # --load copy copies my.bam and my.bam.bai to current directory and adds track to config.json
  $ jbrowse add-track /path/to/my.bam --load copy

  # same as above, but specify path to bai file
  $ jbrowse add-track /path/to/my.bam --indexFile /path/to/my.bai --load copy

  # --load symlink creates symlink in /path/to/jb2/ directory for this file, and adds track to config.json
  $ jbrowse add-track /path/to/my.bam --target /path/to/jb2/config.json --load symlink

  # no --load flag to add literal URL for this track to config.json
  $ jbrowse add-track https://mywebsite.com/my.bam

  # --load move to move the file
  $ jbrowse add-track /path/to/my.bam --name 'New Track' --load move

  # --load inPlace puts /url/relative/path.bam in the config without performing any file operations
  $ jbrowse add-track /url/relative/path.bam --trackId AlignmentsTrack1 --load url --overwrite
```

_See code: [src/commands/add-track.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/add-track.ts)_

## `jbrowse add-track-json TRACK`

Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration

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

_See code: [src/commands/add-track-json.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/add-track-json.ts)_

## `jbrowse admin-server`

Start up a small admin server for JBrowse configuration

```
USAGE
  $ jbrowse admin-server

OPTIONS
  -h, --help       show CLI help

  -p, --port=port  Specifified port to start the server on;
                   Default is 9090.

  --out=out        synonym for target

  --skipCheck      Don't check whether or not you are in a JBrowse directory

  --target=target  path to config file in JB2 installation directory to write out to.
                   Creates ./config.json if nonexistent

EXAMPLES
  $ jbrowse admin-server
  $ jbrowse admin-server -p 8888
```

_See code: [src/commands/admin-server.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/admin-server.ts)_

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
  $ jbrowse create /path/to/new/installation
  $ jbrowse create /path/to/new/installation --force
  $ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip
  $ jbrowse create /path/to/new/installation --tag v1.0.0
  $ jbrowse create --listVersions # Lists out all available versions of JBrowse 2
```

_See code: [src/commands/create.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/create.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

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

_See code: [src/commands/set-default-session.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/set-default-session.ts)_

## `jbrowse text-index`

Make a single-track text index for the given track.

```
USAGE
  $ jbrowse text-index

OPTIONS
  -h, --help           show CLI help
  --individual         Only make a single-track text index for the given track
  --location=location  Establish a location for the output files
  --tracks=tracks      Specify the tracks to index, formatted as comma separated trackIds

EXAMPLES
  $ jbrowse text-index
  $ jbrowse text-index --tracks=track1,track2,track3
  $ jbrowse text-index --individual --tracks=my_track_id
  $ jbrowse text-index ... --location=my_file_path
```

_See code: [src/commands/text-index.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/text-index.ts)_

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

  --nightly           Download the latest development build from the main branch

EXAMPLES
  $ jbrowse upgrade # Upgrades current directory to latest jbrowse release
  $ jbrowse upgrade /path/to/jbrowse2/installation
  $ jbrowse upgrade /path/to/jbrowse2/installation --tag v1.0.0
  $ jbrowse upgrade --listVersions # Lists out all available versions of JBrowse 2
  $ jbrowse upgrade --url https://sample.com/jbrowse2.zip
```

_See code: [src/commands/upgrade.ts](https://github.com/GMOD/jbrowse-components/blob/v1.3.0/products/jbrowse-cli/src/commands/upgrade.ts)_

<!-- commandsstop -->

## Debugging

Debug logs (provided by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
