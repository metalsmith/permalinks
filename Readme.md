
# metalsmith-permalinks

  A Metalsmith plugin that applies a custom permalink pattern to files, and renames them so that they're nested properly for static sites (converting `about.html` into `about/index.html`).

## Installation

    $ npm install metalsmith-permalinks

## Usage

```js
var Metalsmith = require('metalsmith');
var permalinks = require('metalsmith-permalinks');

var metalsmith = new Metalsmith(__dirname)
  .use(permalinks({
    pattern: ':title'
  }));
```

  The `pattern` can contain a reference to any piece of metadata associated with the file by using the `:PROPERTY` syntax for placeholders.

  If no pattern is provided, the files won't be remapped, but the `path` metadata key will still be set, so that you can use it for outputting links to files in the template.

  The `pattern` can also be a set as such:

```js
var Metalsmith = require('metalsmith');
var permalinks = require('metalsmith-permalinks');

var metalsmith = new Metalsmith(__dirname)
  .use(permalinks({
      // original options would act as the keys of a `default` linkset, 
      pattern: ':title',
      date: 'YYYY',

      // each linkset defines a match, and any other desired option
      linksets: [{
          match: { collection: 'blogposts' },
          pattern: 'blog/:date/:title',
          date: 'mmddyy'
      },{
          match: { collection: 'pages' },
          pattern: 'pages/:title'
      }]
  }));
```

#### Dates

  By default any date will be converted to a `YYYY/MM/DD` format when using in a permalink pattern, but you can change the conversion by passing a `date` option:

```js
metalsmith.use(permalinks({
  pattern: ':date/:title',
  date: 'YYYY'
}));
```

  It uses [moment.js](http://momentjs.com/docs/#/displaying/format/) to format the string.

#### Relative Files

  When this plugin rewrites your files to be permalinked properly, it will also duplicate sibling files so that relative links like `/images/cat.gif` will be preserved nicely. You can turn this feature off by setting the `relative` option to `false`.

  For example for this source directory:

    src/
      css/
        style.css
      post.html

  Here's what the build directory would look like with `relative` on:

    build/
      post/
        index.html
        css/
          style.css
      css/
        style.css

  And here's with `relative` off:

    build/
      post/
        index.html
      css/
        style.css

#### Deleting original subdirectories

  If you have `relative` option enabled, and your directory names do not match the folder name outputted based on the `pattern` parameter,
  you will end up with a folder of the original child assets, as well as duplicates in the renamed folder.

  `flatten` is off by default, and only works if `relative` is on. It also does not work on files at the root directory level.

  For example for this source directory:

    src/
      entries/
        article/
          content.html
          supportingImage.jpg

  Here's what the build directory would look like with `pattern: ':date/:title'`, and `flatten` off:

    build/
      entries/
        article/
          supportingImage.jpg
        2017/
          02/
            08/
              article/
                index.html
                supportingImage.jpg

  And here's with `flatten` on:

      build/
        entries/
          2017/
            02/
              08/
                article/
                  index.html
                  supportingImage.jpg

#### Skipping Permalinks for a file

  A file can be ignored by the metalsmith-permalinks plugin if you pass the `permalink: false` option to the yaml metadata of a file.
  This is useful for hosting a static site on AWS S3, where there is a top level `error.html` file and not an `error/index.html` file.

  For example, in your error.md file:

  ```js
  ---
  template: error.html
  title: error
  permalink: false
  ---
  ```

#### CLI

  You can also use the plugin with the Metalsmith CLI by adding a key to your `metalsmith.json` file:

```json
{
  "plugins": {
    "metalsmith-permalinks": {
      "pattern": ":title"
    }
  }
}
```

## License

  MIT
