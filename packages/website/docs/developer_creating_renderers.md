---
id: developer_creating_renderers
title: Creating custom renderers
---

### What is a renderer

A JBrowse 2 renderer is a specific concept that is new in JBrowse 2, and it
is conceptually related to "server side rendering".

In JBrowse 1, a track type typically would directly call the data parser (in
jbrowse 1 terms storeClass) and do the drawing

In JBrowse 2, a track type is a lighter weight container, and

With our renderers, we actually
commonly use a web-worker as the "server side", but it is helpful to think
similar to React SSR, and indeed, the renderer concept can apply to being run
on a remote server also.
In JBrowse 2 the track calls the renderer using an RPC call to the renderer.
When it calls the renderer, it serializes and deserializes all of it's
arguments, because it doesn't share memory with the RPC backend e.g. the
webworker. All data is shared by serializing the data from a renderer function
call

Here is a conceptual diagram of how a track calls a renderer using the RPC

![Renderer workflow](../img/renderer.png)

Important note: you can make custom tracks types that do not use this workflow,
but it is a built in workflow that works well for the core track types in
JBrowse 2.

### How to create a new renderer

We will review
