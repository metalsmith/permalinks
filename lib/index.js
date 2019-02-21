const debug = require('debug')('metalsmith-permalinks');
const error = debug.extend('error');
const moment = require('moment');
const path = require('path');
const slugify = require('slugify');
const substitute = require('substitute');
const utils = require('./utils');

const basename = path.basename;
const dirname = path.dirname;
const extname = path.extname;
const join = path.join;

const find = utils.arrayFind;
const merge = utils.objectMerge;

/**
 * Maps the slugify function to slug to maintain compatability
 *
 * @param  {String} text
 * @param  {Object} options
 *
 * @return {String}
 */
const slug = (text, options = {}) => {
  // extend if it's an object
  if (options.extend === Object(options.extend)) {
    slugify.extend(options.extend);
  }
  return slugify(text, Object.assign({}, { lower: true }, options));
};

/**
 * Re-links content
 *
 * @param  {Object} data
 * @param  {Object} moved
 *
 * @return {Void}
 */
const relink = (data, moved) => {
  let content = data.contents.toString();
  Object.keys(moved).forEach(to => {
    const from = moved[to];
    content = content.replace(from, to);
  });
  data.contents = Buffer.from(content);
};

/**
 * Normalize an options argument.
 *
 * @param  {String/Object} options
 *
 * @return {Object}
 */
const normalize = options => {
  if ('string' == typeof options) {
    options = { pattern: options };
  }
  options = options || {};
  options.date =
    typeof options.date === 'string'
      ? format(options.date)
      : format('YYYY/MM/DD');
  options.relative = options.hasOwnProperty('relative')
    ? options.relative
    : true;
  options.linksets = options.linksets || [];
  return options;
};

/**
 * Return a formatter for a given moment.js format `string`.
 *
 * @param {String} string
 * @return {Function}
 */
const format = string => date =>
  moment(date)
    .utc()
    .format(string);

/**
 * Get a list of sibling and children files for a given `file` in `files`.
 *
 * @param {String} file
 * @param {Object} files
 * @return {Object}
 */
const family = (file, files) => {
  const ret = {};
  let dir = dirname(file);

  if ('.' == dir) {
    dir = '';
  }

  for (const key in files) {
    if (key == file) continue;
    if (key.indexOf(dir) != 0) continue;
    if (html(key)) continue;
    const rel = key.slice(dir.length);
    ret[rel] = files[key];
  }

  return ret;
};

/**
 * Get a list of files that exists in a folder named after `file` for a given `file` in `files`.
 *
 * @param {String} file
 * @param {Object} files
 * @return {Object}
 */
const folder = (file, files) => {
  const bn = basename(file, extname(file));
  const family = {};
  let dir = dirname(file);

  if ('.' === dir) {
    dir = '';
  }

  const sharedPath = join(dir, bn, '/');

  for (const otherFile in files) {
    if (otherFile === file) continue;
    if (otherFile.indexOf(sharedPath) !== 0) continue;
    if (html(otherFile)) continue;
    const remainder = otherFile.slice(sharedPath.length);
    family[remainder] = files[otherFile];
  }

  return family;
};

/**
 * Resolve a permalink path string from an existing file `path`.
 *
 * @param {String} path
 * @return {String}
 */
const resolve = path => {
  const base = basename(path, extname(path));
  let ret = dirname(path);

  if (base != 'index') {
    ret = join(ret, base).replace('\\', '/');
  }
  return ret;
};

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {String} pattern (optional)
 * @param {Object} data
 * @param {Object} options
 *
 * @return {Mixed} String or Null
 */
const replace = (pattern, data, options) => {
  if (!pattern) return null;
  const keys = params(pattern);
  const ret = {};

  for (var i = 0, key; (key = keys[i++]); ) {
    const val = data[key];
    if (!val || (Array.isArray(val) && val.length === 0)) return null;
    if (val instanceof Date) {
      ret[key] = options.date(val);
    } else {
      ret[key] =
        typeof options.slug === 'function'
          ? options.slug(val.toString())
          : slug(val.toString(), options.slug);
    }
  }

  return substitute(pattern, ret);
};

/**
 * Get the params from a `pattern` string.
 *
 * @param {String} pattern
 * @return {Array}
 */
const params = pattern => {
  const matcher = /:(\w+)/g;
  const ret = [];
  let m;
  while ((m = matcher.exec(pattern))) ret.push(m[1]);
  return ret;
};

/**
 * Check whether a file is an HTML file.
 *
 * @param {String} path
 * @return {Boolean}
 */
const html = path => '.html' === extname(path);

/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 *
 * @param  {Object} options
 *   @property {String} pattern
 *   @property {String/Function} date
 *   @property {String} indexFile
 *   @property {Boolean/Function} unique
 *   @property {Boolean} duplicatesFail
 *
 * @return {Function}
 */
const plugin = options => {
  options = normalize(options);

  const linksets = options.linksets;
  let defaultLinkset = find(linksets, function(ls) {
    return !!ls.isDefault;
  });

  if (!defaultLinkset) {
    defaultLinkset = options;
  }

  const dupes = {};

  const findLinkset = file => {
    const set = find(linksets, ls =>
      Object.keys(ls.match).reduce((sofar, key) => {
        if (!sofar) {
          return sofar;
        }

        if (file[key] === ls.match[key]) {
          return true;
        }
        if (file[key] && file[key].indexOf) {
          return file[key].indexOf(ls.match[key]) > -1;
        }

        return false;
      }, true)
    );

    return set || defaultLinkset;
  };

  return (files, metalsmith, done) => {
    setImmediate(done);

    const defaultUniquePath = (targetPath, filesObj, filename, opts) => {
      const { indexFile } = opts;
      let target;
      let counter = 0;
      let postfix = '';
      do {
        target = join(`${targetPath}${postfix}`, indexFile || 'index.html');
        if (options.duplicatesFail && files[target]) {
          error(`Target: ${target} already has a file assigned`);
          return done(`Permalinks: Clash with another target file ${target}`);
        }

        postfix = `-${++counter}`;
      } while (options.unique && files[target]);
      return target;
    };

    const makeUnique =
      typeof options.unique === 'function' ? options.unique : defaultUniquePath;

    Object.keys(files).forEach(file => {
      const data = files[file];
      debug('checking file: %s', file);

      if (!html(file)) return;
      if (data['permalink'] === false) return;

      const linkset = merge({}, findLinkset(data), defaultLinkset);
      debug('applying pattern: %s to file: %s', linkset.pattern, file);

      let path = replace(linkset.pattern, data, linkset) || resolve(file);

      let fam;
      switch (linkset.relative) {
        case true:
          fam = family(file, files);
          break;
        case 'folder':
          fam = folder(file, files);
          break;
      }

      // Override the path with `permalink`  option
      if (data.hasOwnProperty('permalink') && data['permalink'] !== false) {
        path = data['permalink'];
      }

      const out = makeUnique(path, files, file, options);

      // track duplicates for relative files to maintain references
      const moved = {};
      if (fam) {
        for (const key in fam) {
          const rel = join(path, key);
          dupes[rel] = fam[key];
          moved[key] = rel;
        }
      }

      // add to path data for use in links in templates
      data.path = '.' == path ? '' : path;

      relink(data, moved);

      delete files[file];
      files[out] = data;
    });

    // add duplicates for relative files after processing to avoid double-dipping
    // note: `dupes` will be empty if `options.relative` is false
    Object.keys(dupes).forEach(dupe => {
      files[dupe] = dupes[dupe];
    });
  };
};

// Expose `plugin`
module.exports = plugin;
