#! /usr/bin/env node

var WebTorrent = require('webtorrent-hybrid');
var promisify = require('promisify-node');
var fs = promisify('fs');
var path = require('path');
var url = require('url');

var Command = require('commander');
var version = require('../../package.json').version;
var defaultAnnounceList = require('create-torrent').announceList;

Command
.version(version)
.option('-o, --output <file>', 'Save the hash list to a JSON file')
.option('-p, --pretty', 'Format the JSON output')
.option('-s, --seed', 'Seed the files')
.option('-t, --trackers <file>', 'Read the tracker list from a JSON file')
.arguments('<origin> [files...]')
.action(function(origin, files) {
  Command.origin = origin;
  getTrackers()
  .then(function(trackers) {
    Command.announceList = trackers;
    // Use the WebTorrent client to calculate info hashes.
    Command.torrentClient = new WebTorrent();
    // Wait for all the files to be read and hashed.
    return Promise.all(files.map(getInfoHash));
  })
  .then(function(infoHashes) {
    // Stop the WebTorrent client unless it needs to continue seeding.
    if(!Command.seed) { Command.torrentClient.destroy(); }
    // Index the info hashes by URL.
    var metadata = {};
    infoHashes.forEach(function(file) {
      metadata[file.name] = file.infoHash;
    });
    // Indent the output if it needs to be "pretty".
    var indent = Command.pretty && 2 || null;
    // Encode the metadata as a JSON string.
    var output = JSON.stringify(metadata, null, indent);
    if(Command.output) {
      // Write the metadata to the specified file.
      return fs.writeFile(Command.output, output);
    } else {
      // Print the metadata as standard output.
      console.log(output);
    }
  })
  .catch(function(err) {
    // Log the error to the console.
    console.error(err.message);
    // Ensure the WebTorrent client is destroyed to free the process.
    if(Command.torrentClient && !Command.torrentClient.destroyed) {
      Command.torrentClient.destroy();
    }
  });
});

// Run the command.
Command.parse(process.argv);

/**
 * Get the tracker list from a file or use the default tracker list.
 *
 * @return {Promise.<Object>} A promise for the tracker list.
 */
function getTrackers() {
  if(Command.trackers) {
    // Read the tracker list from a file.
    return fs.readFile(Command.trackers)
    .then(function(trackerData) {
      try {
        // Parse the tracker list as JSON
        return JSON.parse(trackerData);
      } catch(err) {
        // Add context to the JSON parsing error.
        err.message = 'Error parsing trackers: ' + err.message;
        // Reject the promise if the JSON is invalid.
        return Promise.reject(err);
      }
    });
  } else {
    // Use the default tracker list.
    return Promise.resolve(defaultAnnounceList);
  }
}

/**
 * Compute the info hash for a file.
 *
 * @param {string} file The path to a file.
 *
 * @return {Promise.<Object>} A promise for the info hash.
 */
function getInfoHash(file) {
  // Open the file.
  return openReadStream(file)
  .then(function (stream) {
    return new Promise(function(resolve, reject) {
      // Normalize file paths relative to the current directory.
      file = path.relative(__dirname, file);
      var seedOptions = {
        // Name the torrent after the full URL to the file.
        name: url.resolve(Command.origin, file),
        // Seed to the configured the tracker list.
        announce: Command.announceList,
      };
      // WebTorrent requires seeding the file to compute the info hash.
      var torrent = Command.torrentClient.seed(stream, seedOptions)
      // Get the info hash as soon as it is computed.
      .on('infoHash', function() {
        // Remove the torrent if the file does not need to be seeded.
        if(!Command.seed) { Command.torrentClient.remove(torrent); }
        // Return the url and info hash.
        resolve({name: seedOptions.name, infoHash: torrent.infoHash});
      })
      // Reject the promise if the file can't be seeded.
      .on('error', reject);
    });
  });
}

/**
 * Open a stream for reading a file.
 *
 * @param {string} file The path to a file.
 *
 * @return {Promise.<ReadStream>} A promise for an open read stream to the file.
 */
function openReadStream(file) {
  return new Promise(function(resolve, reject) {
    // Try to open a read stream to the file.
    var stream = fs.createReadStream(file)
    // Return the stream as soon as it is open.
    .on('open', function() { resolve(stream); })
    // Reject the promise if the file can not be opened.
    .on('error', reject);
  });
}
