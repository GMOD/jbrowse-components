`view` is read once, when the view is created: re-rendering with a different
`loc` does not move it. To drive the view afterwards, take a `ref` and call its
[navigation actions](../external-navigate/).
