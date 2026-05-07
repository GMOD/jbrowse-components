---
title: v0.0.1-beta.28 Release
date: 2020-10-31
tags: ['release', 'jbrowse 2']
---

This is the next round in our beta testing on the way to a stable release

New features include

- added an assembly manager
- added a bugfix for refname mapping that caused slowness
- updated colors tied to the theme
- fixed side scrolling on OSX triggering the back button
- created shorter share URLs
- fixed for VCF track set
- created a default title on views that corresponds to the assembly name being
  viewed if relevant
- better autoinference on add track
- slower update frequency for the header bar, allowing faster scroll
- hide callbacks on irrelevant config slots
- disable opening local URLs in the add track workflows currently
- created a --indexFile flag for the add-track CLI for adding BAI, CRAI, TBI,
  CSI index, etc. if it isn't automatically inferred
- created a --out flag for the add-track CLI
- improve behavior when running the CLI outside of the config directory
- add ability to use the admin-server and the normal localhost:3000
  webpack-dev-server in parallel

Enjoy!

- [@jbrowse/web@0.0.1-beta.28](https://github.com/GMOD/jbrowse-components/releases/tag/@jbrowse/web@0.0.1-beta.28)

To install, you can download the link above, or you can use the jbrowse CLI tool
to automatically download the latest version. See the
[jbrowse 2 quick-start guide](https://jbrowse.org/jb2/docs/quickstart_web) for
more info
