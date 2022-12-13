---
id: bcc2020_embedding_jbrowse_08_default_session
title: Creating a default session
---

:::danger Out of date

Please see the
[updated version of this tutorial](/docs/tutorials/embed_linear_genome_view/01_introduction).

:::

## What is a session?

A session is a way to define what the state of the view is. By providing a
default session, you can have tracks already open when the view loads, have the
overview hidden, or set any other aspect of the state.

:::tip

If you provide "location" when constructing the view, it will override the
location defined in the defaultSession.

:::

## What does a session look like?

To provide a default session, pass an object like this to `defaultSession` in
the view constructor:

```javascript
{
  name: 'aNameHere', // what the name is doesn't really matter
  view: {/* view state here */},
}
```

So how do we get the view state?

## Getting the view state

The state can be gotten by JSON stringifying the view's view attribute. We're
going to add a button to our page that will show the current view state when
clicked. Update "index.html" like this:

```html {34-37,39-40} title="index.html"
<html>
  <head>
    <script src="//s3.amazonaws.com/jbrowse.org/jb2_releases/jbrowse-linear-view/jbrowse-linear-view@v0.0.1-beta.0/umd/jbrowse-linear-view.js"></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear View!</h1>
    <button data-type="gene_button" data-location="10:94762681..94855547">
      CYP2C19
    </button>
    <button data-type="gene_button" data-location="13:32315086..32400266">
      BRCA2
    </button>
    <div id="jbrowse_linear_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const genomeView = new JBrowseLinearView({
        container: document.getElementById('jbrowse_linear_view'),
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
      })

      function navTo(event) {
        genomeView.view.navToLocString(event.target.dataset.location)
      }
      const buttons = document.getElementsByTagName('button')
      for (const button of buttons) {
        if (button.dataset.type === 'gene_button') {
          button.addEventListener('click', navTo)
        }
      }
      const textArea = document.getElementById('viewstate')
      document.getElementById('showviewstate').addEventListener('click', () => {
        textArea.innerHTML = JSON.stringify(genomeView.view, undefined, 2)
      })
    </script>
    <button id="showviewstate">Show view state</button>
    <textarea id="viewstate" name="viewstate" rows="20" cols="80"></textarea>
  </body>
</html>
```

Now you can navigate around the view and then click "Show view state" to show
the current state of the view. This object can be used in the "view" of the
defaultSession to have the view show up in this state when loaded. Play around
with the view and see what in the view state changes when you do certain things.

Some of the view state entries are:

- `bpPerPx` - This is a zoom level. A smaller number is more zoomed in.
- `displayedRegions` - The extent of the areas currently in view. By default it
  will be the full extent of a single chromosome, but you can add multiple
  regions, have the regions cover only part of a chromosome, reverse the
  regions, etc.
- `hideHeader` - Whether or not the header is hidden.
