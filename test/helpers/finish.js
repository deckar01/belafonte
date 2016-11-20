// Calls a node style callback with the results of a promise.
function finish(promise, done) {
  promise
  .then(() => { done(); })
  .catch((err) => { done(err || 'error'); });
}

module.exports = finish;
