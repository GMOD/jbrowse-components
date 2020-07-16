---
id: faq
title: FAQ
toplevel: true
---

### General

#### What technologies does JBrowse 2 use

- JBrowse uses React, mostly functional components and React hooks
- Uses mobx-state-tree to handle state
- Uses web-workers to parse data and render images
- Uses Typescript to check types
- For JBrowse 2 desktop specifically, uses Electron

#### What is special about JBrowse 2

One thing that makes JBrowse 2 special is that we can create new view
types via our plugin system. For example, we have already developed

- Circos-style whole genome overview
- Dotplot comparative view
- Linear synteny view

This makes JBrowse 2 more than just a genome browser-- it is really a platform
that can be built on.

### Setup

#### How can I start the JBrowse 2 app as a developer

We recommend that you have the following

- Node v10+
- Git
- [Yarn](https://classic.yarnpkg.com/en/docs/install/#debian-stable)

Then you can follow steps from our
[README](https://github.com/gmod/jbrowse-components)

It basically boils down to git cloning our repo, and running `yarn start` which
creates a development server on port 3000

You can use `PORT=8080 yarn start` to manually specify a different port

Note that this is a development server that gets started up. To install jbrowse
2 in production on your webserver, see below

### Do you have any tips for learning React and mobx-state-tree

Here is a short guide to React and mobx-state-tree that could help get you oriented

https://gist.github.com/cmdcolin/94d1cbc285e6319cc3af4b9a8556f03f

#### How can I setup JBrowse 2 in production

We recommend following the steps in the [quickstart web](quickstart_web) guide

Note that the `jbrowse create` command simply automates the download of the
release from github

Also note that JBrowse 2 is distributed as basically a bundle of javascript,
CSS, and html.

#### How can I setup JBrowse 2 without the CLI tools

The jbrowse CLI tools are basically a convenience, and are not strictly required

Simple tasks can be done without it

For example, for jbrowse create, you can visit
https://github.com/jbrowse-components/releases/latest and download the latest
jbrowse-web release tag, and unzip it into your web directory

For other things, like add-assembly and add-track, you can manually edit the
config.json, reviewing the config docs and sample configs will be valuable

Understanding the [config basics](config_basic) will come in handy also
because you can manually edit in advanced configs after your tracks are loaded
however be careful because corrupt configs can produce hard to understand errors,
because our config system is strongly typed

Feel free to message the team if you encounter these

#### How can I setup JBrowse 2 with the CLI tools

See the [quickstart guide](quickstart_web)

#### How do I load a track into JBrowse 2

If you have followed the above steps and installed jbrowse 2 on your webserver
and loaded the assembly, and have the CLI tools installed

    jbrowse add-track myfile.bw -a hg19

This will setup a bigwig track on the hg19 assembly in your config.json. Make
sure to run the command inside your current jbrowse2 folder e.g.
/var/www/html/jbrowse2 or wherever you are currently setting up a config.json
(you can have multiple configs)

To add a BAM track, try

    jbrowse add-track myfile.bam -i myfile.bam.bai -a hg19

Note that you can also use remote URLs

    jbrowse add-track http://yourremote

The add-track command will do as much as possible to infer from the file
extension how to configure this track

### Curiosities

#### Why do all the tracks need an assembly specified

We require that all tracks have a specific genome assembly specified in their
config. This is because jbrowse 2 is a multi-genome-assembly browser (and can
compare genomes given the data). This may be different to using say jbrowse 1
where it knows which genome assembly you are working with at any given time

#### How are the menus structured in the app

In JBrowse 1, the app level menu operated on the single linear genome view, but
with JBrowse 2, the top level menu only performs global operations and the
linear genome view has it's own hamburger menu. Note that each track also has
it's own track level menu.
