#!/usr/bin/env node

var crypto      = require('crypto'),
    fs          = require('fs'),
    package     = require('./package.json'),
    path        = require('path'),
    program     = require('commander'),
    readTorrent = require('read-torrent'),
    util        = require('util'),
    ProgressBar = require('progress');

function sha1(chunk) {
  var shasum = crypto.createHash('sha1');
  shasum.update(chunk);
  return shasum.digest('hex');
}

program
  .version(package.version)
  .usage('[options] <torrent>')
  .option('-p, --path [path]', 'Path to look for files', '.')
  .option('-f, --file [filename]', 'Verify single file')
  .parse(process.argv);

if (!program.args.length) {
  console.error('Usage: torrentcheck %s', program.usage());
  process.exit(-1);
}

readTorrent(program.args[0], function (err, torrent) {
  if (err) throw err;

  var passed = 0;

  var files = torrent.files.filter(function(file) {
    return program.file ? file.path == program.file : true;
  });

  files.forEach(function(file) {
    var pieceIndex = file.offsetPiece,
        filePieces = file.endPiece - file.offsetPiece,
        filePath   = path.join(program.path, file.path);

    if (fs.statSync(filePath).size != file.length) {
      console.error(util.format('File %s failed verification (file size does not match)', file.path));
      process.exit(1);
    }
        
    var stream     = fs.createReadStream(filePath),
        bar        = new ProgressBar(util.format('%s [:bar] :percent :etas', file.path), { 
          total: filePieces,
          width: process.stdout.columns - file.path.length - 15
        });
    
    stream.on('readable', function() {
      var pieceLength = (pieceIndex == (torrent.pieces.length - 1)) ? torrent.pieceRemainder : torrent.pieceLength;
      while (pieceIndex <= file.endPiece && null !== (chunk = stream.read(pieceLength))) {
        if (sha1(chunk) !== torrent.pieces[pieceIndex]) {
          console.error(util.format('File %s failed verification (sha1 for piece %d does not match)', file.path, pieceIndex));
          process.exit(2);
        }

        bar.tick();
        pieceIndex++;
      }
      if (pieceIndex > file.endPiece) {
        passed++;
        if (passed == files.length) {
          console.log('%d File%s passed verification', files.length, files.length == 1 ? '' : 's');
        }
      }
    });
  });
  
});

