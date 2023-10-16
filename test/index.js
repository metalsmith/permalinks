/* eslint-env node, mocha */

import assert from 'assert'
import path from 'path'
import equal from 'assert-dir-equal'
import Metalsmith from 'metalsmith'
import * as transliteration from 'transliteration'
import permalinks from '../src/index.js'

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
    message: 'should override destination path in any files with permalink option',
    folder: 'permalink-override',
    options: ':title'
  },
  {
    message: 'should remove/replace invalid path characters by default',
    folder: 'permalink-invalid-chars',
    options: ':title'
  },
  {
    message: 'should accept a shorthand string',
    folder: 'shorthand',
    options: ':title'
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
      linksets: [
        {
          match: { foo: 34 },
          pattern: 'foo/:date/:title',
          date: 'YYYY/MM/DD'
        },
        {
          match: { bar: 21 },
          pattern: 'bar/:date/:title',
          date: 'YYYY/MM'
        }
      ]
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
    message: 'should use custom slug function for linksets too',
    folder: 'slug-custom-function-linksets',
    options: {
      slug(str) {
        return str + str.length
      },
      linksets: [
        {
          match: { collection: 'blog' },
          pattern: 'blog/:title'
        }
      ]
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
      duplicates: 'index'
    }
  },
  {
    message: 'should allow a custom function for unique urls',
    folder: 'unique-function',
    options: {
      duplicates: (targetPath, files) => {
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
    message: 'should overwrite default linkset options with specific linkset options',
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
    message: 'should apply the first linkset when multiple linksets match the same file',
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
  },
  {
    message: 'should match array values',
    folder: 'array-values',
    options: {
      linksets: [
        {
          pattern: ':collection?/:title',
          match: { array: 1 }
        }
      ]
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
          if (err) return done(err)
          try {
            equal(path.join(basePath, 'build'), path.join(basePath, 'expected'))
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
          assert.strictEqual(files[file].permalink.includes('\\'), false)
        })
        pluginDone()
        done()
      })
      .build((err) => {
        if (err) return done(err)
      })
  })

  // this test was probably added to address an oddity in regexparam library path handling related to having a leading slash
  it('should use the resolve path for false values (not root)', (done) => {
    Metalsmith(path.join(fixturesBase, 'falsy'))
      .use(permalinks(':falsy/:title'))
      .use((files) => {
        Object.keys(files).forEach((file) => {
          assert.notStrictEqual(files[file].permalink.charAt(0), '/')
        })
        done()
      })
      .build((err) => {
        if (err) return done(err)
      })
  })

  // better to error the build and make users aware of an anti-pattern,
  // than silently strip/replace the invalid chars and let them follow bad practice
  it('should error when encountering invalid filepath characters after permalink pattern resolution', (done) => {
    Metalsmith(path.join(fixturesBase, 'invalid-filename-chars'))
      .use(permalinks(':title'))
      .build((err) => {
        try {
          assert.strictEqual(
            err.message,
            'Filepath "post.html" contains invalid filepath characters (one of :|<>"*?) after resolving as linkset pattern ":title"'
          )
          done()
        } catch (err) {
          done(err)
        }
      })
  })

  it('should allow an alternative directoryIndex', (done) => {
    const basepath = path.join(fixturesBase, 'custom-indexfile')
    Metalsmith(basepath)
      .env('DEBUG', process.env.DEBUG)
      .use(
        permalinks({
          directoryIndex: 'alt.html',
          duplicates: 'error'
        })
      )
      .build((err) => {
        if (err) return done(err)
        try {
          equal(path.join(basepath, 'build'), path.join(basepath, 'expected'))
          done()
        } catch (err) {
          done(err)
        }
      })
  })

  it('should return an error when clashes happen', (done) => {
    Metalsmith(path.join(fixturesBase, 'duplicate-urls'))
      .env('DEBUG', process.env.DEBUG)
      .use(
        permalinks({
          duplicates: 'error',
          pattern: ':title'
        })
      )
      .build((err) => {
        assert.strictEqual(
          err.message,
          `Permalinks: Clash with another target file ${path.normalize('one-post/index.html')}`
        )
        done()
      })
  })

  describe('sets a file.permalink property', () => {
    let ms
    beforeEach(() => {
      ms = Metalsmith(path.join(fixturesBase, 'no-relative')).env('DEBUG', process.env.DEBUG).ignore('**')
    })

    it('on each processed file', (done) => {
      const files = {
        'test.html': {
          contents: Buffer.from('Test'),
          path: 'test.html'
        },
        [path.join('nested', 'test.html')]: {
          contents: Buffer.from('Nested test')
        }
      }

      permalinks()(files, ms, (err) => {
        if (err) done(err)
        assert.deepStrictEqual(
          Object.values(files)
            .map((f) => f.permalink)
            .sort(),
          ['nested/test', 'test']
        )
        assert.deepStrictEqual(
          Object.keys(files).sort(),
          ['nested/test/index.html', 'test/index.html'].map(path.normalize)
        )
        done()
      })
    })

    it('that supports adding a trailing slash to the permalink property', (done) => {
      const ms = Metalsmith(path.join(fixturesBase, 'no-relative')).env('DEBUG', process.env.DEBUG).ignore('**')

      const files = {
        'test.html': {
          contents: Buffer.from('Test')
        },
        [path.join('nested', 'test.html')]: {
          contents: Buffer.from('Nested test')
        }
      }

      permalinks({
        trailingSlash: true
      })(files, ms, (err) => {
        if (err) done(err)
        assert.deepStrictEqual(
          Object.values(files)
            .map((f) => f.permalink)
            .sort(),
          ['nested/test/', 'test/']
        )
        assert.deepStrictEqual(
          Object.keys(files).sort(),
          ['nested/test/index.html', 'test/index.html'].map(path.normalize)
        )
        done()
      })
    })

    it('but without overriding explicitly defined permalinks', (done) => {
      const files = {
        'test.html': {
          contents: Buffer.from('Test'),
          title: 'HelloWorld',
          permalink: 'new/permalink/hehe'
        }
      }

      permalinks({
        trailingSlash: true,
        pattern: ':title'
      })(files, ms, (err) => {
        if (err) done(err)
        assert.strictEqual(Object.values(files)[0].permalink, 'new/permalink/hehe')
        assert.strictEqual(Object.keys(files)[0], path.normalize('new/permalink/hehe/index.html'))
        done()
      })
    })
  })
})
