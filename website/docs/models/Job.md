---
id: job
title: Job
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

#### property: statusMessage

```js
// type signature
IMaybe<ISimpleType<string>>
// code
statusMessage: types.maybe(types.string)
```

#### property: progressPct

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
progressPct: types.optional(types.number, 0)
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
