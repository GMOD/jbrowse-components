---
id: quickstart_cli
title: JBrowse web quick start via CLI
toplevel: true
---

import Figure from './figure'

In this guide, we'll get an instance of JBrowse web running on your computer's
browser.

Just want to download JBrowse web and get started? Follow our [JBrowse web
quick start](../quickstart_web).

Want JBrowse desktop? Follow our [JBrowse desktop quick
start](../quickstart_desktop).

## Prerequisites

- Ability to run commands on the command line
- A stable and recent version of [node](https://nodejs.org/en/)

:::caution

If you are using `apt` as your package manager, we recommend not using it to
install Node.js. Good alternatives include
[NodeSource](https://github.com/nodesource) or
[NVM](https://github.com/nvm-sh/nvm).

:::

## Downloading JBrowse 2 using the JBrowse CLI

The JBrowse CLI can help perform many tasks to help you manage JBrowse 2, such
as:

- create a new instance of JBrowse 2 automatically
- update an existing instance of JBrowse 2 with the latest released version
- configure your JBrowse 2 instance

### Installing the CLI tools

To globally install the JBrowse CLI, run

```sh-session
npm install -g @jbrowse/cli
```

After running this command you can then test the installation with

```sh-session
jbrowse --version
```

which will output the current version of the JBrowse CLI.

:::note

If you can't or don't want to globally install the JBrowse CLI, you can also use
the [npx](https://nodejs.dev/learn/the-npx-nodejs-package-runner) command, which
is included with Node.js, to run JBrowse CLI without installing it. Simply
replace `jbrowse` with `npx @jbrowse/cli` in any command, e.g.

```sh-session
npx @jbrowse/cli --version
```

:::

### Using `jbrowse create` to download JBrowse 2

In the directory where you would like to download JBrowse 2, run

```sh-session
jbrowse create jbrowse2
```

### Checking the download

The directory where you downloaded JBrowse should look something like this:

```txt
jbrowse2/
├── asset-manifest.json
├── favicon.ico
├── index.html
├── manifest.json
├── robots.txt
├── static/
├── test_data/
└── version.txt
```

## Running JBrowse 2

JBrowse 2 requires a web server to run. It won't work if you try to directly
open the `index.html` in your web browser. We can use a simple server to check
that JBrowse 2 has been downloaded properly. Run

```sh-session
cd jbrowse2/
npx serve . # use npx serve -S . if you want to refer to symlinked data later on
```

which will start a web server in our JBrowse 2 directory.

Navigate to the location specified in the CLI's output (likely
`http://localhost:3000`).

Your page should look something like this:

<Figure caption="JBrowse 2 screen showing no configuration found" src="/img/config_not_found.png"/>

Click on the sample config to see JBrowse 2 running with a demo
configuration. It should look like this:

<Figure caption="JBrowse 2 screen with a sample configuration" src="/img/sample_config.png"/>

Congratulations! You're running JBrowse 2.

## Next steps

Now that JBrowse 2 is set up, you can configure it with your own genomes and
tracks. There are two ways you can configure JBrowse 2: with the JBrowse CLI
(tutorial [here](../tutorials/config_cli)) or with JBrowse 2's built-in graphical
configuration editing (guide [here](../tutorials/config_gui)).
