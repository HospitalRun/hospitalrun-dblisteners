/**
 * Merge conflicts by using the modifiedFields to determine who modified what last.
 * Performs a field level merge by comparing modifiedField timestamps (latest wins).
 */
module.exports = function(change, userdb) {
  if (change.doc.deleted === true) {
    change.doc._deleted = true;
    delete change.doc.deleted;
    userdb.insert(change.doc, function(err) {
      if (err) {
        console.log('Error deleting user:' + change.doc.id + JSON.stringify(err));
      }
    });
  }
};
