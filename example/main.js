var terminal = require('browser-terminal');
var jsh = require('../');

var js = jsh();
var term = terminal().appendTo('#terminal')
term.pipe(js.createStream()).pipe(term);

var focused = false;

window.addEventListener('keydown', function(e) {
    var code = e.which || e.keyCode;
    if (focused) {
        if (code === 0x1b) { // escape
            disable();
        } else {
            term.keydown.apply(this, arguments);
        }
    }
});

var termDiv = document.getElementById('terminal');
termDiv.addEventListener('click', enable);

function disable() {
    focused = false;
    termDiv.className = '';
    console.log('disabled');
}
function enable() {
    focused = true;
    termDiv.className = 'enabled';
    console.log('enabled');
}
