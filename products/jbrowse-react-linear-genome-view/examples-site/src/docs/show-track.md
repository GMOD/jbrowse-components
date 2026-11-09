`useCreateViewState` keeps one engine across parent re-renders and destroys it
on unmount; use it over `<LinearGenomeView>` when you read the engine while
rendering, as the button here does.
