---
id: job
title: Job
sidebar_label: Widget -> Job
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/jobs-management/src/JobsListWidget/jobModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/Job.md)

## Overview

### Job - Properties

#### property: name

```js
// type signature
ISimpleType<string>
// code
name: types.string
```

### Job - Volatiles

#### volatile: statusMessage

```js
// type signature
string | undefined
// code
statusMessage: undefined as string | undefined
```

#### volatile: progressPct

```js
// type signature
number
// code
progressPct: 0
```

### Job - Actions

#### action: setCancelCallback

```js
// type signature
setCancelCallback: (cancelCallback: () => void) => void
```

#### action: setStatusMessage

```js
// type signature
setStatusMessage: (message?: string | undefined) => void
```

#### action: setProgressPct

```js
// type signature
setProgressPct: (pct: number) => void
```
