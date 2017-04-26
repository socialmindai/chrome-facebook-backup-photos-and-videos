// debugger;

function getLinks() {
	all_as = document.getElementsByTagName("a");
	hrefs = []
	for (i = 0; i < all_as.length; i++) {
	    el = all_as[i];
	    if (el.hasAttribute("rel") && el.getAttribute("rel") === "theater") {
			href = el.getAttribute("href");
			if (href.indexOf("facebook.com") === -1) {
				href = "https://www.facebook.com" + href;
			}
			hrefs.push(href);
	    }
	}

	return hrefs;
}
	

chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
	console.log(message);
	console.log("Calling sendResponse");
	message.r = "content.js - sendResponse";
	links = getLinks();
	message.links = links;
	sendResponse(message);

	chrome.runtime.sendMessage(
		{s: 'content.js - chrome.runtime.sendMessage - local'}, 
		function handler(response) { }
	);

});

console.log("content.js - was loaded");

