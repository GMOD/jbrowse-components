---
title: v1.0.0 Release
date: 2020-11-05
tags: ['release', 'jbrowse 2']
---

I am pleased to announce the first stable release of JBrowse 2!

This release includes our new "display modes" concept which allows the same
track to be displayed in different view types. For example, the same synteny
track can be used in both a dotplot or a linear synteny view. Similarly, a SV
VCF with breakends can be used in the circular view or a linear genome view.

This has been a massive effort by the team to get us to this 1.0.0 release, and
we greatly thank all the beta users who have helped us with testing.

Changes

- fixed bug with reference sequences that don't use the alias system
- fixed bug with SV inspector having a disabled state stuck on the buttons
- added documentation for the `jbrowse admin-server` command
- added display modes, a giant effort to make the same track visible in multiple
  contexts
- added a splash screen when no default session is in the config file
- changed error state of spreadsheet to a volatile
- fixed loading state of the RefNameAutocomplete
- fixed spreadsheet import of VCF with no FORMAT column
- made a small bundle-size improvement from removing unused crypto-js resources
- removed savedSessions from config schema
- fixed deleting a track when a closed widget references it
- fixed crash when live editing an assembly in the assembly manager
- added a simple PAF import form in the DotplotView and LinearSyntenyView import
  forms
- updated @mui/material version
- clearer output printed when using admin-server

Enjoy!

- [@jbrowse/web@1.0.0](https://github.com/GMOD/jbrowse-components/releases/tag/@jbrowse/web@1.0.0)

To install, you can download the link above, or you can use the jbrowse CLI tool
to automatically download the latest version. See the
[jbrowse 2 quick-start guide](https://jbrowse.org/jb2/docs/quickstart_web) for
more info
