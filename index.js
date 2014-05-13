var vm = require('vm');
var through = require('through');
var resumer = require('resumer');
var duplexer = require('duplexer');

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

module.exports = JS;
inherits(JS, EventEmitter);

function JS(opts) {
    if (!(this instanceof JS)) return new JS(opts);
    if (!opts) opts = {};
    this.custom = opts.custom || [];

    this._cursorX = 0;
    this.history = [];
    this.historyIndex = 0;
    this._historyLast = null;

    this.context = {};
}

JS.prototype.createStream = function () {
    var self = this;

    var line = '';
    var mode = null;

    var input = through(function write (buf) {
        if (typeof buf !== 'string') buf = buf.toString('utf8');

        for (var i = 0; i < buf.length; i++) {
            var c = buf.charCodeAt(i);
            if (c >= 65 && c <= 68) {
                var dir = {
                    A: 'up', B: 'down', C: 'right', D: 'left'
                }[String.fromCharCode(c)];

                if (dir === 'left' && self._cursorX) {
                    self._cursorX --;
                    output.queue('\x1b\x5bD');
                }
                else if (dir === 'right' && self._cursorX < line.length) {
                    self._cursorX ++;
                    output.queue('\x1b\x5bC');
                }
                else if (dir === 'up') {
                    if (self._cursorX !== line.length) {
                        output.queue(
                            '\x1b[' + (line.length - self._cursorX) + 'C'
                        );
                        self._cursorX = line.length;
                    }
                    else if (self.historyIndex > 0) {
                        if (self.historyIndex === self.history.length
                        && self._historyLast === null) {
                            self._historyLast = line;
                        }
                        line = self.history[-- self.historyIndex];
                        if (self._cursorX) {
                            output.queue(
                                '\x1b[' + self._cursorX + 'D\x1b[K'
                                + line
                            );
                        }
                        else output.queue(line);
                        self._cursorX = line.length;
                    }
                }
                else if (dir === 'down'
                && self.historyIndex <= self.history.length - 1) {
                    if (self.historyIndex === self.history.length - 1) {
                        line = self._historyLast || '';
                        self.historyIndex ++;
                    }
                    else line = self.history[++ self.historyIndex];
                    if (self._cursorX) {
                        output.queue(
                            '\x1b[' + self._cursorX + 'D\x1b[K'
                            + line
                        );
                    }
                    else output.queue(line)

                    self._cursorX = line.length;
                }

                continue;
            }


            if (c === 3) { // ^C
            }
            else if (c === 4) {
            }
            else if (c === 8 || c === 0x7f) {
                if (self._cursorX) {
                    self._cursorX --;
                    var before = line.slice(0, self._cursorX)
                    var after = line.slice(self._cursorX + 1)
                    line = before + after;

                    if (after.length) {
                        output.queue(
                            '\010\x1b[K' + after
                            + '\x1b[' + after.length + 'D'
                        );
                    }
                    else output.queue('\010 \010');
                }
                return write(buf.slice(i + 1));
            }
            else if (c === 10 || c === 13) {
                input.queue(line);
                if (line.length) {
                    self.history.push(line);
                    self.historyIndex = self.history.length;
                    self._historyLast = null;
                }
                self._cursorX = 0;
                line = '';
                return write(buf.slice(i + 1));
            }
            else if (c === 0x1b) {
            }
            else {
                var before = line.slice(0, self._cursorX);
                var after = line.slice(self._cursorX);
                var middle = String.fromCharCode(c);

                if (!/\s/.test(middle) && c < 26) {
                    output.queue('^' + String.fromCharCode(64 + c));
                }
                line = before + middle + after;

                if (after.length && middle === ' ') {
                    output.queue(
                        '\x1b[K' + after
                        + '\x1b[' + (after.length + 1) + 'D '
                    );
                }
                else if (after.length) {
                    output.queue(
                        '\x1b[K' + after
                        + '\x1b[' + after.length + 'D'
                    );
                }
                self._cursorX ++;
            }
        }
    }, inputEnd);

    function inputEnd () {
        if (line.length) this.queue(line);
        input.queue(null);
    }

    var closed = false;

    var output = resumer();
    self.on('bgdata', function (buf) {
        output.queue(buf);
    });
    output.queue(self.getPrompt());

    self.once('exit', end);

    var queue = [];
    input.pipe(through(write, end));
    return duplexer(input, output);

    function write (buf) {
        var line = typeof buf === 'string' ? buf : buf.toString('utf8');
        if (line === '') {
            if (!closed) {
                output.queue(self.getPrompt());
            }
            return;
        }

        output.queue(self.eval(line));
        output.queue(self.getPrompt());
    }

    function end () {
        closed = true;
        output.queue(null);
        self.emit('exit', 0);
    }
};

JS.prototype.emit = function (name) {
    var self = this;
    var args = [].slice.call(arguments, 1);
    var res;
    this.listeners(name).forEach(function (fn) {
        res = res || fn.apply(self, args);
    });
    return res;
};

JS.prototype.eval = function (line) {
    try {
        var output = vm.runInNewContext(line, this.context);
        if (output)
            return output.toString().trim() + '\n';
        return ''
    } catch (e) {
        return e.toString() + '\n';
    }
}

JS.prototype.getPrompt = function () {
    return '> ';
};
