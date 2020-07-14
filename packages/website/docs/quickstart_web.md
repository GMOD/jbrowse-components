---
id: quickstart_web
title: JBrowse 2 web quickstart
toplevel: true
---

This guide will walk through installing jbrowse 2 on your website

JBrowse 2, like JBrowse 1, is "static site" compatible, meaning it does not
have any server side code that needs to run. We refer to JBrowse 2 for the web
as the jbrowse-web package, and jbrowse-web package is an optimized build of
our project, and is simply a folder of HTML, JS, and CSS files that can be
copied to your web directory.

### Pre-requisites

- You have a webserver such as nginx, apache2, or something else that can
  handle plain static resources (js, html, css)

- Node.js 10+ - recommend to install this from somewhere other than apt e.g.
  [NodeSource](https://github.com/nodesource/distributions/blob/master/README.md#installation-instructions)

### Using jbrowse CLI tools

We provide a set of CLI tools for initializing your instance that can do
multiple tasks such as

- downloading jbrowse 2 from github automatically
- updating an existing jbrowse 2 instance with the latest version on github
- loading a genome assembly
- loading track configs
- etc.

You can do many of these tasks manually if you have familiarity with the
system, but the CLI tool will help automate tasks for you

#### Install the CLI tools

To install the JBrowse CLI tools, we expect node v10 or greater to be installed
already, then you can use

    npm install -g @gmod/jbrowse-cli

After running this command you can then test it with

    jbrowse --version

This will output the current version of our CLI tools

Note: if you do not want to install the CLI tools, they are technically
optional, but they provide useful commands for managing your jbrowse
installation such as downloading a release automatically, adding tracks, genome
assemblies, etc. to your installation

#### Using jbrowse create to install jbrowse

If you are running a web server such as apache2 or nginx, you may have your web
server in a directory such as `/var/www/html`

    jbrowse create /var/www/html/jbrowse2

This will download the latest JBrowse 2 release from github releases and
download it to the folder specified. See the docs for jbrowse CLI for more
options, which includes supplying a specific URL. Note that we also have

    jbrowse upgrade /var/www/html/jbrowse2

This will update jbrowse to the latest release, or to any specific tag if --tag
is supplied. If you cannot get these commands to work feel free to [let us
know](https://github.com/gmod/jbrowse-components/issues). You can also download
a release manually from our [releases
page](https://github.com/GMOD/jbrowse-components/releases) and unzip it instead
of using the `jbrowse create` command

#### Loading an assembly
