var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

function getFilePaths(type, fileName, config) {
  switch(type) {
    case 'photo': {
      return {
        fileName: '/patientimages' + fileName,
        filePath: config.imagesdir + fileName
      };
    }
    case 'attachment': {
      return {
        fileName: '/attachments' + fileName,
        filePath: config.attachmentsDir + fileName
      };
    }
  }
}
/**
 * Upload file that is temporarily stored as attachment.
 */
module.exports = function(change, maindb, config) {
  if (change.doc && change.doc.data.localFile && change.doc.data.localFile === true && change.doc._attachments) {
    try {

      var currentDoc = change.doc;
      var docType = currentDoc._id.substring(0, currentDoc._id.indexOf('_'));
      var filePaths = getFilePaths(docType, currentDoc.data.fileName, config);

      // Make the directory to the file if it doesn't exist
      mkdirp(path.dirname(filePaths.filePath), function(err) {
        if (err) {
          console.log('Error mkdirp for ' + path.dirname(filePaths.filePath), err);
          return;
        }
        // Get the file from the couchdb attachment
        maindb.attachment.get(currentDoc._id, 'file', function(err, body) {
          if (err) {
            console.log('Error getting file attachment for: ', currentDoc);
            return;
          }
          // Write the file to the filesystem
          fs.writeFile(filePaths.filePath, body, function(err) {
            if (err) {
              console.log('Error writing file: ' + filePaths.filePath, err);
              return;
            }
            // Remove the attachment from the document
            maindb.attachment.destroy(currentDoc._id, 'file', {rev: currentDoc._rev }, function(err, body) {
              if (err) {
                console.log('Error deleting attachment on ' + currentDoc._id + ', rev:' + currentDoc._rev, err);
                return;
              }
              currentDoc._rev = body.rev;
              currentDoc.data.url = filePaths;
              currentDoc.data.localFile = false;
              delete currentDoc._attachments;
              // Update the url
              maindb.insert(currentDoc, currentDoc._id, function(err) {
                if (err) {
                  console.log('Error updating url for file:' + currentDoc.id, err);
                }
              });
            });
          });
        });
      });
    } catch (ex) {
      console.log('Error handling file-upload: ',ex);
    }
  }
};
