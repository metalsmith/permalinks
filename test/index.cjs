/* eslint-env mocha */

'use strict'

const assert = require('assert')
const path = require('path')
const equal = require('assert-dir-equal')
const Metalsmith = require('metalsmith')
const transliteration = require('transliteration')
/* eslint-disable-next-line n/no-missing-require */
const permalinks = require('..')

const fixturesBase = path.join('test', 'fixtures')
const fixtures = [
  {
    message: 'should change files even with no pattern',
    folder: 'no-pattern',
    options: undefined
  },
  {
    message: 'should replace a pattern',
    folder: 'pattern',
    options: { pattern: ':title' }
  },
  {
    message: 'should ignore any files with permalink equal to false option',
    folder: 'permalink-false',
    options: ':title'
  },
  {
    message: 'should override path in any files with permalink option',
    folder: 'permalink-override',
    options: ':title'
  },
  {
    message: 'should accepts a shorthand string',
    folder: 'shorthand',
    options: ':title'
  },
  {
    message: 'should copy relative files to maintain references',
    folder: 'relative',
    options: undefined
  },
  {
    message: 'should not copy relative files',
    folder: 'no-relative',
    options: {
      relative: false
    }
  },

  {
    message: 'should copy relative files even with patterns',
    folder: 'relative-pattern',
    options: ':title'
  },

  {
    message: 'should copy relative files once per output file',
    folder: 'relative-multiple',
    options: ':title'
  },

  {
    message: 'should copy files in sibling folder',
    folder: 'relative-folder',
    options: { relative: 'folder' }
  },

  {
    message: 'should format a date',
    folder: 'date',
    options: ':date'
  },
  {
    message: 'should format a date with a custom formatter',
    folder: 'custom-date',
    options: {
      pattern: ':date',
      date: 'YYYY/MM'
    }
  },
  {
    message: 'should format a linkset date with a custom formatter',
    folder: 'linkset-custom-date',
    options: {
      linksets: [{
        match: { foo: 34 },
        pattern: 'foo/:date/:title',
        date: 'YYYY/MM/DD'
      }, {
        match: { bar: 21 },
        pattern: 'bar/:date/:title',
        date: 'YYYY/MM'
      }]
    }
  },
  {
    message: 'should match arbitrary metadata',
    folder: 'simple-linksets',
    options: {
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
    }
  },
  {
    message: 'should use slug by defaults',
    folder: 'slug',
    options: {
      pattern: ':title'
    }
  },
  {
    message: 'should use custom slug config if specified',
    folder: 'slug-custom',
    options: {
      pattern: ':title',
      slug: {
        remove: /[^a-z\d- ]+/gi,
        lower: true,
        extend: {
          "'": '-'
        }
      }
    }
  },
  {
    message: 'should use custom slug function',
    folder: 'slug-custom-function',
    options: {
      pattern: ':title',
      slug: transliteration.slugify
    }
  },
  {
    message: 'should accept options for slug module',
    folder: 'slug-options',
    options: {
      pattern: ':title',
      slug: {
        remove: /\./g,
        lower: false
      }
    }
  },
  {
    message: 'should accept options for slug module and create paths',
    folder: 'slug-options-path',
    options: {
      pattern: ':permalink',
      slug: {
        remove: /\./g
      }
    }
  },
  {
    message: 'should make urls unique',
    folder: 'unique-urls',
    options: {
      pattern: ':title',
      unique: true
    }
  },
  {
    message: 'should allow a custom function for unique urls',
    folder: 'unique-function',
    options: {
      unique: (targetPath, files) => {
        let target
        let postfix = ''
        do {
          target = path.join(`${targetPath}${postfix}.html`)
          postfix = `${postfix}-a`
        } while (files[target])

        return target
      },
      pattern: ':title'
    }
  },
  {
    message:
      'should overwrite default linkset options with specific linkset options',
    folder: 'linkset-overwrite-default',
    options: {
      pattern: ':title',
      linksets: [
        {
          match: { overwrite: true },
          pattern: 'overwritten/:title'
        }
      ]
    }
  },
  {
    message:
      'should apply the first linkset when multiple linksets match the same file',
    folder: 'linkset-rule-precedence',
    options: {
      pattern: ':title',
      linksets: [
        {
          match: { bothFilesHaveThisProperty: true },
          pattern: 'first/:title'
        },
        {
          match: { bothFilesHaveThisProperty: true },
          pattern: 'second/:title'
        }
      ]
    }
  },
  {
    message: 'should handle optional path params properly',
    folder: 'optional-path-parts',
    options: {
      pattern: ':date?/:title'
    }
  }
]

describe('@metalsmith/permalinks', () => {
  // Tests comparing build output against expected files
  fixtures.forEach(({ message, options, folder }) => {
    const basePath = path.join(fixturesBase, folder)
    it(message, (done) => {
      Metalsmith(basePath)
        .env('DEBUG', process.env.DEBUG)
        .use(permalinks(options))
        .build((err) => {
          if (err) done(err)
          try {
            equal(path.join(basePath, 'expected'), path.join(basePath, 'build'))
            done()
          } catch (err) {
            done(err)
          }
        })
    })
  })

  /// Tests with specific requirements
  it('should replace any backslashes in paths with slashes', (done) => {
    Metalsmith(path.join(fixturesBase, 'backslashes'))
      .use(permalinks())
      .use((files, metalsmith, pluginDone) => {
        Object.keys(files).forEach((file) => {
          assert.strictEqual(files[file].path.includes('\\'), false)
        })
        pluginDone()
        done()
      })
      .build((err) => {
        if (err) return done(err)
      })
  })

  it('should use the resolve path for false values (not root)', (done) => {
    Metalsmith(path.join(fixturesBase, 'falsy'))
      .use(permalinks(':falsy/:title'))
      .use((files) => {
        Object.keys(files).forEach((file) => {
          assert.notStrictEqual(files[file].path.charAt(0), '/')
        })
        done()
      })
      .build((err) => {
        if (err) return done(err)
      })
  })

  it('should use the resolve path for empty arrays (not root)', (done) => {
    Metalsmith(path.join(fixturesBase, 'empty-array'))
      .use(permalinks(':array/:title'))
      .use((files) => {
        Object.keys(files).forEach((file) => {
          assert.notStrictEqual(files[file].path.charAt(0), '/')
        })
        done()
      })
      .build((err) => {
        if (err) return done(err)
      })
  })

  it('should return an error when clashes happen', (done) => {
    Metalsmith(path.join(fixturesBase, 'duplicate-urls'))
      .use(
        permalinks({
          duplicatesFail: true,
          pattern: ':title'
        })
      )
      .build((err) => {
        assert.strictEqual(
          err,
          `Permalinks: Clash with another target file ${path.normalize(
            'one-post/index.html'
          )}`
        )
        done()
      })
  })
})