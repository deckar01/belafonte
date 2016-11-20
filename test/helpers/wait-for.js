/* global belafonte, Belafonte */

// Check if the client has added a page to the cache.
function isCached(url) {
  var infoHash = belafonte.infoHashes[url];
  return !!(infoHash && Belafonte.cache[infoHash]);
}

// Check if the client is torrenting a page.
function isTorrenting(url) {
  var infoHash = belafonte.infoHashes[url];
  return !!(infoHash && Belafonte.torrents[infoHash]);
}

// Wait for the client in a selenium driver to complete a task.
class WaitFor {
  constructor(driver) {
    this.driver = driver;
  }

  // Wait for the client to add a page to the cache.
  toCache(url) {
    return this.driver.wait(() => this.driver.executeScript(isCached, url));
  }

  // Wait for the client to start torrenting a page.
  toTorrent(url){
    return this.driver.wait(() => this.driver.executeScript(isTorrenting, url));
  }
}

// Convenience wrapper to encapsulate constructor syntax.
function waitFor(driver) {
  return new WaitFor(driver);
}

module.exports = waitFor;
