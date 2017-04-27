pack:
	version=`cat manifest.json | grep '"version"' | sed -r 's/.*: "(.*)",/\1/'`; \
	echo $$version; \
	zip extension-$$version.zip \
		background.js  content.js  \
		icon128.png  icon16.png  icon32.png  icon48.png  \
		manifest.json  popup.html  popup.js \
		README.md LICENSE



