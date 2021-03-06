/* eslint-disable no-console */

var planet = require('../api/index');

planet.auth.setKey(process.env.PL_API_KEY);

var mosaics = [];
var limit = 500;

function keepRequesting(promise) {
  return promise.then(function(page) {
    mosaics = mosaics.concat(page.data.mosaics);
    console.log('got ' + mosaics.length + ' mosaics');
    if (page.next && mosaics.length < limit) {
      return keepRequesting(page.next());
    }
  });
}

keepRequesting(planet.mosaics.search())
  .then(function() {
    console.log('done fetching');
  }).catch(function(err) {
    console.error('Failed to fetch mosaics:', err.message);
  });
