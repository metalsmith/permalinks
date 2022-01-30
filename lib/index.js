'use strict'

const path = require('path')
const debug = require('debug')('@metalsmith/permalinks')
const moment = require('moment')
const slugify = require('slugify')
const route = require('regexparam')

const error = debug.extend('error')

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
 * @property {boolean|'folder'} [relative=true] When `true` (by default), will duplicate sibling files so relative links keep working in resulting structure. Turn off by setting `false`. Can also be set to `folder`, which uses a strategy that considers files in folder as siblings if the folder is named after the html file.
 * @property {string} [indexFile='index.html'] Basename of the permalinked file (default: `index.html`)
 * @property {boolean|Function} [unique] Set to `true` to add a number to duplicate permalinks (default: `false`), or specify a custom duplicate handling callback of the form `(permalink, files, file, options) => string`
 * @property {boolean} [duplicatesFail=false] Set to `true` to throw an error if multiple file path transforms result in the same permalink. `false` by default
 * @property {Linkset[]} [linksets] An array of additional linksets
 * @property {SlugifyOptions|slugFunction} [slug] [Slugify options](https://github.com/simov/slugify) or a custom slug function of the form `(pathpart) => string`
 */

/** @type {Options} */
const defaultOptions = {
  pattern: null,
  date: 'YYYY/MM/DD',
  slug: { lower: true },
  relative: true,
  indexFile: 'index.html',
  unique: false,
  duplicatesFail: false,
  linksets: []
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
 * Normalize an options argument.
 *
 * @param  {string|Options} options
 * @return {Object}
 */
const normalizeOptions = (options) => {
  if (typeof options === 'string') {
    options = { pattern: options }
  }
  options = Object.assign({}, defaultOptions, options)
  options.date = format(options.date)
  if (typeof options.slug !== 'function') {
    options.slug = slugFn(options.slug)
  }
  return options
}

/**
 * Return a formatter for a given moment.js format `string`.
 *
 * @param {string} string
 * @return {Function}
 */
const format = (string) => (date) => moment(date).utc().format(string)

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
    if (key === file) continue
    if (key.indexOf(dir) !== 0) continue
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
    if (otherFile === file) continue
    if (otherFile.indexOf(sharedPath) !== 0) continue
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
const resolve = (str) => {
  const base = path.basename(str, path.extname(str))
  let ret = path.dirname(str)

  if (base !== 'index') {
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
 * Check whether a file is an HTML file.
 *
 * @param {string} str The path
 * @return {boolean}
 */
const html = (str) => path.extname(str) === '.html'

/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 *
 * @param {Options} options
 * @returns {import('metalsmith').Plugin}
 */
function inititalizePermalinks(options) {
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
    setImmediate(done)

    const defaultUniquePath = (targetPath, filesObj, filename, opts) => {
      const { indexFile } = opts
      let target
      let counter = 0
      let postfix = ''
      do {
        target = path.join(`${targetPath}${postfix}`, indexFile || 'index.html')
        if (options.duplicatesFail && filesObj[target]) {
          error(`Target: ${target} already has a file assigned`)
          return done(`Permalinks: Clash with another target file ${target}`)
        }

        postfix = `-${++counter}`
      } while (options.unique && filesObj[target])

      return target
    }

    const makeUnique =
      typeof options.unique === 'function' ? options.unique : defaultUniquePath

    Object.keys(files).forEach((file) => {
      const data = files[file]
      debug('checking file: %s', file)

      if (!html(file)) return
      if (data.permalink === false) return

      const linkset = Object.assign({}, defaultLinkset, findLinkset(data))
      debug('applying pattern: %s to file: %s', linkset.pattern, file)

      let ppath = replace(linkset.pattern, data, linkset) || resolve(file)

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
      if (
        Object.prototype.hasOwnProperty.call(data, 'permalink') &&
        data.permalink !== false
      ) {
        ppath = data.permalink
      }

      const out = makeUnique(ppath, files, file, options)

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

      // add to path data for use in links in templates
      data.path = ppath === '.' ? '' : ppath.replace(/\\/g, '/')

      relink(data, moved)

      delete files[file]
      files[out] = data
    })

    // add duplicates for relative files after processing to avoid double-dipping
    // note: `dupes` will be empty if `options.relative` is false
    Object.keys(dupes).forEach((dupe) => {
      files[dupe] = dupes[dupe]
    })
  }
}

// Expose `plugin`
module.exports = inititalizePermalinks
