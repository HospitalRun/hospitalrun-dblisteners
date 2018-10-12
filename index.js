var follow = require('follow');
var globSync   = require('glob').sync;

function setupFollow(config, dbName, listenersDir) {
  var nano = require('nano')(config.couchAuthDbURL);
  var db = nano.use(dbName);
  var couchFollowOpts = {
    db: config.couchAuthDbURL + '/' + dbName,
    include_docs: true,
    since: config.couchDbChangesSince,
    query_params: {
      conflicts: true,
    },
  };
  var dbListeners = globSync('./' + listenersDir + '/**/*.js', {cwd: __dirname}).map(require);
  follow(couchFollowOpts, function(error, change) {
    if (!error) {
      dbListeners.forEach(function(listener) {
        listener(change, db, config);
      });
    }
  });
}

module.exports = function (config) {

  if (config.isMultitenancy) {

    var nano = require('nano')(config.couchAuthDbURL);
    nano.db.list()
      .then(function (dbNames) {

        var filteredDbs = dbNames.filter(function (value) {
          return !value.startsWith('_') && value !== 'pushinfo' && value !== 'config';
        });

        filteredDbs.forEach(function (dbName) {
          setupFollow(config, dbName, 'dblisteners');
        });

        setupFollow(config, '_users', 'userdb-listeners');
      });

  } else {
    setupFollow(config, 'main', 'dblisteners');
    setupFollow(config, '_users', 'userdb-listeners');
  }

};
