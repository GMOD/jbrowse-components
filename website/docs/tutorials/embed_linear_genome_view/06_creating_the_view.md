---
id: 06_creating_the_view
title: Creating the view
---

## Creating the state

We're now ready to create the state of the view in "index.html".

```html {23-31} title="index.html"
<html>
  <head>
    <script
      src="//unpkg.com/react@16/umd/react.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/react-dom@16/umd/react-dom.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.development.js"
      crossorigin
    ></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear Genome View!</h1>
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const { createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView
      const state = new createViewState({
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
      })
    </script>
  </body>
</html>
```

## Rendering

Now that our state is created, we can add the code that renders it into our
page. This is done using React's `createElement` and `render`.

```html {27-28,34-37} title="index.html"
<html>
  <head>
    <script
      src="//unpkg.com/react@16/umd/react.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/react-dom@16/umd/react-dom.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.development.js"
      crossorigin
    ></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear Genome View!</h1>
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const { createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView
      const { createElement } = React
      const { render } = ReactDOM
      const state = new createViewState({
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
      })
      render(
        createElement(JBrowseLinearGenomeView, { viewState: state }),
        document.getElementById('jbrowse_linear_genome_view'),
      )
    </script>
  </body>
</html>
```

## Try it out!

You've embedded JBrowse Linear Genome View in a web page! Now try it out. You
can open the track selector by clicking "SELECT TRACKS" or by clicking on the
icon on the far left of the navigation area. You can pan with the arrow buttons
or click and drag to move around. You can change chromosome, enter a location to
navigate to, and zoom in and out. There's also a menu button in the top left of
the view that has other display options. If you open a widget that pops up on
the screen, click anywhere outside it to close the widget.

## Controlling the view

Any action taken in the UI can also be performed programmatically. An instance
of JBrowseLinearView has an attribute called "view" that can be used to control
the state of the view. As an example, we will add some buttons on the page that
navigate to the locations of a couple of genes.

Modify "index.html" so that it looks like the following:

```html {18-23,40-48} title="index.html"
<html>
  <head>
    <script
      src="//unpkg.com/react@16/umd/react.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/react-dom@16/umd/react-dom.development.js"
      crossorigin
    ></script>
    <script
      src="//unpkg.com/@jbrowse/react-linear-genome-view/dist/react-linear-genome-view.umd.development.js"
      crossorigin
    ></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear Genome View!</h1>
    <button data-type="gene_button" data-location="10:94762681..94855547">
      CYP2C19
    </button>
    <button data-type="gene_button" data-location="13:32315086..32400266">
      BRCA2
    </button>
    <div id="jbrowse_linear_genome_view"></div>
    <script type="module">
      import assembly from './assembly.js'
      import tracks from './tracks.js'
      const { createViewState, JBrowseLinearGenomeView } =
        JBrowseReactLinearGenomeView
      const { createElement } = React
      const { render } = ReactDOM
      const state = new createViewState({
        assembly,
        tracks,
        location: '1:100,987,269..100,987,368',
      })
      function navTo(event) {
        state.session.view.navToLocString(event.target.dataset.location)
      }
      const buttons = document.getElementsByTagName('button')
      for (const button of buttons) {
        if (button.dataset.type === 'gene_button') {
          button.addEventListener('click', navTo)
        }
      }
      render(
        createElement(JBrowseLinearGenomeView, { viewState: state }),
        document.getElementById('jbrowse_linear_genome_view'),
      )
    </script>
  </body>
</html>
```

Now you can navigate to a gene just by clicking one of the buttons
