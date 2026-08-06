The full app holds **multiple views in one session** — the thing the lighter
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/) can't
do. Each `views` entry becomes its own stacked view with an independent toolbar
and track selector, and the menu bar's **Add** menu opens more at runtime.

Here a whole-genome `CircularView` overviews the structural-variant calls and a
`LinearGenomeView` below shows read-level detail — the same `<JBrowse>` as the
[basic example](../basic-example/) with two entries instead of one.

Views stack vertically by default. There is also a **workspaces** mode
(`session.setUseWorkspaces(true)`) that tiles them into a tabbed dockview
layout; its session-spec `layout` syntax is under
[Tiled views / Workspaces](https://jbrowse.org/jb2/docs/urlparams/#tiled-views--workspaces).
