class RequestTracker {
  // Dispatches API handlers and serves static assets.
  static middleware(request, response, next) {
    var handler = RequestTracker.API[request.url] || RequestTracker.default;
    handler(request, response, next);
  }

  // Handles requests for URLs that are not part of the API.
  static default(request, response, next) {
    // Store the request details.
    RequestTracker.requests.push({
      method: request.method,
      url: request.url
    });
    // Tell the browser to cache the assets.
    response.setHeader('cache-control', 'public, max-age=315360000');
    // Serve the
    next();
  }

  // Register a middleware handler that runs when it's URL is requested.
  static register(url, handler) {
    RequestTracker.API[url] = handler;
  }
}

// The list of requests.
RequestTracker.requests = [];

// The request handlers keyed by URL.
RequestTracker.API = {};

// Get the list of requests as JSON.
RequestTracker.register('/requests', (request, response) => {
  response.setHeader('content-type', 'text/json');
  response.end(JSON.stringify(RequestTracker.requests));
});

// Clear the list of requests.
RequestTracker.register('/reset', (request, response) => {
  RequestTracker.requests = [];
  response.end('OK');
});

module.exports = RequestTracker;
