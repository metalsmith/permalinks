import path from 'path'
import moment from 'moment'
import slugify from 'slugify'
import * as route from 'regexparam'

const dupeHandlers = {
  error(targetPath, filesObj, filename, opts) {
    const target = path.join(targetPath, opts.directoryIndex)
    const currentBaseName = path.basename(filename)

    if (filesObj[target] && currentBaseName !== opts.directoryIndex) {
      return new Error(`Permalinks: Clash with another target file ${target}`)
    }
    return target
  },
  index(targetPath, filesObj, filename, opts) {
    let target,
      counter = 0,
      postfix = ''
    do {
      target = path.join(`${targetPath}${postfix}`, opts.directoryIndex)
      postfix = `-${++counter}`
    } while (filesObj[target])
    return target
  },
  overwrite(targetPath, filesObj, filename, opts) {
    return path.join(targetPath, opts.directoryIndex)
  }
}

/**
 * [Slugify options](https://github.com/simov/slugify#options)
 *
 * @typedef {Object} SlugifyOptions
 * @property {boolean} extend extend known unicode symbols with a `{'char': 'replacement'}` object
 * @property {string} [replacement='-'] replace spaces with replacement character, defaults to `-`
 * @property {RegExp} [remove] remove characters that match regex
 * @property {boolean} [lower=true] convert to lower case, defaults to `true`
 * @property {boolean} [strict=false] strip special characters except replacement, defaults to `false`
 * @property {string} [locale] language code of the locale to use
 * @property {boolean} trim trim leading and trailing replacement chars, defaults to `true`
 */

/**
 * @callback slugFunction
 * @param {string} filepath
 * @returns {string} slug
 */

/**
 * Linkset definition
 *
 * @typedef {Object} Linkset
 * @property {boolean} [isDefault] Whether this linkset should be used as the default instead
 * @property {Object.<string,*>} match An object whose key:value pairs will be used to match files and transform their permalinks according to the rules in this linkset
 * @property {string} pattern A permalink pattern to transform file paths into, e.g. `blog/:date/:title`
 * @property {SlugifyOptions|slugFunction} [slug] [Slugify options](https://github.com/simov/slugify) or a custom slug function of the form `(pathpart) => string`
 * @property {string} [date='YYYY/MM/DD'] [Moment.js format string](https://momentjs.com/docs/#/displaying/format/) to transform Date link parts into, defaults to `YYYY/MM/DD`.
 */

/**
 * `@metalsmith/permalinks` options & default linkset
 *
 * @typedef {Object} Options
 * @property {string} [pattern] A permalink pattern to transform file paths into, e.g. `blog/:date/:title`
 * @property {string} [date='YYYY/MM/DD'] [Moment.js format string](https://momentjs.com/docs/#/displaying/format/) to transform Date link parts into, defaults to `YYYY/MM/DD`.
 * @property {boolean|'folder'} [relative=true] _**[DEPRECATED]** - _will be defaulted to false and removed in the next major version_. When `true` (by default), will duplicate sibling files so relative links keep working in resulting structure. Turn off by setting `false`. Can also be set to `folder`, which uses a strategy that considers files in folder as siblings if the folder is named after the html file.
 * @property {string} [indexFile='index.html'] _**[DEPRECATED]** - _renamed to directoryIndex_. Basename of the permalinked file (default: `index.html`)
 * @property {string} [directoryIndex='index.html'] Basename of the permalinked file (default: `index.html`)
 * @property {boolean} [trailingSlash=false] Whether a trailing `/` should be added to the `file.permalink` property. Useful to avoid redirects on servers which do not have a built-in rewrite module enabled.
 * @property {boolean|Function} [unique] **[DEPRECATED]** - _use `duplicates` option instead_. Set to `true` to add a number to duplicate permalinks (default: `false`), or specify a custom duplicate handling callback of the form `(permalink, files, file, options) => string`
 * @property {boolean} [duplicatesFail=false] **[DEPRECATED]** - _use `duplicates` option instead_. Set to `true` to throw an error if multiple file path transforms result in the same permalink. `false` by default
 * @property {'error'|'index'|'overwrite'|Function} [duplicates] How to handle duplicate target URI's.
 * @property {Linkset[]} [linksets] An array of additional linksets
 * @property {SlugifyOptions|slugFunction} [slug] {@link SlugifyOptions} or a custom slug function of the form `(pathpart) => string`
 */

/** @type {Options} */
const defaultOptions = {
  pattern: null,
  date: 'YYYY/MM/DD',
  slug: { lower: true },
  relative: true,
  indexFile: 'index.html',
  trailingSlash: false,
  unique: false,
  duplicatesFail: false,
  linksets: []
}

