module.exports = {
  
  /** polyfill for Array.find in ES6 */
  arrayFind: function(ary, callback, context) {
    for (var i = 0; i < ary.length; i++) {
      if (callback.call(context, ary[i], i, ary)) {
        return ary[i];
      }
    }
  },

  /** merge keys into destination, overwriting from the right */
  objectMerge: function(dest, source /* ... */) {
    for (var i = arguments.length - 1; i > 0; i--) {
      var arg = arguments[i];
      Object.keys(arg).forEach(function(key) {
        dest[key] = arg[key];
      });
    }

    return dest;
  }

}
