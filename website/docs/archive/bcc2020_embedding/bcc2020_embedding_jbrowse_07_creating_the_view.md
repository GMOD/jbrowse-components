---
id: bcc2020_embedding_jbrowse_07_creating_the_view
title: Creating the view
---

:::danger Out of date

Please see the
[updated version of this tutorial](/docs/tutorials/embed_linear_genome_view/01_introduction).

:::

## Adding the constructor

We're now ready to add the JBrowse Linear View constructor to "index.html".

```html {12-17} title="index.html"
<html>
  <head>
    <script src="//s3.amazonaws.com/jbrowse.org/jb2_releases/jbrowse-linear-view/jbrowse-linear-view@v0.0.1-beta.0/umd/jbrowse-linear-view.js"></script>
  </head>

  <body>
    <h1>We're using JBrowse Linear View!</h1>
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
    </script>
  </body>
</html>
```

## Try it out!

You've embedded JBrowse Linear View in a web page! Now try it out. You can open
the track selector by clicking "SELECT TRACKS" or by clicking on the icon on the
far left of the navigation area. You can pan with the arrow buttons or click and
drag to move around. You can change chromosome, enter a location to navigate to,
and zoom in and out. There's also a menu button in the top left of the view that
has other display options.

## Controlling the view

Any action taken in the UI can also be performed programmatically. An instance
of JBrowseLinearView has an attribute called "view" that can be used to control
the state of the view. As an example, we will add some buttons on the page that
navigate to the locations of a couple of genes.

Modify "index.html" so that it looks like the following:

```html {8-13,24-33} title="index.html"
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
    </script>
  </body>
</html>
```

Now you can navigate to a gene just by clicking one of the buttons