const defaultLinkset = {
  date: 'YYYY/MM/DD',
  slug: { lower: true },
  relative: true,
  isDefault: false
}

/**
 * Maps the slugify function to slug to maintain compatibility
 *
 * @param  {String} text
 * @param  {Object} options
 *
 * @return {String}
 */
function slugFn(options = defaultOptions.slug) {
  return (text) => {
    if (typeof options.extend === 'object' && options.extend !== null) {
      slugify.extend(options.extend)
    }

    return slugify(text, Object.assign({}, defaultOptions.slug, options))
  }
}

/**
 * Re-links content
 *
 * @param  {import('metalsmith').File} data
 * @param  {Object} moved
 *
 * @return {Void}
 */
const relink = (data, moved) => {
  let content = data.contents.toString()
  Object.keys(moved).forEach((to) => {
    const from = moved[to]
    content = content.replace(from, to)
  })
  data.contents = Buffer.from(content)
}

/**
 * Check whether a file is an HTML file.
 *
 * @param {string} str The path
 * @return {boolean}
 */
const html = (str) => path.extname(str) === '.html'

/**
 * Return a formatter for a given moment.js format `string`.
 *
 * @param {string} string
 * @return {Function}
 */
const format = (string) => (date) => moment(date).utc().format(string)

const normalizeLinkset = (linkset) => {
  linkset = Object.assign({}, defaultLinkset, linkset)
  linkset.date = format(linkset.date)
  if (typeof linkset.slug !== 'function') {
    linkset.slug = slugFn(linkset.slug)
  }
  return linkset
}

/**
 * Normalize an options argument.
 *
 * @param  {string|Options} options
 * @return {Object}
 */
const normalizeOptions = (options) => {
  if (typeof options === 'string') {
    options = { pattern: options }
  }
  options = normalizeLinkset(Object.assign({}, defaultOptions, options))
  if (Array.isArray(options.linksets)) {
    options.linksets = options.linksets.map(normalizeLinkset)
  }

  if (!options.duplicates) {
    if (options.duplicatesFail) {
      options.duplicates = dupeHandlers.error
    } else if (options.unique === true) {
      options.duplicates = dupeHandlers.index
    } else if (typeof options.unique === 'function') {
      options.duplicates = options.unique
    } else {
      options.duplicates = dupeHandlers.overwrite
    }
  } else if (Object.keys(dupeHandlers).includes(options.duplicates)) {
    options.duplicates = dupeHandlers[options.duplicates]
  }

  if (options.indexFile && !options.directoryIndex) {
    options.directoryIndex = options.indexFile
  }

  return options
}

/**
 * Get a list of sibling and children files for a given `file` in `files`.
 *
 * @param {string} file
 * @param {Object} files
 * @return {Object}
 */
const family = (file, files) => {
  const ret = {}
  let dir = path.dirname(file)

  if (dir === '.') {
    dir = ''
  }

  for (const key in files) {
    /* istanbul ignore next */
    if (key === file) continue
    /* istanbul ignore next */
    if (key.indexOf(dir) !== 0) continue
    /* istanbul ignore next */
    if (html(key)) continue

    const rel = key.slice(dir.length)
    ret[rel] = files[key]
  }

  return ret
}

/**
 * Get a list of files that exists in a folder named after `file` for a given `file` in `files`.
 *
 * @param {string} file
 * @param {Object} files
 * @return {Object}
 */
const folder = (file, files) => {
  const bn = path.basename(file, path.extname(file))
  const family = {}
  let dir = path.dirname(file)

  if (dir === '.') {
    dir = ''
  }

  const sharedPath = path.join(dir, bn, '/')

  for (const otherFile in files) {
    /* istanbul ignore next */
    if (otherFile === file) continue
    /* istanbul ignore next */
    if (otherFile.indexOf(sharedPath) !== 0) continue
    /* istanbul ignore next */
    if (html(otherFile)) continue

    const remainder = otherFile.slice(sharedPath.length)
    family[remainder] = files[otherFile]
  }

  return family
}

/**
 * Resolve a permalink path string from an existing file `path`.
 *
 * @param {String} str The path
 * @return {String}
 */
const resolve = (str, directoryIndex = 'index.html') => {
  const base = path.basename(str, path.extname(str))
  let ret = path.dirname(str)
  if (base !== path.basename(directoryIndex, path.extname(directoryIndex))) {
    ret = path.join(ret, base).replace(/\\/g, '/')
  }

  return ret
}

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {string} pattern (optional)
 * @param {Object} data
 * @param {Object} options
 *
 * @return {Mixed} String or Null
 */
