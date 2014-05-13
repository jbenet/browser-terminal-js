all: bundle.js

bundle.js: main.js ../index.js
	../node_modules/.bin/browserify main.js -o static/bundle.js
