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
    return path.join(targetPath || '', opts.directoryIndex)
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
 * @property {string} [directoryIndex='index.html'] Basename of the permalinked file (default: `index.html`)
 * @property {boolean} [trailingSlash=false] Whether a trailing `/` should be added to the `file.permalink` property. Useful to avoid redirects on servers which do not have a built-in rewrite module enabled.
 * @property {'error'|'index'|'overwrite'|Function} [duplicates='error'] How to handle duplicate target URI's.
 * @property {Linkset[]} [linksets] An array of additional linksets
 * @property {SlugifyOptions|slugFunction} [slug] {@link SlugifyOptions} or a custom slug function of the form `(pathpart) => string`
 */

/** @type {Options} */
const defaultOptions = {
  date: 'YYYY/MM/DD',
  slug: { lower: true },
  trailingSlash: false,
  linksets: [],
  duplicates: 'error',
  directoryIndex: 'index.html'
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
  return function defaultSlugFn(text) {
    if (typeof options.extend === 'object' && options.extend !== null) {
      slugify.extend(options.extend)
    }

    return slugify(text, Object.assign({}, defaultOptions.slug, options))
  }
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

  if (options.duplicates && Object.keys(dupeHandlers).includes(options.duplicates)) {
    options.duplicates = dupeHandlers[options.duplicates]
  }

  options.slug = typeof options.slug === 'function' ? options.slug : slugFn(options.slug)
  options.date = format(options.date)

  return options
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
  const normalizedOptions = normalizeOptions(options)
  let primaryLinkset = normalizedOptions.linksets.find((ls) => Boolean(ls.isDefault))
  if (!primaryLinkset) {
    primaryLinkset = normalizedOptions
  }

  const findLinkset = (file) => {
    const set = normalizedOptions.linksets.find((ls) =>
      Object.keys(ls.match).some((key) => {
        if (file[key] === ls.match[key]) {
          return true
        }
        if (Array.isArray(file[key]) && file[key].includes(ls.match[key])) {
          return true
        }
      })
    )

    return set ? set : primaryLinkset
  }

  return function permalinks(files, metalsmith, done) {
    const debug = metalsmith.debug('@metalsmith/permalinks')
    debug.info('Running with options: %O', normalizedOptions)

    if (normalizedOptions.relative || normalizedOptions.linksets.find((ls) => ls && ls.relative)) {
      return done(new Error('The "relative" option is no longer supported.'))
    }

    const makeUnique = normalizedOptions.duplicates

    Object.keys(files)
      .filter((file) => html(file) && files[file].permalink !== false)
      .forEach((file) => {
        const data = files[file]
        debug('checking file: %s', file)

        const linkset = findLinkset(data)

        debug('applying pattern: %s to file: %s', linkset.pattern, file)

        const opts =
          linkset === primaryLinkset
            ? primaryLinkset
            : {
                ...linkset,
                directoryIndex: normalizedOptions.directoryIndex,
                slug:
                  typeof linkset.slug === 'function'
                    ? linkset.slug
                    : typeof linkset.slug === 'object'
                    ? slugFn(linkset.slug)
                    : normalizedOptions.slug,
                date: typeof linkset.date === 'string' ? format(linkset.date) : normalizedOptions.date
              }
        let ppath = replace(linkset.pattern, data, opts) || resolve(file, normalizedOptions.directoryIndex)

        // invalid on Windows, but best practice not to use them anyway
        const invalidFilepathChars = /\||:|<|>|\*|\?|"/
        if (invalidFilepathChars.test(ppath)) {
          const msg = `Filepath "${file}" contains invalid filepath characters (one of :|<>"*?) after resolving as linkset pattern "${linkset.pattern}"`
          debug.error(msg)
          done(new Error(msg))
        }

        // Override the path with `permalink`  option
        if (Object.prototype.hasOwnProperty.call(data, 'permalink') && data.permalink !== false) {
          ppath = data.permalink
        }

        const out = makeUnique(path.normalize(ppath), files, file, normalizedOptions)
        if (out instanceof Error) {
          return done(out)
        }

        // add to permalink data for use in links in templates
        let permalink = ppath === '.' ? '' : ppath.replace(/\\/g, '/')
        if (normalizedOptions.trailingSlash) {
          permalink = path.posix.join(permalink, './')
        }

        // contrary to the 2.x "path" property, the permalink property does not override previously set file metadata
        if (!data.permalink) {
          data.permalink = permalink
        }

        delete files[file]
        files[out] = data
      })

    done()
  }
}

export default permalinks
