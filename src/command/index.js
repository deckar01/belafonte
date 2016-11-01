#! /usr/bin/env node

const WebTorrent = require('webtorrent-hybrid');
const promisify = require('promisify-node');
const fs = promisify('fs');
const path = require('path');
const url = require('url');

const Command = require('commander');
const version = require('../../package.json').version;
const defaultAnnounceList = require('create-torrent').announceList;

/**
 * Get the tracker list from a file or use the default tracker list.
 *
 * @return {Promise.<Object>} A promise for the tracker list.
 */
function getTrackers() {
  if (!Command.trackers) {
    // Use the default tracker list.
    return Promise.resolve(defaultAnnounceList);
  }
  // Read the tracker list from a file.
  return fs.readFile(Command.trackers)
  .then((trackerData) => {
    try {
      // Parse the tracker list as JSON
      return JSON.parse(trackerData);
    } catch (err) {
      // Add context to the JSON parsing error.
      err.message = 'Error parsing trackers: ' + err.message;
      // Reject the promise if the JSON is invalid.
      return Promise.reject(err);
    }
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
  return new Promise((resolve, reject) => {
    // Try to open a read stream to the file.
    const stream = fs.createReadStream(file)
    // Return the stream as soon as it is open.
    .on('open', () => resolve(stream))
    // Reject the promise if the file can not be opened.
    .on('error', reject);
  });
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
  .then((stream) => {
    return new Promise((resolve, reject) => {
      // Normalize file paths relative to the current directory.
      const relativePath = path.relative(__dirname, file);
      const seedOptions = {
        // Name the torrent after the full URL to the file.
        name: url.resolve(Command.origin, relativePath),
        // Seed to the configured the tracker list.
        announce: Command.announceList
      };
      // WebTorrent requires seeding the file to compute the info hash.
      const torrent = Command.torrentClient.seed(stream, seedOptions)
      // Get the info hash as soon as it is computed.
      .on('infoHash', () => {
        // Remove the torrent if the file does not need to be seeded.
        if (!Command.seed) { Command.torrentClient.remove(torrent); }
        // Return the url and info hash.
        resolve({ name: seedOptions.name, infoHash: torrent.infoHash });
      })
      // Reject the promise if the file can't be seeded.
      .on('error', reject);
    });
  });
}

Command
.version(version)
.option('-o, --output <file>', 'Save the hash list to a JSON file')
.option('-p, --pretty', 'Format the JSON output')
.option('-s, --seed', 'Seed the files')
.option('-t, --trackers <file>', 'Read the tracker list from a JSON file')
.arguments('<origin> [files...]')
.action((origin, files) => {
  Command.origin = origin;
  getTrackers()
  .then((trackers) => {
    Command.announceList = trackers;
    // Use the WebTorrent client to calculate info hashes.
    Command.torrentClient = new WebTorrent();
    // Wait for all the files to be read and hashed.
    return Promise.all(files.map(getInfoHash));
  })
  .then((infoHashes) => {
    // Stop the WebTorrent client unless it needs to continue seeding.
    if (!Command.seed) { Command.torrentClient.destroy(); }
    // Index the info hashes by URL.
    const metadata = {};
    infoHashes.forEach((file) => { metadata[file.name] = file.infoHash; });
    // Indent the output if it needs to be "pretty".
    const indent = Command.pretty ? 2 : null;
    // Encode the metadata as a JSON string.
    const output = JSON.stringify(metadata, null, indent);
    if (!Command.output) {
      // Print the metadata as standard output.
      console.log(output);
      return null;
    }
    // Write the metadata to the specified file.
    return fs.writeFile(Command.output, output);
  })
  .catch((err) => {
    // Log the error to the console.
    console.error(err.message);
    // Ensure the WebTorrent client is destroyed to free the process.
    if (Command.torrentClient && !Command.torrentClient.destroyed) {
      Command.torrentClient.destroy();
    }
  });
});

// Run the command.
Command.parse(process.argv);
