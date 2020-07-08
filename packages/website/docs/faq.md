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

Note that this is a development server that gets started up. To install on your
web server, see below

#### How can I setup JBrowse 2 on a web server

JBrowse 2 is distributed as basically a bundle of javascript, CSS, and html. It
is a 'static website'. Therefore, to setup JBrowse 2 on your web server looks
something like the following

1. ssh into your web server
2. `cd /var/www/html`
3. `curl https://github.com/jbrowse-components/releases/JBrowse-2.0.0.zip -o jbrowse2`
4. `sudo unzip jbrowse2.zip`

At this point, you have a jbrowse2 folder in your web directory, so you can
visit http://yoursite/jbrowse2/ to see if it has worked. Once this is done, you
can proceed to load data into your instance. Note: we also provide a command
line tool for automating this deployment. The steps are similar, but we hope
this also helps for people who want to keep their instance upgraded too

1. ssh into your web server
2. `cd /var/www/html`
3. `sudo npm install -g @gmod/jbrowse-cli`
4. `sudo jbrowse create jbrowse2`

This 'creates' a folder named jbrowse2 in your web directory that contains the
latest jbrowse 2 source code. We also have a CLI command `jbrowse update jbrowse2`,
where jbrowse2 is the folder name our your instance. This will
update an existing folder to the latest jbrowse 2 version. This helps, we hope,
with people being able to update their older jbrowse versions to the latest
version

Note: It may also help to configure permissions on your web folder e.g.
`chown $(whoami):$(whoami) jbrowse2` to make it so that you don't have to use
sudo

#### How do I load my genome assembly into JBrowse 2

To load a new genome assembly, we offer the command line tools. If you have
followed the steps above to setup JBrowse 2 on your web server, use the
following steps to load your genome assembly

1. ssh into your web server
2. sudo npm install -g @gmod/jbrowse-cli
3. cd /var/www/html/jbrowse2/
4. jbrowse add-assembly hg19.fa

This will automatically load the hg19 assembly, and will infer the assemblyname
of hg19. In subsequent commands to load tracks, you can reference the hg19
assembly

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

#### How do I connect a JBrowse 1 to JBrowse 2?

We have a concept of connections in JBrowse 2

We will have a CLI tool so that we can say

    jbrowse add-connection http://yoursite/jbrowse1/hg19_dir -a hg19

This will add a "connection" to your jbrowse 1 data. You still have to manually
configure assemblies

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

#### What is the startup sequence of JBrowse 2

If we look at the jbrowse-web codebase the startup sequence might look
something like this

- Scripts download

### Troubleshooting
