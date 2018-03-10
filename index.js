var S3FS = require('s3fs');
var crypto = require('crypto');
var gm = require('gm');
var mime = require('mime');
var path = require('path');


const DEFAULT_FORMAT = 'jpg';

function S3Storage(opts) {
  if (!opts.bucket) {
    throw new Error('bucket is required');
  }
  if (!opts.secretAccessKey) {
    throw new Error('secretAccessKey is required');
  }
  if (!opts.accessKeyId) {
    throw new Error('accessKeyId is required');
  }
  if (!opts.region) {
    throw new Error('region is required');
  }
  if (!opts.dirname) {
    throw new Error('dirname is required');
  }
  if (!opts.gm) {
    throw new Error('gm object is required');
  }
  if (!opts.gm.process) {
    throw new Error('gm process function is required');
  }
  this.options = opts;
  this.options.filename = (opts.filename || getFilename)
  this.s3fs = new S3FS(opts.bucket, opts);
  if(!this.options.s3) {
    this.options.s3 = {};
  }
}

function getFilename(req, file, cb) {
  crypto.pseudoRandomBytes(16, function(err, raw) {
    cb(err, err ? undefined : raw.toString('hex'));
  });
}

S3Storage.prototype._handleFile = function(req, file, cb) {
  var self = this;
  self.options.filename(req, file, function(err, filename) {
    if (err) {
      return cb(err);
    }
    filename = filename.toString();
    var filePath = path.join('/', self.options.dirname, filename);
    var contentType;
    if(self.options.gm.format) {
      contentType = mime.getType(self.options.gm.format);
    } else {
      contentType = mime.getType(DEFAULT_FORMAT);
    }
    var s3options = self.options.s3;
    s3options.ContentType = contentType;
    var outStream = self.s3fs.createWriteStream(filePath, s3options);
    
    self.options.gm.process(file.stream, outStream, function() {});
    
//     gm(file.stream).size((err, size) => {
//       console.log('size befor1:', size);
//     });
    
    //     gm(file.stream)
//       .resize(self.options.gm.width , self.options.gm.height , self.options.gm.options)
//       .autoOrient()
//       .stream(self.options.gm.format || DEFAULT_FORMAT)
//       .pipe(outStream);
    
//     let img = gm(file.stream).autoOrient().stream(self.options.gm.format || DEFAULT_FORMAT).pipe(outStream);
//     .toBuffer((err, noExifImg) => {
//       console.log("now a buffer")
//       gm(noExifImg)
//       .size((err, size) => {
//          console.log('size after:', size);
//       })
//       .resize(self.options.gm.width , self.options.gm.height , self.options.gm.options)
//       .stream(self.options.gm.format || DEFAULT_FORMAT)
//       .pipe(outStream);
//     });
    
    outStream.on('error', cb);
    outStream.on('finish', function() {
      cb(null, {
        size: outStream.bytesWritten,
        key: filename,
        location: 'https://' + self.options.bucket + '.s3.amazonaws.com' + filePath
      });
    });
  });
};

S3Storage.prototype._removeFile = function(req, file, cb) {
  this.s3fs.unlink(file.key, cb);
};

module.exports = function(opts) {
  return new S3Storage(opts);
};
