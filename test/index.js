
var exec = require('child_process').exec;
var equal = require('assert-dir-equal');
var Metalsmith = require('metalsmith');
var permalinks = require('..');

describe('metalsmith-permalinks', function(){
  before(function(done){
    exec('rm -rf test/fixtures/*/build', done);
  });

  it('should change files even with no pattern', function(done){
    Metalsmith('test/fixtures/no-pattern')
      .use(permalinks())
      .build(function(err){
        if (err) return done(err);
        equal('test/fixtures/no-pattern/expected', 'test/fixtures/no-pattern/build');
        done();
      });

  });

  it('should replace a pattern', function(done){
    Metalsmith('test/fixtures/pattern')
      .use(permalinks({ pattern: ':title' }))
      .build(function(err){
        if (err) return done(err);
        equal('test/fixtures/pattern/expected', 'test/fixtures/pattern/build');
        done();
      });

  });
});