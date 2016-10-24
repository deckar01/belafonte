# CacheP2P

**CacheP2P** is a highly distributed [cache][wikipedia/cache] platform based on
[WebTorrent](https://webtorrent.io/) and runs only in the **browser**.

[wikipedia/cache]: https://en.wikipedia.org/wiki/Cache_(computing)

It is a javascript library that once included in a website, makes every new user
a mirror of the specific URL he has opened and allows it to serve it to all the
other users that also are accessing the same website, so the website's server
doesn't have to.

This way users can share the content between themselves, reducing the number of
requests for static content to the server.

If the website crashes or has problems (the script can be included in the
server's error page), all the content that users were accessing in that moment
can be retrieved from one another and as long as there are users accessing it
no problem will be seen.

For more information, please read the [documentation][documentation] or
[how it works][api] page.

[documentation]: http://www.cachep2p.com/documentation.html
[api]: http://www.cachep2p.com/api.html

### License

MIT. Copyright (c) [CacheP2P](https://www.CacheP2P.com)
