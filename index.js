var follow = require('follow');
var globSync   = require('glob').sync;

function setupFollow(config, dbName, listenersDir) {
  var nano = require('nano')(config.couchAuthDbURL);
  var maindb = nano.use(dbName);
  var couchFollowOpts = {
    db: config.couchAuthDbURL + '/' + dbName,
    include_docs: true,
    since: config.couchDbChangesSince,
    query_params: {
      conflicts: true,
    },
  };
  var dbListeners = globSync('./' + listenersDir + '/**/*.js', { cwd: __dirname }).map(require);
  follow(couchFollowOpts, function(error, change) {
    if (!error) {
      dbListeners.forEach(function(listener) {
        listener(change, maindb, config);
      });
    }
  });
}

module.exports = function(config) {
  setupFollow(config, 'main', 'dblisteners');
  setupFollow(config, '_users', 'userdb-listeners');
};
