---
id: job
title: Job
sidebar_label: Widget -> Job
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`jobs-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/jobs-management/src/JobsListWidget/jobModel.ts).

## Overview

## Members

| Member                                         | Kind       | Defined by | Description |
| ---------------------------------------------- | ---------- | ---------- | ----------- |
| [name](#property-name)                         | Properties | Job        |             |
| [statusMessage](#volatile-statusmessage)       | Volatiles  | Job        |             |
| [progressPct](#volatile-progresspct)           | Volatiles  | Job        |             |
| [setCancelCallback](#action-setcancelcallback) | Actions    | Job        |             |
| [setStatusMessage](#action-setstatusmessage)   | Actions    | Job        |             |
| [setProgressPct](#action-setprogresspct)       | Actions    | Job        |             |

<details>
<summary>Job - Properties</summary>

#### property: name

```ts
// type signature
type name = ISimpleType<string>
// code
name: types.string
```

</details>

<details>
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

<details>
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
