
var debug = require('debug')('metalsmith-permalinks');
var moment = require('moment');
var path = require('path');
var slug = require('slug-component');
var substitute = require('substitute');

var basename = path.basename;
var dirname = path.dirname;
var extname = path.extname;
var join = path.join;

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 *
 * @param {Object} options
 *   @property {String} pattern
 *   @property {String or Function} date
 *   @property {Boolean} relative
 *   @property {Boolean} symlinks
 * @return {Function}
 */

function plugin(options){
  options = normalize(options);
  var pattern = options.pattern;
  var dupes = {};
  var linkTargets = {};

  return function(files, metalsmith, done){
    setImmediate(done);
    Object.keys(files).forEach(function(file){
      debug('checking file: %s', file);
      if (!html(file)) return;
      var data = files[file];
      var path = replace(pattern, data, options) || resolve(file);
      var fam = {};

      // get the family for this file
      if (options.relative && !options.symlinks) {
        fam = family(file, files);
      } else if (options.symlinks) {
        // family when using symlinks is only sibling files and 
        // sibling directories
        fam = siblings(file, files);
      }

      // track duplicates for relative files to maintain references
      // note: only do this if 'relative' or 'symlinks' options are set
      if (options.relative || options.symlinks) {

        // don't make any symlinks for index.html pages, since they won't
        // be copied
        if ('index.html' != basename(file)) {
          for (var key in fam) {
            var rel = join(path, key);
            dupes[rel] = fam[key];
            linkTargets[rel] = key;
          }
        }
      }

      // add to path data for use in links in templates
      data.path = '.' == path ? '' : path;

      var out = join(path, 'index.html');
      delete files[file];
      files[out] = data;
    });

    // add duplicates for relative files after processing to avoid double-dipping
    // note: `dupes` will be empty if `options.relative` and `options.symlinks` 
    // are false
    Object.keys(dupes).forEach(function(dupe){

      if (options.symlinks) {
        // if we're making relative files symlinks, save symlink metadata
        files[dupe] = { symlink: linkTargets[dupe] };
      } else {
        // copy the relative files
        files[dupe] = dupes[dupe];
      }
    })
  };
}

/**
 * Normalize an options argument.
 *
 * @param {String or Object} options
 * @return {Object}
 */

function normalize(options){
  if ('string' == typeof options) options = { pattern: options };
  options = options || {};
  options.date = options.date ? format(options.date) : format('YYYY/MM/DD');
  options.relative = options.hasOwnProperty('relative') ? options.relative : true;
  options.symlinks = options.hasOwnProperty('symlinks') ? options.symlinks : false;
  return options;
}

/**
 * Return a formatter for a given moment.js format `string`.
 *
 * @param {String} string
 * @return {Function}
 */

function format(string){
  return function(date){
    return moment(date).utc().format(string);
  };
}

/**
 * Get a list of sibling and children files for a given `file` in `files`.
 *
 * @param {String} file
 * @param {Object} files
 * @return {Object}
 */

function family(file, files){
  var dir = dirname(file);
  var ret = {};

  if ('.' == dir) dir = '';

  for (var key in files) {
    if (key == file) continue;
    if (key.indexOf(dir) != 0) continue;
    if (html(key)) continue;
    var rel = key.slice(dir.length);
    ret[rel] = files[key];
  }

  return ret;
}

/**
 * Get a list of sibling files for a given `file` in `files`.
 *
 * @param {String} file
 * @param {Object} files
 * @return {Object}
 */
function siblings(file, files){
  var dir = dirname(file);
  var ret = {};

  for (var key in files) {
    if (key == file) continue;
    if (key.indexOf(dir) != 0 && dir != '.') continue;
    if (html(key)) continue;

    // walk up the directory structure to find the sibling of
    // `file`. will be `key` or an ancestor of `key`
    var sibling = key;
    while (dir != dirname(sibling)) {
      sibling = dirname(sibling);
    }

    var rel = dir == '.' ? sibling : sibling.slice(dir.length);
    ret[rel] = files[key];
  }

  return ret;
}

/**
 * Resolve a permalink path string from an existing file `path`.
 *
 * @param {String} path
 * @return {String}
 */

function resolve(path){
  var ret = dirname(path);
  var base = basename(path, extname(path));
  if (base != 'index') ret = join(ret, base);
  return ret;
}

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {String} pattern (optional)
 * @param {Object} data
 * @param {Object} options
 * @return {String or Null}
 */

function replace(pattern, data, options){
  if (!pattern) return null;
  var keys = params(pattern);
  var ret = {};

  for (var i = 0, key; key = keys[i++];) {
    var val = data[key];
    if (val == null) return null;
    if (val instanceof Date) {
      ret[key] = options.date(val);
    } else {
      ret[key] = slug(val.toString());
    }
  }

  return substitute(pattern, ret);
}

/**
 * Get the params from a `pattern` string.
 *
 * @param {String} pattern
 * @return {Array}
 */

function params(pattern){
  var matcher = /:(\w+)/g;
  var ret = [];
  var m;
  while (m = matcher.exec(pattern)) ret.push(m[1]);
  return ret;
}

/**
 * Check whether a file is an HTML file.
 *
 * @param {String} path
 * @return {Boolean}
 */

function html(path){
  return /.html/.test(extname(path));
}
