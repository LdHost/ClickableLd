/*
 * This fetch wrapper stops the browser from logging error messages on every 404.
 */

self.addEventListener('install', e => {
    self.skipWaiting(); // update even if other tabs are open in the browser
});

const proxyResponse = async (orig, evt) => {
  if (orig.status < 400)
    return orig;

  const headers = new Headers(orig.headers);
  headers.set('X-status', orig.status);
  headers.set('X-statusText', orig.statusText);
  return new Response(await orig.text(), {
    status: 201,
    statusText: "Accepted",
    headers: headers,
  });
}

self.addEventListener('fetch', evt => evt.respondWith(
  fetch(evt.request).then(orig => proxyResponse(orig, evt))
) );
