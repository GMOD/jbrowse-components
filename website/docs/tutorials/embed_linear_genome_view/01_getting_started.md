---
id: 01_getting_started
title: Getting started
---

## Welcome!

This tutorial will show you how to get a JBrowse 2 linear genome view embedded
in a website. It is similar to a
[tutorial given a BCC2020](../../bcc2020_embedding_jbrowse_01_getting_started),
but has been updated to reflect the final, released version of the interface.

## What you need

We recommend having Node.js installed so that you can have an easy way to run a
server as well as be able to install the JBrowse CLI. Node.js has various
installers [here](https://nodejs.org/en/download/), or if you are on Mac or
Linux and plan on doing more extensive JavaScript development, we recommend
using [NVM](https://github.com/nvm-sh/nvm).

You can do most of this tutorial with a simple text editor and some way to serve
files (just opening the HTML files we create in a browser won't work, you'll
need a server). If you have Node.js installed, you can run a simple server by
opening your terminal in the directory you want to serve and running `npx serve`
(or you can install it globally with `npm install -g serve` and then run
`serve`).

We'll also be using the JBrowse CLI, although you can technically complete the
tutorial without it. You can install it after installing Node.js by running
`npm install -g @jbrowse/cli`. Check that it installed properly by running
`jbrowse --help`.
