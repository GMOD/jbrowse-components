---
title: Command line tools
id: cli
---

This document covers the CLI tools.

## Installation

The command line tools can be installed using `npm` as follows

```sh-session
$ npm install -g @gmod/jbrowse-cli
```

You can test your installation with

```sh-session
$ jbrowse --version
```

It is also possible to do one-off executions using npx, e.g.

```sh-session
npx @gmod/jbrowse-cli create myfolder
```

It is likely preferable in most cases to install the tools first however

## Commands

<!-- commands -->

- [`jbrowse add-assembly SEQUENCE`](#jbrowse-add-assembly-sequence)
- [`jbrowse add-track DATADIRECTORY [LOCATION]`](#jbrowse-add-track-datadirectory-location)
- [`jbrowse add-track-json TRACK`](#jbrowse-add-track-json-track)
- [`jbrowse create LOCALPATH`](#jbrowse-create-localpath)
- [`jbrowse help [COMMAND]`](#jbrowse-help-command)
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

  -c, --config=config
      [default: ./config.json] Config file; if the file does not exist, it will be created

  -f, --force
      Equivalent to `--skipCheck --overwrite`

  -h, --help
      show CLI help

  -l, --load=copy|symlink|move|trust
      Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data
      directory to the JBrowse directory. Or use trust to modify the config without doing any file operations

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

EXAMPLES
  $ jbrowse add-assembly GRCh38.fa --load copy
  $ jbrowse add-assembly GRCh38.fasta.with.custom.extension.xyz --type indexedFasta --load move
  $ jbrowse add-assembly myFile.fa.gz --name GRCh38 --alias hg38 --load trust
  $ jbrowse add-assembly GRCh38.2bit --config path/to/config.json --load copy
  $ jbrowse add-assembly GRCh38.chrom.sizes --load trust
  $ jbrowse add-assembly GRCh38.config.json --load copy
  $ jbrowse add-assembly https://example.com/data/sample.2bit
```

## `jbrowse add-track DATADIRECTORY [LOCATION]`

Add a track to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-track DATADIRECTORY [LOCATION]

ARGUMENTS
  DATADIRECTORY  Data directory file or URL
  LOCATION       [default: .] location of JBrowse 2 installation. Defaults to .

OPTIONS
  -a, --assemblyNames=assemblyNames   Assembly name or names for track as comma separated string. If none, will default
                                      to the assembly in your config file

  -d, --description=description       Optional description of the track

  -f, --force                         Equivalent to `--skipCheck --overwrite`

  -h, --help                          show CLI help

  -l, --load=copy|symlink|move|trust  Required flag when using a local file. Choose how to manage the data directory.
                                      Copy, symlink, or move the data directory to the JBrowse directory. Or trust to
                                      leave data directory alone

  -n, --name=name                     Name of the track. Will be defaulted to the trackId if none specified

  -t, --type=type                     type of track, by default inferred from track file

  --category=category                 Optional Comma separated string of categories to group tracks

  --config=config                     Any extra config settings to add to a track. i.e {"defaultRendering": "density"}

  --configLocation=configLocation     Write to a certain config.json file. Defaults to location/config.json if not
                                      specified

  --overwrite                         Overwrites any existing tracks if same track id

  --skipCheck                         Don't check whether or not the file or URL exists or if you are in a JBrowse
                                      directory

  --trackId=trackId                   Id for the track, by default inferred from filename, must be unique to JBrowse
                                      config

EXAMPLES
  $ jbrowse add-track /path/to/my.bam --load copy
  $ jbrowse add-track /path/to/my.bam /path/to/jbrowse2/installation --load symlink
  $ jbrowse add-track https://mywebsite.com/my.bam
  $ jbrowse add-track /path/to/my.bam --type AlignmentsTrack --name 'New Track' -- load move
  $ jbrowse add-track /path/to/my.bam --trackId AlignmentsTrack1 --load trust --overwrite
  $ jbrowse add-track /path/to/my.bam --config '{"defaultRendering": "density"}'
  $ jbrowse add-track config.json'
```

## `jbrowse add-track-json TRACK`

Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration

```
USAGE
  $ jbrowse add-track-json TRACK

ARGUMENTS
  TRACK  track JSON file or command line arg blob

OPTIONS
  -c, --config=config  [default: ./config.json] Config file; if the file does not exist, it will be created
  -u, --update         update the contents of an existing track, matched based on trackId

EXAMPLES
  $ jbrowse add-track-json track.json
  $ jbrowse add-track-json track.json --update
```

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

  -t, --tag=tag       Version of JBrowse 2 to install. Format is @gmod/jbrowse-web@v0.0.1.
                      Defaults to latest

  -u, --url=url       A direct URL to a JBrowse 2 release

EXAMPLES
  $ jbrowse create /path/to/new/installation
  $ jbrowse create /path/to/new/installation --force
  $ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip
  $ jbrowse create /path/to/new/installation --tag @gmod/jbrowse-web@v0.0.1
  $ jbrowse create --listVersion
```

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_

## `jbrowse upgrade [LOCALPATH]`

Upgrades JBrowse 2 to latest version

```
USAGE
  $ jbrowse upgrade [LOCALPATH]

ARGUMENTS
  LOCALPATH  Location where JBrowse 2 is installed. Defaults to .

OPTIONS
  -h, --help          show CLI help
  -l, --listVersions  Lists out all versions of JBrowse 2

  -t, --tag=tag       Version of JBrowse 2 to install. Format is @gmod/jbrowse-web@v0.0.1.
                      Defaults to latest

  -u, --url=url       A direct URL to a JBrowse 2 release

EXAMPLES
  $ jbrowse upgrade
  $ jbrowse upgrade /path/to/jbrowse2/installation
  $ jbrowse upgrade /path/to/jbrowse2/installation --tag @gmod/jbrowse-web@v0.0.1
  $ jbrowse upgrade --listVersions
  $ jbrowse upgrade https://sample.com/jbrowse2.zip
```

<!-- commandsstop -->

## Debugging

Debug logs (provded by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
