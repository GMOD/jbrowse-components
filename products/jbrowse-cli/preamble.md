---
title: Command line tools
id: cli
toplevel: true
---

The `@jbrowse/cli` package provides the `jbrowse` command line tools. For the
@jbrowse/img static export tool, see https://www.npmjs.com/package/@jbrowse/img

The commands write a `config.json` that JBrowse Web serves and JBrowse Desktop
opens straight from disk:
[JBrowse CLI with Desktop](https://jbrowse.org/jb2/docs/tutorials/cli_desktop/).

Note: the @jbrowse/cli may not do all types of operations, some use cases may
best be handled by creating your own tools to manipulate a config.json by hand
or by using a script file.

A simple script that does not use @jbrowse/cli at all may just look like this

```js
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

To run a command once without installing, use npx:

```bash
npx @jbrowse/cli create myfolder
```

In most cases, install the tools globally with `npm install @jbrowse/cli -g`.
