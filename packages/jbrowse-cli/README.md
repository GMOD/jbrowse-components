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
      Don't check whether or not the sequence file or URL exists

EXAMPLES
  $ jbrowse add-assembly GRCh38.fa
  $ jbrowse add-assembly GRCh38.fasta.with.custom.extension.xyz --type indexedFasta
  $ jbrowse add-assembly myFile.fa.gz --name GRCh38 --alias hg38
  $ jbrowse add-assembly GRCh38.2bit --config path/to/config.json
  $ jbrowse add-assembly GRCh38.chrom.sizes
  $ jbrowse add-assembly GRCh38.config.json
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

  -t, --tag=tag       Version of JBrowse 2 to install. Format is JBrowse-2@v0.0.1.
                      Defaults to latest

  -u, --url=url       A direct URL to a JBrowse 2 release

EXAMPLES
  $ jbrowse create /path/to/new/installation
  $ jbrowse create /path/to/new/installation --force
  $ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip
  $ jbrowse create /path/to/new/installation --tag JBrowse-2@v0.0.1
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
  -t, --tag=tag       Version of JBrowse 2 to upgrade to. Defaults to latest

EXAMPLES
  $ jbrowse upgrade
  $ jbrowse upgrade /path/to/jbrowse2/installation
  $ jbrowse upgrade /path/to/jbrowse2/installation --tag JBrowse-2@v0.0.1
  $ jbrowse upgrade --listVersions
```

<!-- commandsstop -->

## Debugging

Debug logs (provded by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
