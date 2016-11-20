const BASE_URL = 'http://localhost:8000/test/fixtures/';

// Expand the page name to a full URL for the local web server's test fixtures.
function URL(page) { return BASE_URL + page; }

module.exports = URL;
