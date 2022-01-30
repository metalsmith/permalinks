# @metalsmith/permalinks

A Metalsmith plugin that applies a custom permalink pattern to files, and renames them so that they're nested properly for static sites (converting `about.html` into `about/index.html`).

[![metalsmith: core plugin][metalsmith-badge]][metalsmith-url]
[![npm: version][npm-badge]][npm-url]
[![ci: build][ci-badge]][ci-url]
[![code coverage][codecov-badge]][codecov-url]
[![license: MIT][license-badge]][license-url]

## Installation

NPM:

```bash
npm install @metalsmith/permalinks
```

Yarn:

```bash
yarn add @metalsmith/permalinks
```

## Usage

```js
const Metalsmith = require('metalsmith')
const permalinks = require('@metalsmith/permalinks')

Metalsmith(__dirname).use(
  permalinks({
    pattern: ':title'
  })
)
```

The `pattern` can contain a reference to any piece of metadata associated with the file by using the `:PROPERTY` syntax for placeholders.

If no pattern is provided, the files won't be remapped, but the `path` metadata key will still be set, so that you can use it for outputting links to files in the template.

The `pattern` can also be set as such:

```js
const Metalsmith = require('metalsmith')
const permalinks = require('@metalsmith/permalinks')

Metalsmith(__dirname).use(
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
)
```

### Optional permalink pattern parts

The pattern option can also contain optional placeholders with the syntax `:PROPERTY?`. If the property is not defined in a file's metadata, it will be replaced with an empty string `''`. For example the pattern `:category?/:title` applied to a source directory with 2 files:

<table>
  <tr>
    <td>
<pre><code>---
title: With category
category: category1
---</pre></code>
    </td>
    <td>
<pre><code>---
title: No category
---</pre></code>
    </td>
  </tr>
</table>

would generate the file tree:

```
build
├── category1/with-category.html
└── no-category.html
```

### Dates

By default any date will be converted to a `YYYY/MM/DD` format when using in a permalink pattern, but you can change the conversion by passing a `date` option:

```js
metalsmith.use(
  permalinks({
    pattern: ':date/:title',
    date: 'YYYY'
  })
)
```

It uses [moment.js](https://momentjs.com/docs/#/displaying/format/) to format the string.

### Slug options

You can finetune how a pattern is processed by providing custom [slug](https://developer.mozilla.org/en-US/docs/Glossary/Slug) options.
By default [slugify](https://www.npmjs.com/package/slugify) is used and patterns will be lowercased.

You can pass custom [slug options](https://www.npmjs.com/package/slugify#options):

```js
metalsmith.use(
  permalinks({
    slug: {
      replacement: '_',
      lower: false
    }
  })
)
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
)
```

#### Handling special characters

If your pattern parts contain special characters like `:` or `=`, specifying `slug.strict` as `true` is a quick way to remove them:

```js
metalsmith.use(
  permalinks({
    slug: {
      lower: true,
      strict: true
    }
  })
)
```

#### Custom 'slug' function

If the result is not to your liking, you can replace the slug function altogether.
For now only the js version of syntax is supported and tested.

```js
metalsmith.use(
  permalinks({
    pattern: ':title',
    slug: require('transliteration').slugify
  })
)
```

There are plenty of other options on npm for transliteration and slugs. <https://www.npmjs.com/browse/keyword/transliteration>.

### Relative Files

When this plugin rewrites your files to be permalinked properly, it will also duplicate sibling files so that relative links like `css/style.css` will be preserved nicely. You can turn this feature off by setting the `relative` option to `false`.

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

### Skipping Permalinks for a file

A file can be ignored by the permalinks plugin if you pass the `permalink: false` option to the yaml metadata of a file.
This is useful for hosting a static site on AWS S3, where there is a top level `error.html` file and not an `error/index.html` file.

For example, in your error.md file:

```js
---
template: error.html
title: error
permalink: false
---
```

### Overriding the permalink for a file

Using the `permalink` property in a file's front-matter, its permalink can be overridden. This can be useful for transferring
projects over to Metalsmith where pages don't follow a strict permalink system.

For example, in one of your pages:

```js
---
title: My Post
permalink: "posts/my-post"
---
```

### Overriding the default `index.html` file

Use `indexFile` to define a custom index file.

```js
metalsmith.use(
  permalinks({
    indexFile: 'alt.html'
  })
)
```

### Ensure files have unique URIs

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
  return `path/index.html`
}
```

### Error when there's a URI conflict

When URI when clashes occur, the build will halt with an error stating the target file conflict.

```js
metalsmith.use(
  permalinks({
    duplicatesFail: true
  }
);
```

_Note_: This will not work if you've provided your own `unique` function.

### Debug

To log debug output, set the `DEBUG` environment variable to `@metalsmith/permalinks`:

Linux/Mac:

```bash
DEBUG=@metalsmith/permalinks
```

Windows:

```batch
set "DEBUG=@metalsmith/permalinks"
```

### CLI usage

To use this plugin with the Metalsmith CLI, add `@metalsmith/permalinks` to the `plugins` key in your `metalsmith.json` file:

```json
{
  "plugins": [
    {
      "permalinks": {
        "pattern": ":title"
      }
    }
  ]
}
```

## License

[MIT](LICENSE)

[npm-badge]: https://img.shields.io/npm/v/@metalsmith/permalinks.svg
[npm-url]: https://www.npmjs.com/package/@metalsmith/permalinks
[ci-badge]: https://app.travis-ci.com/metalsmith/permalinks.svg?branch=master
[ci-url]: https://app.travis-ci.com/github/metalsmith/permalinks
[metalsmith-badge]: https://img.shields.io/badge/metalsmith-plugin-green.svg?longCache=true
[metalsmith-url]: https://metalsmith.io/
[codecov-badge]: https://img.shields.io/coveralls/github/metalsmith/permalinks
[codecov-url]: https://coveralls.io/github/metalsmith/permalinks
[license-badge]: https://img.shields.io/github/license/metalsmith/permalinks
[license-url]: LICENSE