const replace = (pattern, data, options) => {
  if (!pattern) return null
  const { keys } = route.parse(pattern)
  const ret = {}

  for (let i = 0, key; (key = keys[i++]); ) {
    const val = data[key]
    const isOptional = pattern.match(`${key}\\?`)
    if (!val || (Array.isArray(val) && val.length === 0)) {
      if (isOptional) {
        ret[key] = ''
        continue
      }
      return null
    }
    if (val instanceof Date) {
      ret[key] = options.date(val)
    } else {
      ret[key] = options.slug(val.toString())
    }
  }

  const transformed = route.inject(pattern, ret)

  // handle absolute paths
  if (transformed.startsWith('/')) return transformed.slice(1)
  return transformed
}

/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 *
 * @param {Options} options
 * @returns {import('metalsmith').Plugin}
 */
function permalinks(options) {
  options = normalizeOptions(options)

  const { linksets } = options
  let defaultLinkset = linksets.find((ls) => {
    return Boolean(ls.isDefault)
  })

  if (!defaultLinkset) {
    defaultLinkset = options
  }

  const dupes = {}

  const findLinkset = (file) => {
    const set = linksets.find((ls) =>
      Object.keys(ls.match).some((key) => {
        if (file[key] === ls.match[key]) {
          return true
        }
        if (Array.isArray(file[key]) && file[key].includes(ls.match[key])) {
          return true
        }
      })
    )
    return set || defaultLinkset
  }

  return function permalinks(files, metalsmith, done) {
    const debug = metalsmith.debug('@metalsmith/permalinks')
    debug.info('Running with options: %O', options)

    if (options.relative || options.linksets.find((ls) => ls.relative)) {
      debug.warn(
        'The relative option is deprecated and its default value will be changed to false before being removed in the next major versions.'
      )
      debug.warn(
        "To prepare for this change, use root-relative URL's in file contents or use a custom markdown renderer to prefix relative URI's."
      )
    }

    const makeUnique = options.duplicates
    const map = new Map(Object.entries(options))
    /* istanbul ignore next */
    if (map.has('duplicatesFail') || map.has('unique')) {
      debug.warn(
        'The "duplicatesFail" and "unique" options are deprecated and have been merged into the option "duplicates". Please see https://github.com/metalsmith/permalinks#ensure-files-have-unique-uris for more info'
      )
    }

    Object.keys(files)
      .filter((file) => html(file) && files[file].permalink !== false)
      .forEach((file) => {
        const data = files[file]
        debug('checking file: %s', file)

        const linkset = findLinkset(data)

        debug('applying pattern: %s to file: %s', linkset.pattern, file)

        let ppath = replace(linkset.pattern, data, linkset) || resolve(file, options.directoryIndex)

        let fam
        switch (linkset.relative) {
          case true:
            fam = family(file, files)
            break
          case 'folder':
            fam = folder(file, files)
            break
          default:
          // nothing
        }

        // Override the path with `permalink`  option
        if (Object.prototype.hasOwnProperty.call(data, 'permalink') && data.permalink !== false) {
          ppath = data.permalink
        }

        const out = makeUnique(path.normalize(ppath), files, file, options)
        if (out instanceof Error) {
          return done(out)
        }

        // track duplicates for relative files to maintain references
        const moved = {}
        if (fam) {
          for (const key in fam) {
            if (Object.prototype.hasOwnProperty.call(fam, key)) {
              const rel = path.posix.join(ppath, key)
              dupes[rel] = fam[key]
              moved[key] = rel
            }
          }
        }

        // add to permalink data for use in links in templates
        let permalink = ppath === '.' ? '' : ppath.replace(/\\/g, '/')
        if (options.trailingSlash) {
          permalink = path.posix.join(permalink, './')
        }
        // contrary to the 2.x "path" property, the permalink property does not override previously set file metadata
        if (!data.permalink) {
          data.permalink = permalink
        }

        // this is only to ensure backwards-compat with 2.x, will be removed in 3.x
        const descriptor = Object.getOwnPropertyDescriptor(data, 'path')
        /* istanbul ignore next */
        if (!descriptor || descriptor.configurable) {
          Object.defineProperty(data, 'path', {
            get() {
              debug.warn('Accessing the permalink at "file.path" is deprecated, use "file.permalink" instead.')
              return permalink
            },
            set(value) {
              permalink = value
            }
          })
        }

        relink(data, moved)

        delete files[file]
        files[out] = data
      })

    // add duplicates for relative files after processing to avoid double-dipping
    // note: `dupes` will be empty if `options.relative` is false
    Object.keys(dupes).forEach((dupe) => {
      files[dupe] = dupes[dupe]
    })
    done()
  }
}

// Expose `plugin`
export default permalinks
