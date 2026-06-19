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

<details open>
<summary>Job - Properties</summary>

#### property: name

```ts
// type signature
type name = ISimpleType<string>
// code
name: types.string
```

</details>

<details open>
<summary>Job - Volatiles</summary>

#### volatile: statusMessage

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
```

#### volatile: progressPct

```ts
// type signature
type progressPct = number
// code
progressPct: 0
```

</details>

<details open>
<summary>Job - Actions</summary>

#### action: setCancelCallback

```ts
type setCancelCallback = (cancelCallback: () => void) => void
```

#### action: setStatusMessage

```ts
type setStatusMessage = (message?: string | undefined) => void
```

#### action: setProgressPct

```ts
type setProgressPct = (pct: number) => void
```

</details>
