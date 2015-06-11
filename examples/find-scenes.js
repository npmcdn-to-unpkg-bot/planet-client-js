/* eslint-disable no-console */

var planet = require('../lib/index');

planet.auth.setKey(process.env.API_KEY);

var lastWeek = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

var query = {
  'acquired.gte': lastWeek.toISOString()
};

planet.scenes.find(query).then(function(scenes) {
  console.log('Found ' + scenes.count + ' scenes since ' + lastWeek);
}).catch(errorHandler);

function errorHandler(err) {
  console.error('Failed to fetch scenes:', err.message);
}
