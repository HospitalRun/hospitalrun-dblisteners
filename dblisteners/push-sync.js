var webpush = require('web-push');

module.exports = function(change, maindb, config) {
  if (!config.disableOfflineSync && config.pushContactInfo && config.pushPublicKey && config.pushPrivateKey) {
    var nano = require('nano')(config.couchAuthDbURL);
    var pushDB = nano.use('pushinfo');
    webpush.setVapidDetails(
      config.pushContactInfo,
      config.pushPublicKey,
      config.pushPrivateKey
    );

    pushDB.list({include_docs:true}, function(err, subscriptions) {
      subscriptions.rows.forEach(function(subscriptionInfo) {
        if (subscriptionInfo.doc && subscriptionInfo.doc.dbInfo && subscriptionInfo.doc.dbInfo.remoteSeq < change.seq) {
          var notificationInfo = JSON.stringify({
            seq: change.seq,
            type: 'couchDBChange'
          });
          webpush.sendNotification(subscriptionInfo.doc.subscription, notificationInfo).catch(function(err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              pushDB.destroy(subscriptionInfo.doc._id, subscriptionInfo.doc._rev);
            } else {
              console.log('Subscription is no longer valid: ', err);
            }
          });
        }
      });
    });
  }
};
