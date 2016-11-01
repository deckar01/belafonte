const WebTorrent = require('webtorrent');
const defaultAnnounceList = require('create-torrent').announceList;
const toBuffer = require('blob-to-buffer');

class Client {
  /**
   * Downloads cached copies of the site's pages over WebTorrent and loads them
   * into the document when a link is clicked.
   * @constructor
   *
   * @param {Object} infoHashes Info hashes for the site content keyed by URL.
   * @param {Object} [options] Optional parameters.
   * @param {string} [options.marker] The string to prefix to page titles when
   *   they are loaded from the WebTorrent cache.
   * @param {Array} [options.announceList] The list of torrent trackers to use.
   */
  constructor(infoHashes, { marker, announceList } = {}) {
    // Metadata is required to discover and verify torrents.
    if (!infoHashes) {
      throw new Error('You must provide info hashes for the site content.');
    }
    this.infoHashes = infoHashes;
    // Setup default options.
    this.marker = marker || '\u2605'; // Unicode star "★"
    this.announceList = announceList || defaultAnnounceList;
    // Serialize the announce list as magnet tracker parameters.
    this.trackers = this.announceList.map((trackers) => {
      return trackers.map((tracker) => 'tr=' + encodeURI(tracker)).join('&');
    }).join('&');
    // Cached resources keyed by info hash.
    this.cache = {};
    // Active torrents keyed by info hash.
    this.torrents = {};
    // Start the torrent client.
    this.torrentClient = new WebTorrent();
    // Add a resource to the cache when its torrent is complete.
    this.torrentClient.on('torrent', this.handleTorrent.bind(this));
    // Torrent links and and load pages from the cache when they are clicked.
    this.scanLinks();
    // Setup the navigation state for the current page.
    const pageURL = location.href.split('#')[0];
    window.history.replaceState({ url: pageURL }, document.title, pageURL);
    // Load pages from the cache on browser history navigation.
    window.onpopstate = (event) => this.loadPage(event.state.url);
    // Seed the current page.
    this.seed(pageURL);
  }

  /**
   * Get the original resource data from the browser's cache.
   *
   * @param {string} url The URL of the resource.
   * @param {Function} callback The callback that recieves the buffer.
   */
  static getResourceBuffer(url, callback) {
    const headers = new Headers();
    // Fetch the resource from any cache.
    headers.append('cache-control', 'public, max-age=315360000');
    return fetch(url, { method: 'GET', headers: headers })
    .then((response) => {
      if (!response.ok) { return null; }
      // Load the resource as a binary blob.
      return response.blob();
    })
    .then((blob) => {
      // If the resource is empty or missing don't call back.
      if (!blob) { return; }
      // Pack the blob data into a buffer.
      toBuffer(blob, (err, buffer) => {
        if (err) { return; }
        callback(buffer);
      });
    });
  }

  /**
   * Share an existing resource via torrent.
   *
   * @param {string} url The URL of the resource to share.
   * @param {string} resource The utf8 encoded content to share.
   */
  seed(url) {
    const infoHash = this.infoHashes[url];
    // If there is no info hash or the resource is already being seeded, then
    // there is nothing to do.
    if (!infoHash || this.torrents[infoHash]) { return; }
    Client.getResourceBuffer(url, (buffer) => {
      // The name and creation date are required for a deterministic info hash.
      const seedOptions = {
        name: url,
        announce: this.announceList
      };
      // Send the resource data and tracker options to the torrent client.
      this.torrentClient.seed(buffer, seedOptions, (torrent) => {
        this.torrents[torrent.infoHash] = torrent;
        this.cache[torrent.infoHash] = buffer.toString('utf8');
      });
    });
  }

  /**
   * Request a resource via torrent.
   *
   * @param {string} url The URL of the resource to torrent.
   *
   * @returns {Torrent} torrent The torrent for the URL or null if not found.
   */
  torrent(url) {
    const infoHash = this.infoHashes[url];
    // If there is no info for the resource, then there is nothing to do.
    if (!infoHash) { return null; }
    // Save the torrent to the torrent list.
    this.torrents[infoHash] = (
      // Use the existing torrent if it has already been added.
      this.torrents[infoHash] ||
      // Torrent the resource by its magnet link.
      this.torrentClient.add(this.magnetURI(url, infoHash))
    );
    // Return the torrent object.
    return this.torrents[infoHash];
  }

  /**
   * Store the resource when a torrent is complete.
   *
   * @param {Torrent} torrent The complete torrent.
   */
  handleTorrent(torrent) {
    // Unpack the buffer.
    torrent.files[0].getBuffer((err, buffer) => {
      if (err) { return; }
      // Store the resource in the cache.
      this.cache[torrent.infoHash] = buffer.toString('utf8');
    });
  }

  /**
   * Start torrenting the links on the page.
   */
  scanLinks() {
    // Get all the link elements as an array.
    const [...links] = document.getElementsByTagName('a');
    // Try to start torrenting all of the links.
    links.forEach((link) => {
      // Only torrent links for this site.
      if (link.origin !== location.origin) { return; }
      // Remove the url hash like HTTP.
      const url = link.href.split('#')[0];
      // Get the torrent for this URL.
      const torrent = this.torrent(url);
      // If there is no torrent, then leave the link alone.
      if (!torrent) { return; }
      // Load the page from the cache when the link is clicked.
      link.onclick = (event) => this.loadPage(event.target.href, event);
    });
  }

  /**
   * Load a page from the cache.
   *
   * @param {string} url The URL of the page to load.
   * @param {Event} [event] The event to cancel if the page is cached.
   */
  loadPage(url, event) {
    // Look for the page in the cache.
    const infoHash = this.infoHashes[url];
    const resource = this.cache[infoHash];
    // If the page is not cached, then let the browser handle the link.
    if (!resource) return;
    if (event) {
      // Cancel the event to prevent the page from being requested.
      event.preventDefault();
      // Add the page to the browser history.
      window.history.pushState({ url: url }, document.title, url);
    }
    // Insert the cached content into the page.
    document.documentElement.innerHTML = resource;
    // Mark the title to signify that the page was loaded from the cache.
    if (this.marker) { document.title = `${this.marker} ${document.title}`; }
    // Setup the new links to load from the cache.
    this.scanLinks();
  }

  /**
   * Build the magnet URI for torrenting a resource.
   *
   * @param {string} url The URL of the resource.
   * @param {string} infoHash The info hash of the resource.
   *
   * @param {string} magnetURI The magnet link for the resource.
   */
  magnetURI(url, infoHash) {
    return (
      'magnet:?' +
      // Identify the torrent using the info hash.
      `xt=urn:btih:${infoHash}&` +
      // Name the torrent after the resource's original URL.
      `dn=${encodeURI(url)}&` +
      // Discover peers the using the list of trackers.
      this.trackers
    );
  }
}

module.exports = Client;
