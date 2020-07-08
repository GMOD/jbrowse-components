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
