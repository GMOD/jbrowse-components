---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/model.tsx).

## Overview

Internet account that authenticates requests with a user-supplied external
token, prompting for the token via a dialog and optionally validating it with a
HEAD request. See [TokenEntryInternetAccount](../tokenentryinternetaccount) for
the shared behavior.

### ExternalTokenInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/externaltokeninternetaccount).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [TokenEntryInternetAccount](../tokenentryinternetaccount)

**Properties:** [type](../tokenentryinternetaccount#property-type),
[configuration](../tokenentryinternetaccount#property-configuration)

**Getters:**
[validateWithHEAD](../tokenentryinternetaccount#getter-validatewithhead)

**Actions:**
[getTokenFromUser](../tokenentryinternetaccount#action-gettokenfromuser),
[validateToken](../tokenentryinternetaccount#action-validatetoken)
