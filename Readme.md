# metalsmith-permalinks

[![npm version][npm-badge]][npm-url]
[![code style: prettier][prettier-badge]][prettier-url]
[![metalsmith: plugin][metalsmith-badge]][metalsmith-url]

[![Build Status][travis-badge]][travis-url]

A Metalsmith plugin that applies a custom permalink pattern to files, and renames them so that they're nested properly for static sites (converting `about.html` into `about/index.html`).

## Installation

    $ npm install metalsmith-permalinks

## Usage

```js
var Metalsmith = require('metalsmith');
var permalinks = require('metalsmith-permalinks');

var metalsmith = new Metalsmith(__dirname).use(
  permalinks({
    pattern: ':title'
  })
);
```

The `pattern` can contain a reference to any piece of metadata associated with the file by using the `:PROPERTY` syntax for placeholders.

If no pattern is provided, the files won't be remapped, but the `path` metadata key will still be set, so that you can use it for outputting links to files in the template.

The `pattern` can also be a set as such:

```js
var Metalsmith = require('metalsmith');
var permalinks = require('metalsmith-permalinks');

var metalsmith = new Metalsmith(__dirname).use(
  permalinks({
    // original options would act as the keys of a `default` linkset,
    pattern: ':title',
    date: 'YYYY',

    // each linkset defines a match, and any other desired option
    linksets: [
      {
        match: { collection: 'blogposts' },
        pattern: 'blog/:date/:title',
        date: 'mmddyy'
      },
      {
        match: { collection: 'pages' },
        pattern: 'pages/:title'
      }
    ]
  })
);
```

#### Dates

By default any date will be converted to a `YYYY/MM/DD` format when using in a permalink pattern, but you can change the conversion by passing a `date` option:

```js
metalsmith.use(
  permalinks({
    pattern: ':date/:title',
    date: 'YYYY'
  })
);
```

It uses [moment.js](http://momentjs.com/docs/#/displaying/format/) to format the string.

#### Custom 'slug' function

If you do not like filenames, you can replace slug function.
For now only js version of syntax is supported and tested.

```js
metalsmith.use(
  permalinks({
    pattern: ':title',
    slug: require('transliteration').slugify
  })
);
```

There are plenty on npm for transliteration and slugs. <https://www.npmjs.com/browse/keyword/transliteration>, better than default slug-component.

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

`relative` can also be set to `folder`, which uses a strategy that considers files in folder as siblings if the folder is named after the html file.

For example using the `folder` strategy with this source directory:

    src/
      post.html
      post/
        image.jpg

Here's what the build directory would look like with `relative` set to `folder`:

    build/
        index.html
        image.jpg

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

#### Slug Options

[slug](https://www.npmjs.com/package/slugify) is used for slugifying strings and it's set to lower-case mode by default.

You can pass custom [slug options](https://www.npmjs.com/package/slugify#options):

```js
metalsmith.use(
  permalinks({
    slug: {
      replacement: '_',
      lower: false
    }
  })
);
```

The following makes everything snake-case but allows `'` to be converted to `-`

```js
metalsmith.use(
  permalinks({
    slug: {
      remove: /[^a-z0-9- ]+/gi,
      lower: true,
      extend: {
        "'": '-'
      }
    }
  })
);
```

#### Overriding the permalink for a file

Using the `permalink` property in a file's front-matter, its permalink can be overridden. This can be useful for transferring
projects over to Metalsmith where pages don't follow a strict permalink system.

For example, in one of your pages:

```js
---
title: My Post
permalink: "posts/my-post"
---
```

#### Overriding the default `index.html` file

Use `indexFile` to define a custom index file.

```js
metalsmith.use(
  permalinks({
    indexFile: 'alt.html'
  })
);
```

#### Ensure files have unique URIs

Use `unique: true` or provide a function to customise the URI when clashes occur.

To automatially add `-1`, `-2`, etc. to the end of the URI to make it unique:

```js
metalsmith.use(
  permalinks({
    unique: true
  }
);
```

Provide your own function to create a unique URI:

```js
metalsmith.use(
  permalinks({
    unique: uniqueFunction
  }
);
```

Where `uniqueFunction` takes the form:

```js
const uniqueFunction = (path, files, filename, options) => {
  return `path/index.html`;
};
```

#### Error when there's a URI conflict

When URI when clashes occur, the build will halt with an error stating the target file conflict.

```js
metalsmith.use(
  permalinks({
    duplicatesFail: true
  }
);
```

_Note_: This will not work if you've provided your own `unique` function.

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

## History

[History](./History.md#Latest)

## License

MIT

[npm-badge]: https://img.shields.io/npm/v/metalsmith-permalinks.svg
[npm-url]: https://www.npmjs.com/package/metalsmith-permalinks
[travis-badge]: https://travis-ci.org/segmentio/metalsmith-permalinks.svg?branch=master
[travis-url]: https://travis-ci.org/segmentio/metalsmith-permalinks
[prettier-badge]: https://img.shields.io/badge/code_style-prettier-ff69b4.svg
[prettier-url]: https://github.com/prettier/prettier
[metalsmith-badge]: https://img.shields.io/badge/metalsmith-plugin-green.svg?longCache=true
[metalsmith-url]: http://metalsmith.io
