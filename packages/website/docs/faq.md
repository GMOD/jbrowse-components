---
id: faq
title: FAQ
---

# FAQ

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
