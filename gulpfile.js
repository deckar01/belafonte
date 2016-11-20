var gulp = require('gulp');
var webserver = require('gulp-webserver');
var selenium = require('selenium-standalone');
var mocha = require('gulp-mocha');
var RequestTracker = require('./test/helpers/request-tracker.js');

// Serve the project root with middleware for tracking requests.
gulp.task('serve', function () {
  webserver.testServer = gulp.src('.')
  .pipe(webserver({
    port: 8000,
    middleware: RequestTracker.middleware
  }));
});

// Start a selenium server.
gulp.task('selenium', function (done) {
  selenium.install(function (err) {
    if (err) { return done(err); }
    selenium.start(function (err, child) {
      if (err) { return done(err); }
      selenium.child = child;
      done();
    });
  });
});

// Run the integration tests for the client with mocha.
gulp.task('integration:client', ['serve', 'selenium'], function () {
  return gulp.src('test/specs/**/*.js', {read: false})
  .pipe(mocha())
  .on('error', cleanupTest);
});

// Run the tests and cleanup afterwards.
gulp.task('test', ['integration:client'], function () {
  cleanupTest();
});

// Stop the web server and selenium server.
function cleanupTest() {
  webserver.testServer.emit('kill');
  selenium.child.kill();
}
