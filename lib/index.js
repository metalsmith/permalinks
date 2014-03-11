
var debug = require('debug')('metalsmith-permalinks');
var path = require('path');
var slug = require('slug-component');
var strings = require('strings');

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
 * @return {Function}
 */

function plugin(options){
  if ('string' == typeof options) options = { pattern: options };
  options = options || {};
  var pattern = options.pattern;
  return function(files, metalsmith, done){
    setImmediate(done);

    Object.keys(files).forEach(function(file){
      debug('checking file: %s', file);
      if (!html(file)) return;
      var data = files[file];
      var path = replace(pattern, data) || resolve(file);
      var fam = family(file, files);

      // add duplicates for relative files to maintain references
      for (var key in fam) {
        var rel = join(path, key);
        files[rel] = fam[key];
      }

      // add to path data for use in links in templates
      data.path = '.' == path ? '' : path;

      var out = join(path, 'index.html');
      delete files[file];
      files[out] = data;
    });
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
 * @return {String or Null}
 */

function replace(pattern, data){
  if (!pattern) return null;
  strings();
  var formatter = strings.instance();
  if (data.date !== undefined && data.date instanceof Date) {
    formatter.use(strings.dates(data.date));  
  }
  formatter.use(function() {
    return [
      new strings.Pattern(/:\b(.+?)\b/g, function (src, match) {
        if (this[match] !== undefined && (typeof this[match] == 'string' || this[match] instanceof String)) {
          return slug(this[match]);
        }
        else {
          return '';
        }      
      })
    ];
  });
  formatter.use(data);

  return formatter.run(pattern);
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
