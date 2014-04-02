
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

#### Dates

  By default any date will be converted to a `YYYY/MM/DD` format when using in a permalink pattern, but you can change the conversion by passing a `date` option:

```js
metalsmith.use(permalinks({
  pattern: ':date/:title',
  date: 'YYYY'
}));
```
  
  It uses [moment.js](http://momentjs.com/docs/#/displaying/format/) to format the string.

#### Relative linking

  By default sibling files and directories of a permalinked html file will be
  copied into the new permalink directory. This is an example of a ```src``` 
  and ```build``` directories with relative file copying.

```
$ ls -R src/
post.html css

src/css:
style.css

$ ls -R build/
post css

build/post:
index.html css

build/post/css:
style.css

build/css:
style.css
```

  To disable this behaviour, you may pass ```relative: false``` in the options.
  The resulting build directory with ```relative: false``` would look like 
  this:

```
$ ls -R build/
post css

build/post:
index.html

build/css:
style.css
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
