require('chromedriver');

const expect = require('chai').expect;
const webdriver = require('selenium-webdriver');
const By = webdriver.By;

const RequestLog = require('../helpers/request-log.js');
const URL = require('../helpers/url.js');
const finish = require('../helpers/finish.js');
const waitFor = require('../helpers/wait-for.js');

describe('Client', function() {
  this.timeout(5000);

  let Alice, Bob;

  beforeEach((done) => {
    Alice = new webdriver.Builder().forBrowser('chrome').build();
    Bob = new webdriver.Builder().forBrowser('chrome').build();
    const loadingPages = Promise.all([
      Alice.get(URL('test1.html')),
      Bob.get(URL('test2.html'))
    ]);
    finish(loadingPages, done);
  });

  afterEach((done) => {
    Alice.quit();
    Bob.quit();
    const resettingRequestLog = RequestLog.reset();
    finish(resettingRequestLog, done);
  });

  it('should seed the current page', (done) => {
    const seedingPages = waitFor(Alice).toTorrent(URL('test1.html'));
    finish(seedingPages, done);
  });

  it('should torrent the page links', (done) => {
    const torrentingPages = waitFor(Alice).toTorrent(URL('test2.html'));
    finish(torrentingPages, done);
  });

  it('should cache the page links', (done) => {
    const torrentingPages = waitFor(Alice).toCache(URL('test2.html'));
    finish(torrentingPages, done);
  });

  it('should load the page from the cache when a link is clicked', (done) => {
    const clickingLinks = RequestLog.get()
    .then((requests) => {
      expect(RequestLog.filter(requests, 'test1.html').length).to.equal(1);
      expect(RequestLog.filter(requests, 'test2.html').length).to.equal(1);
    })
    .then(() => waitFor(Alice).toCache(URL('test2.html')))
    .then(() => Alice.findElement(By.linkText('Test 2')).click())
    .then(() => Alice.getTitle())
    .then((title) => {
      expect(title).to.equal('\u2605 Test 2');
    })
    .then(() => RequestLog.get())
    .then((requests) => {
      expect(RequestLog.filter(requests, 'test1.html').length).to.equal(1);
      expect(RequestLog.filter(requests, 'test2.html').length).to.equal(1);
    });
    finish(clickingLinks, done);
  });
});
