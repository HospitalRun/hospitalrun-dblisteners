var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var url = require('url');
var AWS = require('aws-sdk');

function getFilePaths(type, fileName, config) {
  switch (type) {
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

function storeFile(config, body, filePath, cb) {

  console.log(filePath);
  if (filePath.startsWith('s3://')) {

    var q = url.parse(filePath, false, true);
    console.log(q.hostname);
    console.log(q.path);

    var paths = q.path.split('/');
    var bucket = paths[1];
    paths.splice(0, 2);
    var s3path = paths.join('/');

    console.log([bucket, s3path]);
    var ep = new AWS.Endpoint(q.hostname);
    var s3 = new AWS.S3({
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
      endpoint: ep
    });

    var params = {
      Key: s3path,
      Bucket: bucket,
      Body: body
    };
    s3.upload(params, function (err) {
      cb(err);
    });

  } else {

    // Make the directory to the file if it doesn't exist
    mkdirp(path.dirname(filePath), function (err) {
      if (err) {
        console.log('Error mkdirp for ' + path.dirname(filePath), err);
        cb(err);
        return;
      }

      // Write the file to the filesystem
      fs.writeFile(filePaths.filePath, body, function (err) {
        if (err) {
          console.log('Error writing file: ' + filePath, err);
          cb(err);
          return;
        }

        cb(null);
      });
    });
  }
}

/**
 * Upload file that is temporarily stored as attachment.
 */
module.exports = function(change, maindb, config) {

  if (change.doc && change.doc.data && change.doc.data.localFile && change.doc.data.localFile === true && change.doc._attachments) {
    try {

      var currentDoc = change.doc;
      var docType = currentDoc._id.substring(0, currentDoc._id.indexOf('_'));
      var filePaths = getFilePaths(docType, currentDoc.data.fileName, config);

      console.log([currentDoc._id, filePaths.fileName, filePaths.filePath]);

      // Get the file from the couchdb attachment
      maindb.attachment.get(currentDoc._id, 'file', function (err, body) {
        if (err) {
          console.log('Error getting file attachment for: ', currentDoc, err);
          return;
        }

        storeFile(config, body, filePaths.filePath, function (err) {
          if (err) {
            console.log('Error saving file attachment to: ', filePaths.filePath, err);
            return;
          }

          // Remove the attachment from the document
          maindb.attachment.destroy(currentDoc._id, 'file', { rev: currentDoc._rev }, function (err, body) {
            if (err) {
              console.log('Error deleting attachment on ' + currentDoc._id + ', rev:' + currentDoc._rev, err);
              return;
            }
            currentDoc._rev = body.rev;
            currentDoc.data.url = filePaths.fileName;
            currentDoc.data.localFile = false;
            currentDoc.data.files = [];
            delete currentDoc._attachments;
            // Update the url
            maindb.insert(currentDoc, currentDoc._id, function (err) {
              if (err) {
                console.log('Error updating url for file:' + currentDoc.id, err);
              }
            });
          });
        });
      });
    } catch (ex) {
      console.log('Error handling file-upload: ',ex);
    }
  }
};
