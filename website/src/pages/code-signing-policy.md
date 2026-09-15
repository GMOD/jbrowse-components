---
layout: '../layouts/MarkdownLayout.astro'
title: Code signing policy
description:
  Who signs the JBrowse Desktop downloads, who approves each release, and what
  the app sends over the network.
---

# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io),
certificate by [SignPath Foundation](https://signpath.org).

A GitHub Actions workflow in
[GMOD/jbrowse-components](https://github.com/GMOD/jbrowse-components) builds
every JBrowse Desktop release and submits that build for signing. No binary is
signed from a developer's machine.

## What carries a signature

- **Windows**: the installer, and the `jbrowse-desktop.exe` it installs, are
  signed with a certificate issued to SignPath Foundation, which is therefore
  the publisher Windows names.
- **macOS**: the `.dmg` and `.zip` are signed with an Apple Developer ID held by
  the Evolutionary Software Foundation, then notarized and stapled by Apple.
- **Linux**: the AppImage carries no signature.

JBrowse Web, the CLI and the embedded React components ship as npm packages and
a zip, none of which carry an Authenticode signature.

## Team roles

- **Committers and reviewers**:
  [GMOD organization members](https://github.com/orgs/GMOD/people). A change
  from anyone outside that group arrives as a pull request, and a member reviews
  it before it merges.
- **Approvers**:
  [GMOD organization owners](https://github.com/orgs/GMOD/people?query=role%3Aowner).
  An owner approves each signing request by hand, and the release waits on that
  approval.

## Privacy policy

The [JBrowse privacy policy](/privacy/) says what JBrowse Desktop reports and
how to turn it off. JBrowse reads your data files directly; they never pass
through a JBrowse server.

JBrowse Desktop is an [Electron](https://www.electronjs.org/) app, and reaches
the network in three places: the usage report the privacy policy describes, the
update check against this repository's GitHub releases (covered by the
[GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)),
and the data files you open.
