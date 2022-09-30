---
id: 01_introduction
title: Introduction
toplevel: true
---

import Figure from '../../figure'

JBrowse 2 plugins can be used to add new pluggable elements (views, tracks,
adapters, etc), and to modify behavior of the application by adding code that
watches the application's state.

For the full list of what kinds of pluggable element types plugins can add, see the [pluggable elements](../../../developer_guide/#pluggable-elements) page.

The following tutorial will walk you through establishing your developer environment,
spinning up a plugin, and running a local JBrowse instance with your custom plugin functionality.

## Prerequisites

- git
- A stable and recent version of [node](https://nodejs.org/en/)
- yarn or npm
- basic familiarity with the command line, React, package management, and npm

Let's get started developing a plugin for JBrowse 2.
