# @gmod/jbrowse-cli

A tool for working with JBrowse 2

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)

<!-- [![Version](https://img.shields.io/npm/v/@gmod/jbrowse-cli.svg)](https://npmjs.org/package/@gmod/jbrowse-cli)
[![Downloads/week](https://img.shields.io/npm/dw/@gmod/jbrowse-cli.svg)](https://npmjs.org/package/@gmod/jbrowse-cli)
[![License](https://img.shields.io/npm/l/@gmod/jbrowse-cli.svg)](https://github.com/@gmod/@gmod/jbrowse-components/blob/master/package.json) -->

<!-- toc -->

- [@gmod/jbrowse-cli](#gmodjbrowse-cli)
- [Usage](#usage)
- [Commands](#commands)
- [Debugging](#debugging)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @gmod/jbrowse-cli
$ jbrowse COMMAND
running command...
$ jbrowse (-v|--version|version)
@gmod/jbrowse-cli/0.0.0 linux-x64 node-v12.14.1
$ jbrowse --help [COMMAND]
USAGE
  $ jbrowse COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`jbrowse add-assembly SEQUENCE`](#jbrowse-add-assembly-sequence)
- [`jbrowse hello [FILE]`](#jbrowse-hello-file)
- [`jbrowse help [COMMAND]`](#jbrowse-help-command)

## `jbrowse add-assembly SEQUENCE`

Add an assembly to a JBrowse 2 configuration

```
USAGE
  $ jbrowse add-assembly SEQUENCE

ARGUMENTS
  SEQUENCE
      sequence file or URL

      If TYPE is indexedFasta or bgzipFasta, the index file defaults to <location>.fai and can be optionally specified
      with --faiLocation
      If TYPE is bgzipFasta, the gzip index file defaults to <location>.gzi and can be optionally specified with
      --gziLocation

OPTIONS
  -a, --alias=alias
      An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38"); can be specified multiple
      times

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

      indexedFasta   An index FASTA (e.g. .fa or .fasta) file; can optionally specify --faiLocation
      bgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file; can optionally specify
      --faiLocation and/or --gziLocation
      twoBit         A twoBit (e.g. .2bit) file
      chromSizes     A chromosome sizes (e.g. .chrom.sizes) file
      custom         Either a JSON file location or inline JSON that defines a custom sequence adapter; must provide
      --name if using inline JSON

  --faiLocation=faiLocation
      [default: <fastaLocation>.fai] FASTA index file or URL

  --gziLocation=gziLocation
      [default: <fastaLocation>.gzi] FASTA gzip index file or URL

  --overwrite
      Overwrite existing assembly if one with the same name exists

  --refNameAliases=refNameAliases
      Reference sequence name aliases file or URL; assumed to be a tab-separated aliases file unless --refNameAliasesType
      is specified

  --refNameAliasesType=aliases|custom
      Type of aliases defined by --refNameAliases; if "custom", --refNameAliases is either a JSON file location or inline
      JSON that defines a custom sequence adapter

  --refNameColors=refNameColors
      A comma-separated list of color strings for the reference sequence names; will cycle through colors if there are
      fewer colors than sequences

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

## `jbrowse hello [FILE]`

describe the command here

```
USAGE
  $ jbrowse hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ jbrowse hello
  hello world from ./src/hello.ts!
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

<!-- commandsstop -->

# Debugging

Debug logs (provded by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
