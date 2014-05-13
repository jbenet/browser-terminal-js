var http = require('http');
var ecstatic = require('ecstatic')(__dirname + '/static');

var server = http.createServer(function (req, res) {
    ecstatic(req, res);
});

var port = parseInt(process.argv[2]) || 5000;
server.listen(port);
console.log('listening on localhost:' + port)
