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

By default `@metalsmith/permalinks` moves all HTML source files at `:dirname?/:basename` to the build as `:dirname/:basename/index.html` and adds [a customizable `permalink` property](#customizing-permalinks) to te file metadata. You can tweak [which files to `match`](#matching-files), set [fixed permalinks](#fixed-permalinks), use a permalink `pattern` with `:placeholder`'s that will be read from the file's metadata, and finetune how that metadata and the final permalink are formatted as a string through the `directoryIndex`, `slug`, `date` and `trailingSlash` options.

Fixed permalinks or permalink patterns can be defined in file front-matter, or for a set of files through plugin options. Permalink patterns defined in file front-matter take precedence over plugin options.

```js
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import Metalsmith from 'metalsmith'
import permalinks from '@metalsmith/permalinks'

const __dirname = dirname(fileURLToPath(import.meta.url))

// defaults
Metalsmith(__dirname).use(permalinks())

// explicit defaults
Metalsmith(__dirname).use(
  permalinks({
    // files to target
    match: '**/*.html',
    // permalink pattern with placeholders
    pattern: ':dirname?/:basename',
    // how to format Date values when substituting pattern parts
    date: {
      format: 'YYYY/MM/DD',
      locale: 'en-US' // only relevant if you use textual date part formats
    },
    // how to postprocess a resolved permalink in a URL (and filesystem)-friendly way
    slug: {
      lowercase: true,
      remove: /[<>:"\'|?*]|[^\\w\\s$_+~.()!\\-@\\/]+/g,
      extend: { ':': '-', '|': '-', '/': '-', '<': '', '>': '' }
    },
    trailingSlash: false,
    directoryIndex: 'index.html',
    // throw an error when 2 files have the same target permalink
    duplicates: 'error',
    // additional linksets
    linksets: []
  })
)
```

Every `permalinks()` instantiation supports the following options:

- directoryIndex - traditionally `index.html`, but servers could be configured with alternatives. See [Overriding the default index.html file](#overriding-the-default-indexhtml-file)
- trailingSlash - whether to add a trailing `/` so that the permalink becomes `blog/post/` instead of `blog/post`. Useful to avoid redirects on servers which do not have a built-in rewrite module enabled.
- duplicates - what to do when 2 files have the same target destination. See [Ensure files have unique URI's](#ensure-files-have-unique-uris)
- linksets, see [Defining linksets](#defining-linksets)

Placeholder substitution will always `toString` the value. For example, when you have an `:array` placeholder and a file with front-matter `array: ['one','two']`, it will substitute into `'onetwo'`, but you can refer to the n<sup>th</sup> value with a dot-delimited keypath (eg `:array.0`). A boolean `false` will result in an error unless the placeholder is optional (it would then be an empty string = omitted), a boolean `true` will result in the string `'true'`.

### Matching files

The `match` option can be 1 or multiple glob patterns, or an object with key-value pairs that will be matched on _either... or..._ basis.

```js
// only match non-root html files
metalsmith.use(permalinks({ match: '*/**/*.html' }))

// match templates so you can use the permalink property in @metalsmith/layouts later
metalsmith.use(permalinks({ match: '**/*.hbs' }))

// match files that are either primary:false or have id:1
metalsmith.use(permalinks({ match: { primary: false, id: 1 } }))
```

If a `match` object property targets an array in file metadata, it will be matched if the array contains the value in the `match` object.

### Defining linksets

Whereas the default `match` option globally defines which files are permalinked, additional `linksets` can be defined with their own `match`, `pattern`, `date` and `slug` options.

```js
metalsmith.use(
  permalinks({
    // original options act as the keys of a `default` linkset,
    pattern: ':dirname?/:basename',
    date: 'YYYY',

    // each linkset defines a match, and any other desired option
    linksets: [
      {
        match: { collection: 'blogposts' },
        pattern: 'blog/:date/:title',
        date: 'MM-DD-YYYY'
      },
      {
        match: { collection: 'pages' },
        pattern: 'pages/:title'
      }
    ]
  })
)
```

Every matched file is only permalinked once, even if it is matched by multiple linksets. The linksets defined in `linksets` take precedence over the default match, and the first linkset in `linksets` takes precedence over the next. In the example above, a file which has `collection: ['pages','blogposts']` would be permalinked to `blog/:date/:title`.

### Fixed permalinks

You can declare a fixed permalink in file front-matter:

```yml
---
# src/topic_metalsmith.html
permalink: topics/static-site/metalsmith
---
```

`@metalsmith/permalinks` will move the source file `topic_metalsmith.html` to the build path `topics/static-site/metalsmith/index.html` and add `permalink: 'topics/static-site/metalsmith'` to the file metadata.
Setting an explicit front-matter permalink overrides any other `match` that also matched the file from plugin options.

_Typical use case: SEO-sensitive links that should be preserved, even if you moved or renamed the file or updated its front-matter._

### Computed permalinks

File permalinks can be computed from other (own) file metadata properties.

```yml
---
# src/topic_metalsmith.html
topic: static-site
subtopic: metalsmith
permalink: topics/:topic/:subtopic
---
```

Just like the previous example, this will also move the source file `topic_metalsmith.html` to the build path `topics/static-site/metalsmith/index.html` and add `permalink: 'topics/static-site/metalsmith'` to the file metadata.

Placeholders can also refer to a keypath within the front-matter `permalink` or plugin option linkset, e.g. `permalink: blog/:postData.html.slug`.

### Skipping permalinks

An otherwise linkset-matched file can be excluded from permalinking by setting `permalink: false` in its front-matter:

```yaml
---
title: error
permalink: false
---
```

Explicitly disabling a permalink in front-matter overrides any other pattern that also matched the file from plugin options.

_Typical use case: hosting static sites on third-party providers with specific conventions, e.g. on AWS S3 there must be a top level `error.html` file and not an `error/index.html` file._

### Customizing permalinks

The `pattern` can contain a reference to **any piece of metadata associated with the file** by using the `:PROPERTY` syntax for placeholders.
By default, all files get a `:dirname?/:basename` (+ directoryIndex = `/index.html`) pattern, i.e. the original filepath `blog/post1.html` becomes `blog/post1/index.html`. The `dirname` and `basename` values are automatically made available by @metalsmith/permalinks for the purpose of generating the permalink.

If you want to tweak how the characters in the permalink are transformed (for example to handle unicode & non-ascii characters),see [slug options](#slug-options).

The `pattern` can also be set as such:

```js
metalsmith.use(
  permalinks({
    // original options act as the keys of a `default` linkset,
    pattern: ':title',
    date: 'YYYY',

    // each linkset defines a match, and any other desired option
    linksets: [
      {
        match: { collection: 'blogposts' },
        pattern: 'blog/:date/:title',
        date: 'MM-DD-YYYY'
      },
      {
        match: { collection: 'pages' },
        pattern: 'pages/:title'
      }
    ]
  })
)
```

#### Optional permalink pattern parts

The permalink example in [Computed permalinks](#computed-permalinks) would result in an error if `subtopic` or `topic` were not defined. To allow this add a question mark to the placeholder like `:topic/:subtopic?`. If the property is not defined in a file's metadata, it will be replaced with an empty string `''`. For example the pattern `:category?/:title` applied to a source directory with 2 files:

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
├── category1/with-category/index.html
└── no-category/index.html
```

#### Date formatting

By default any date will be converted to a `YYYY/MM/DD` format when using in a permalink pattern, but you can change the conversion by passing a `date` option:

```js
metalsmith.use(
  permalinks({
    pattern: ':date/:title',
    date: 'YYYY'
  })
)
```

Starting from v3 `@metalsmith/permalinks` no longer uses moment.js. A subset of date-formatting tokens relevant to site URI's are made available that are largely compatible with those defined at [moment.js](https://momentjs.com/docs/#/displaying/format/):

| Token | Description                 | Examples                   |
| ----- | --------------------------- | -------------------------- |
| D     | Date numeric                | 1 2 ... 30 31              |
| DD    | Date numeric zero-padded    | 01 02 ... 30 31            |
| d     | Day of week numeric         | 0 1 ... 5                  |
| dd    | Day of week 2-letter (\*)   | Su Mo ... Sa               |
| ddd   | Day of week short (\*)      | Sun Mon ... Sat            |
| dddd  | Day of week long (\*)       | Sunday Monday ... Saturday |
| M     | Month numeric               | 1 2 ... 11 12              |
| MM    | Month numeric zero-padded   | 01 02 ... 11 12            |
| MMM   | Month short (\*)            | Jan, Feb                   |
| MMMM  | Month full (\*)             | January, February          |
| Q     | Quarter                     | 1 2 3 4                    |
| YY    | Year 2 last digits          | 70, 24                     |
| YYYY  | Year full                   | 1970, 2024                 |
| W     | Week of year                | 1 2 ... 51 52              |
| WW    | Week of year zero-padded    | 01 02 ... 51 52            |
| x     | Unix milliseconds timestamp | 1697401520387              |
| X     | Unix timestamp              | 1697401520                 |

Tokens marked with (\*) use the [Node.js Intl API](https://nodejs.org/api/intl.html) which is not available by default in every Node.js distribution.  
The `date` option can be a string of date-formatting tokens and will default to `en-US` for the locale, or an object in the format `{ format: 'YYYY', locale: 'en-US' }`. However, if your Node.js distribution does not have support for the Intl API, or the locale you specified is missing, the build will throw an error.

If you need more customization you can also pass a date formatting function:

```js
metalsmith.use(
  permalinks({
    pattern: ':date',
    // will result in sun/jan/01/2024/index.html for date 2024-01-01
    date(value) {
      return value.toDateString().toLowerCase().replace(/\W/g, '/')
    }
  })
)
```

#### Slug options

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

#### Custom 'slug' function

If the result is not to your liking, you can replace the slug function altogether.
For now only the js version of syntax is supported and tested.

```js
import { slugify } from 'transliteration'

metalsmith.use(
  permalinks({
    pattern: ':title',
    slug: slugify
  })
)
```

There are plenty of other options on npm for transliteration and slugs. <https://www.npmjs.com/browse/keyword/transliteration>.

### Overriding the default `index.html` file

Use `directoryIndex` to define a custom index file.

```js
metalsmith.use(
  permalinks({
    directoryIndex: 'alt.html'
  })
)
```

Use an empty `directoryIndex` to create _extensionless_ files that can be accompanied by a matching Content-Type Response header with a server like Apache or Nginx, so you could call `https://mysite.com/api/plugins` supposing you have files at `src/api/plugins.json`

```js
metalsmith.use(
  permalinks({
    match: '**/*.json',
    directoryIndex: ''
  })
)
```

### Ensure files have unique URIs

Normally you should take care to make sure your source files do not permalink to the same target.  
When URI clashes occur nevertheless, the build will halt with an error stating the target file conflict.

```js
metalsmith.use(
  permalinks({
    duplicates: 'error'
  })
)
```

There are 3 other possible values for the `duplicates` option: `index` will add an `-<index>` suffix to other files with the same target URI, `overwrite` will silently overwrite previous files with the same target URI.

The third possibility is to provide your own function to handle duplicates, with the signature:

```js
function paginateDupes(targetPath, files, filename, options) => {
  let target,
    counter = 0,
    postfix = ''
  while (files[target]) {
    postfix = `/${++counter}`
    target = path.join(`${targetPath}${postfix}`, options.indexFile)
  }
  return target
}
```

Return an error in the custom duplicates handler to halt the build.  
The example above is a variant of the `index` value, where 2 files targeting the URI `gallery` will be written to `gallery/1/index.html` and `gallery/2/index.html`.

_Note_: The `duplicates` option combines the `unique` and `duplicatesFail` options of version < 2.4.1. Specifically, `duplicatesFail:true` maps to `duplicates:'error'`, `unique:true` maps to `duplicates:'index'`, and `unique:false` or `duplicatesFail:false` map to `duplicates:'overwrite'`.

### Maintaining relative links

Previously this plugin had a `relative: true` option that allowed one to transform a file structure such as:

```txt
|_ posts
    |_ hello-world.html
    |_ post-image.png
```

into

```txt
|_ posts
    |_ hello-world
    |   |_ index.html
    |   |_ post-image.png
    |_ post-image.png
```

This allowed users to reference post-image.png as `<img src="./post-image.png">`, but also duplicated the asset and resulted in other unexpected side-effects.
Our advice is to keep your media in an `assets` or similar folder that does not undergo path transforms, and reference it with a root-relative URI (eg `/assets/hello-world/post-image.png`). If this is not an option for you, the better way to structure your source folder is to have the source path of the referencing HTML file equal to its destination permalink:

```txt
|_ posts
    |_ hello-world
        |_ index.html
        |_ post-image.png
```

### Migrating from v2 to v3

The v2 -> v3 update had a lot of breaking changes, but the good news is v3 can do all that v2 did, just a bit differently, and more. v3 is less forgiving (and more predictable) in that it will throw errors when a (required) `:placeholder` resolves to an undefined value.

Previously permalinks would omit that pattern part so that a `my-post.html` with pattern `:category/:title` and `title: My post` but without a defined category would be output to `blog/my-post/index.html`. To preserve this behavior, make the failing `:placeholder?` optional by adding a question mark.

The `indexFile` option has been renamed to `directoryIndex`.
The options `duplicatesFail` and `unique` have been condensed into `duplicates`, see also [Ensure files have unique URI's](#ensure-files-have-unique-uris).

### Debug

To enable debug logs, set the `DEBUG` environment variable to `@metalsmith/permalinks`:

```js
metalsmith.env('DEBUG', '@metalsmith/permalinks*')
```

Alternatively you can set `DEBUG` to `@metalsmith/*` to debug all Metalsmith core plugins.

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
[ci-badge]: https://github.com/metalsmith/permalinks/actions/workflows/test.yml/badge.svg
[ci-url]: https://github.com/metalsmith/permalinks/actions/workflows/test.yml
[metalsmith-badge]: https://img.shields.io/badge/metalsmith-plugin-green.svg?longCache=true
[metalsmith-url]: https://metalsmith.io/
[codecov-badge]: https://img.shields.io/coveralls/github/metalsmith/permalinks
[codecov-url]: https://coveralls.io/github/metalsmith/permalinks
[license-badge]: https://img.shields.io/github/license/metalsmith/permalinks
[license-url]: LICENSE
