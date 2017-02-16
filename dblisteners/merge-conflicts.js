var uuid = require('uuid');
/**
 * Merge conflicts by using the modifiedFields to determine who modified what last.
 * Performs a field level merge by comparing modifiedField timestamps (latest wins).
 */
module.exports = function(change, maindb) {
  function resolveConflicts(conflictId, conflicts, currentDoc, callback) {
    maindb.get(conflictId, {open_revs: JSON.stringify(conflicts, null, 2)}, function(err, body) {
      var compareObj;
      var currentModifiedDate;
      var i;
      var key;
      var modifiedDate;
      var updateDocument = false;
      var updateProperty;
      var originalDoc = JSON.parse(JSON.stringify(currentDoc));
      var conflictDocs = [];

      if (!currentDoc.modifiedFields) {
        currentDoc.modifiedFields = {};
      }
      if (err) {
        callback(err);
      } else if (body.length) {
        for (i = 0;i < body.length;i++) {
          compareObj = body[i].ok;
          conflictDocs.push(compareObj);
          if (compareObj.modifiedFields) {
            for (key in compareObj.modifiedFields) {
              if (currentDoc[key] !== compareObj[key]) {
                updateProperty = false;
                modifiedDate = new Date(compareObj.modifiedFields[key]);
                if (currentDoc.modifiedFields[key]) {
                  currentModifiedDate = new Date(currentDoc.modifiedFields[key]);
                  if (modifiedDate.getTime() > currentModifiedDate.getTime()) {
                    updateProperty = true;
                  }
                } else {
                  updateProperty = true;
                }
              }
              if (updateProperty) {
                updateDocument = true;
                currentDoc.modifiedFields[key] = modifiedDate;
                currentDoc[key] = compareObj[key];
              }
            }
          }
        }
        if (updateDocument) {
          var resolvedConflict = {
            _id: 'resolvedConflict_2_' + uuid.v4(),
            data: {
              original: originalDoc,
              conflicts: conflictDocs
            }
          };
          maindb.insert(resolvedConflict, function(err) {
            if (err) {
              callback('Error saving resolved conflicts:' + JSON.stringify(err));
            } else {
              delete currentDoc._conflicts;
              maindb.insert(currentDoc, currentDoc._id, function(err, response) {
                if (!err && response.ok) {
                  cleanupConflicts(currentDoc, conflicts, callback);
                } else {
                  if (!err) {
                    err = response;
                  }
                  callback('Error updating latest doc with merged data:' + JSON.stringify(err));
                }
              });
            }
          });
        } else {
          cleanupConflicts(currentDoc, conflicts, callback);
        }
      }
    });
  }

  function cleanupConflicts(currentDoc, conflicts, callback) {
    var recordsToDelete = [];
    for (var i = 0;i < conflicts.length;i++) {
      var recordToDelete = {
        _id: currentDoc._id,
        _rev: conflicts[i],
        _deleted: true
      };
      recordsToDelete.push(recordToDelete);
    }
    if (recordsToDelete.length > 0) {
      maindb.bulk({docs: recordsToDelete}, function(err, response) {
        if (err) {
          callback('Error deleting conflicting revs:' + JSON.stringify(err, null, 2));
        } else {
          callback(err, response);
        }
      });
    }
  }

  if (change.doc && change.doc._conflicts) {
    var conflicts = change.doc._conflicts;
    var currentDoc = change.doc;
    resolveConflicts(change.id, conflicts, currentDoc, function(err) {
      if (err) {
        console.log('ERROR resolving conflicts: ' + JSON.stringify(err, null, 2));
      }
    });
  }
};
