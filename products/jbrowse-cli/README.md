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

- [`jbrowse help [COMMANDS]`](#jbrowse-help-commands)

## `jbrowse help [COMMANDS]`

Display help for jbrowse.

```
USAGE
  $ jbrowse help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for jbrowse.
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.19/src/commands/help.ts)_

<!-- commandsstop -->

## Debugging

Debug logs (provided by [debug](https://github.com/visionmedia/debug)) can be
printed by setting the `DEBUG` environment variable. Setting `DEBUG=*` will
print all debug logs. Setting `DEBUG=jbrowse*` will print only logs from this
tool, and setting e.g. `DEBUG=jbrowse:add-assembly` will print only logs from
the `add-assembly` command.
