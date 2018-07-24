/* eslint-env mocha */
var rimraf = require('rimraf');
var assert = require('assert');
var equal = require('assert-dir-equal');
var Metalsmith = require('metalsmith');
var permalinks = require('..');

describe('metalsmith-permalinks', function() {
  before(function(done) {
    rimraf('test/fixtures/*/build', done);
  });

  it('should change files even with no pattern', function(done) {
    Metalsmith('test/fixtures/no-pattern')
      .use(permalinks())
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/no-pattern/expected',
          'test/fixtures/no-pattern/build'
        );
        done();
      });
  });

  it('should replace a pattern', function(done) {
    Metalsmith('test/fixtures/pattern')
      .use(permalinks({ pattern: ':title' }))
      .build(function(err) {
        if (err) return done(err);
        equal('test/fixtures/pattern/expected', 'test/fixtures/pattern/build');
        done();
      });
  });

  it('should accepts a shorthand string', function(done) {
    Metalsmith('test/fixtures/shorthand')
      .use(permalinks(':title'))
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/shorthand/expected',
          'test/fixtures/shorthand/build'
        );
        done();
      });
  });

  it('should copy relative files to maintain references', function(done) {
    Metalsmith('test/fixtures/relative')
      .use(permalinks())
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/relative/expected',
          'test/fixtures/relative/build'
        );
        done();
      });
  });

  it('should not copy relative files', function(done) {
    Metalsmith('test/fixtures/no-relative')
      .use(
        permalinks({
          relative: false
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/no-relative/expected',
          'test/fixtures/no-relative/build'
        );
        done();
      });
  });

  it('should copy relative files even with patterns', function(done) {
    Metalsmith('test/fixtures/relative-pattern')
      .use(permalinks(':title'))
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/relative-pattern/expected',
          'test/fixtures/relative-pattern/build'
        );
        done();
      });
  });

  it('should copy relative files once per output file', function(done) {
    Metalsmith('test/fixtures/relative-multiple')
      .use(permalinks(':title'))
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/relative-multiple/expected',
          'test/fixtures/relative-multiple/build'
        );
        done();
      });
  });

  it('should copy files in sibling folder', function(done) {
    Metalsmith('test/fixtures/relative-folder')
      .use(permalinks({relative: 'folder'}))
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/relative-folder/expected',
          'test/fixtures/relative-folder/build'
        );
        done();
      });
  });

  it('should format a date', function(done){
    Metalsmith('test/fixtures/date')
      .use(permalinks(':date'))
      .build(function(err) {
        if (err) return done(err);
        equal('test/fixtures/date/expected', 'test/fixtures/date/build');
        done();
      });
  });

  it('should format a date with a custom formatter', function(done) {
    Metalsmith('test/fixtures/custom-date')
      .use(
        permalinks({
          pattern: ':date',
          date: 'YYYY/MM'
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/custom-date/expected',
          'test/fixtures/custom-date/build'
        );
        done();
      });
  });

  it('should replace any backslashes in paths with slashes', function(done) {
    Metalsmith('test/fixtures/backslashes')
      .use(permalinks())
      .use(function(files, metalsmith, pluginDone) {
        Object.keys(files).forEach(function(file) {
          assert.equal(files[file].path.indexOf('\\'), -1);
        });
        pluginDone();
        done();
      })
      .build(function(err) {
        if (err) return done(err);
      });
  });

  it('should ignore any files with permalink equal to false option', function(done) {
    Metalsmith('test/fixtures/false-permalink')
      .use(permalinks(':title'))
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/false-permalink/expected',
          'test/fixtures/false-permalink/build'
        );
        done();
      });
  });

  it('should match arbitrary metadata', function(done) {
    Metalsmith('test/fixtures/simple-linksets')
      .use(
        permalinks({
          linksets: [
            {
              match: { foo: 34 },
              pattern: 'foo/:title'
            },
            {
              match: { bar: 21 },
              pattern: 'bar/:title'
            }
          ]
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/simple-linksets/expected',
          'test/fixtures/simple-linksets/build'
        );
        done();
      });
  });

  it('should use slug by defaults', function(done) {
    // test building of filenames
    Metalsmith('test/fixtures/slug')
      .use(
        permalinks({
          pattern: ':title'
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal('test/fixtures/slug/expected', 'test/fixtures/slug/build');
        done();
      });
  });
  it('should use custom slug config if specified', function(done) {
    // test building of filenames
    Metalsmith('test/fixtures/slug-custom')
      .use(
        permalinks({
          pattern: ':title',
          slug: { mode: 'pretty', lower: true }
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/slug-custom/expected',
          'test/fixtures/slug-custom/build'
        );
        done();
      });
  });
  it('should use custom slug function', function(done) {
    // test building of filenames
    Metalsmith('test/fixtures/slug-custom-function')
      .use(
        permalinks({
          pattern: ':title',
          slug: require('transliteration').slugify
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/slug-custom-function/expected',
          'test/fixtures/slug-custom-function/build'
        );
        done();
      });
  });

  it('should use the resolve path for false values (not root)', function(done) {
    Metalsmith('test/fixtures/falsy')
      .use(permalinks(':falsy/:title'))
      .use(function(files) {
        Object.keys(files).forEach(function(file) {
          assert.notEqual(files[file].path.charAt(0), '/');
        });
        done();
      })
      .build(function(err) {
        if (err) return done(err);
      });
  });

  it('should use the resolve path for empty arrays (not root)', function(done) {
    Metalsmith('test/fixtures/empty-array')
      .use(permalinks(':array/:title'))
      .use(function(files) {
        Object.keys(files).forEach(function(file) {
          assert.notEqual(files[file].path.charAt(0), '/');
        });
        done();
      })
      .build(function(err) {
        if (err) return done(err);
      });
  });

  it('should accept options for slug module', function(done) {
    Metalsmith('test/fixtures/slug-options')
      .use(
        permalinks({
          pattern: ':title',
          slug: {
            remove: /[.]/g,
            lower: false
          }
        })
      )
      .build(function(err) {
        if (err) return done(err);
        equal(
          'test/fixtures/slug-options/expected',
          'test/fixtures/slug-options/build'
        );
        done();
      });
  });
});
