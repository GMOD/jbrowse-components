The full app can hold **multiple views in one session** at the same time, the
capability the lighter
[`@jbrowse/react-linear-genome-view2`](https://jbrowse.org/storybook/lgv/)
component doesn't have. Each entry in the `views` prop becomes its own stacked
view with an independent toolbar and track selector, and the menu bar's **Add**
menu can open more at runtime.

Here a whole-genome
[`CircularView`](https://jbrowse.org/jb2/docs/models/circularview/) gives an
overview of the structural-variant calls, and a
[`LinearGenomeView`](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
below it shows the read-level detail. The two views are independent. This is the
same declarative `<JBrowse>` component as the
[basic example](../basic-example/), just with two entries in `views` instead of
one.
