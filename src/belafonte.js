var WebTorrent = require('webtorrent');
var defaultAnnounceList = require('create-torrent').announceList;
var Buffer = require('safe-buffer').Buffer;

/**
 * Downloads cached copies of the site's pages over WebTorrent and loads them
 * into the document when a link is clicked.
 *
 * @param {Object[]} metadata Metadata for the site content.
 * @param {string} metadata[].url The URL for the content.
 * @param {string} metadata[].hash The info hash of the content.
 * @param {string|number} metadata[].date The date the content was last modified
 *   in RFC2822 format, in ISO 8601 format, or as the number of milliseconds
 *   since the Unix Epoch.
 * @param {Object} [options] Optional parameters.
 * @param {string} [options.marker] The string to prefix to page titles when
 *   they are loaded from the WebTorrent cache.
 * @param {Array} [options.announceList] The list of torrent trackers to use.
 */
function Belafonte(metadata, options) {
  var self = this;
  // Metadata is required to discover and verify torrents.
  if(!metadata) {
    throw new Error('You must provide metadata for the site content.');
  }
  // Index the metadata by URL.
  this.info = {};
  metadata.forEach(function(info) {
    self.info[info.url] = {hash: info.hash, date: info.date};
  });
  // Setup default options.
  options = options || {};
  this.marker = options.marker || '\u2605'; // Unicode star "★"
  this.announceList = options.announceList || defaultAnnounceList;
  // Serialize the announce list as magnet tracker parameters.
  this.trackers = this.announceList.map(function(trackers) {
    return trackers.map(function(tracker) {
      return 'tr=' + encodeURI(tracker);
    }).join('&');
  }).join('&');
  // Start the torrent client.
  this.client = new WebTorrent();
  // Add a resource to the cache when its torrent is complete.
  this.client.on('torrent', this.handleTorrent.bind(this));
  // Torrent links and and load pages from the cache when they are clicked.
  this.scanLinks();
  // Setup the navigation state for the current page.
  var currentURL = location.href.split('#')[0];
  window.history.replaceState({url: currentURL}, document.title, currentURL);
  // Load pages from the cache on browser history navigation.
  window.onpopstate = function(event) { self.loadPage(event.state.url); };
  // Seed the current page.
  this.seed(location.href.split('#')[0], document.documentElement.innerHTML);
}

/**
 * Cached resources keyed by info hash.
 */
Belafonte.cache = {};

/**
 * Active torrents keyed by info hash.
 */
Belafonte.torrents = {};

/**
 * Share an existing resource via torrent.
 *
 * @param {string} url The URL of the resource to share.
 * @param {string} resource The utf8 encoded content to share.
 */
Belafonte.prototype.seed = function(url, resource) {
  var info = this.info[url];
  // If there is no info for the URL or the resource is already being seeded,
  // then there is nothing to do.
  if(!info || Belafonte.torrents[info.hash]) { return; }
  // Pack the resource into a binary format the torrent client can use.
  var buffer = Buffer.from(resource, 'utf8');
  // The name and creation date are required for a deterministic info hash.
  var seedOptions = {
    name: url,
    creationDate: info.date,
    announce: this.announceList,
  };
  // Send the resource data and tracker options to the torrent client.
  this.client.seed(buffer, seedOptions, function(torrent) {
    Belafonte.torrents[torrent.infoHash] = torrent;
    Belafonte.cache[torrent.infoHash] = resource;
  });
};

/**
 * Request a resource via torrent.
 *
 * @param {string} url The URL of the resource to torrent.
 *
 * @returns {Torrent} torrent The torrent for the URL or undefined if not found.
 */
Belafonte.prototype.torrent = function(url){
  var info = this.info[url];
  // If there is no info for the resource, then there is nothing to do.
  if(!info) { return; }
  // Torrenting the resource by its magnet link.
  return Belafonte.torrents[info.hash] = (
    Belafonte.torrents[info.hash] ||
    this.client.add(this.magnetURI(url, info.hash))
  );
};

/**
 * Store the resource when a torrent is complete.
 *
 * @param {Torrent} torrent The complete torrent.
 */
Belafonte.prototype.handleTorrent = function(torrent) {
  // Unpack the buffer.
  torrent.files[0].getBuffer(function(err, buffer) {
    if (err) { return; }
    // Store the resource in the cache.
    Belafonte.cache[torrent.infoHash] = buffer.toString('utf8');
  });
};

/**
 * Start torrenting links and setup click handlers to load pages from the cache.
 */
Belafonte.prototype.scanLinks = function(){
  var self = this;
  var links = Array.prototype.slice.call(document.getElementsByTagName('a'));
  links.forEach(function(link) {
    // Only torrent links for this site.
    if(link.origin !== document.origin) { return; }
    // Remove the url hash like HTTP.
    var url = link.href.split('#')[0];
    // Get the torrent for this URL.
    var torrent = self.torrent(url);
    // If there is no torrent, then leave the link alone.
    if(!torrent) { return; }
    // Load the page from the cache when the link is clicked.
    link.onclick = function(event){ self.loadPage(event.target.href, event); };
  });
};

/**
 * Load a page from the cache.
 *
 * @param {string} url The URL of the page to load.
 * @param {Event} [event] The event to cancel if the page is cached.
 */
Belafonte.prototype.loadPage = function(url, event) {
  // Look for the page in the cache.
  var info = this.info[url];
  var resource = info && Belafonte.cache[info.hash];
  // If the page is not cached, then let the browser handle the link.
  if(!resource) return;
  if(event) {
    // Cancel the event to prevent the page from being fetched from the server.
    event.preventDefault();
    // Add the page to the browser history.
    window.history.pushState({url: url}, document.title, url);
  }
  // Insert the cached content into the page.
  document.documentElement.innerHTML = resource;
  // Mark the title to signify that the page was loaded from the cache.
  if(this.marker) { document.title = this.marker + ' ' + document.title; }
  // Setup the new links to load from the cache.
  this.scanLinks();
};

/**
 * Build the magnet URI for torrenting a resource.
 *
 * @param {string} url The URL of the resource.
 * @param {string} infoHash The info hash of the resource.
 *
 * @param {string} magnetURI The magnet link for the resource.
 */
Belafonte.prototype.magnetURI = function(url, infoHash) {
  return (
    'magnet:?' +
    // Identify the torrent using the info hash.
    'xt=urn:btih:' + infoHash + '&' +
    // Name the torrent after the resource's original URL.
    'dn=' + encodeURI(url) + '&' +
    // Discover peers the using the list of trackers.
    this.trackers
  );
};

module.exports = Belafonte;
