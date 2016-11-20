const request = require('request-promise-native');

const BASE_URL = 'http://localhost:8000/';

// A client for the RequestTracker request history API.
class RequestLog {
  // Filter the requests for a test fixture page.
  static filter(requests, page) {
    return requests.filter((request) => request.url == '/test/fixtures/' + page);
  }

  // Fetch the request history form the web server.
  static get() {
    return request({uri: BASE_URL + 'requests', json: true});
  }

  // Reset the web server's request history.
  static reset() {
    return request(BASE_URL + 'reset');
  }
}

module.exports = RequestLog;
