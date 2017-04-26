function cC(id_) {
	var c = document.createElement("input");
}

/*
https://www.facebook.com/photo.php?fbid=1679596962056722&set=pcb.436765463336727&type=3
https://www.facebook.com/photo.php?fbid=1676383735711378&set=gm.435385996808007&type=3
Videos
https://www.facebook.com/martin.majlis/videos/pcb.446342962378977/10210634986085218/?type=3
https://www.facebook.com/martin.majlis/videos/pcb.446342962378977/10210634993165395/?type=3
https://www.facebook.com/martin.majlis/videos/10210656631826348/?ref=notif&notif_t=video_processed&notif_id=1493189647191248
*/

function extractFbId(href) {
	regexs = {
		'photo': [
			/photo\.php\?fbid=([0-9]+)/
		],
		'video': [
			/videos\/pcb.*\/([0-9]+)\//,
			/videos\/([0-9]+)\//,
		]
	}

	for (var key in regexs) {
		console.log(key);
		for (var i in regexs[key]) {
			var regex = regexs[key][i];
			console.log(regex);
			regex_match = href.match(regex);
			console.log(regex_match);
			if (regex_match) {
				return { id: regex_match[1], type: key }
			}
		}
	}

	return undefined;
}

function appendLink(parent, href) {
	fbid = extractFbId(href);
	if (! fbid) {
		console.error("Cannot extract fbid from " + href);
		return;
	}

	var li = document.createElement("li");
	fbid = extractFbId(href);
	cb = document.createElement("input");

	cb.setAttribute("name", "cb_" + fbid.id);
	cb.setAttribute("url", href);
	cb.setAttribute("url_type", fbid.type);
	cb.setAttribute("type", "checkbox");
	cb.checked = true;
	li.appendChild(cb);
	a = document.createElement("a");
	a.href = href;
	a.appendChild(document.createTextNode(fbid.id));
	li.appendChild(a);
	parent.appendChild(li);
}



function appendLinks(parent_id, links) {
	var parent = document.getElementById(parent_id);

	while (parent.hasChildNodes()) {
		parent.removeChild(parent.lastChild);
	}

	for (i = 0; i < links.length; i++) {
		appendLink(parent, links[i]);
	}
}


function testSendMessage() {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
/*
	console.log("Calling chrome.runtime.sendMessage");
    chrome.runtime.sendMessage(
		{s: 'popup.js - chrome.runtime.sendMessage'},
		function handler(response) {
	    	console.log("popup.js - chrome.runtime.sendMessage - callback");
			console.dir(response);
	    }
	);
*/
	console.log("Calling chrome.tabs.sendMessage");
    chrome.tabs.sendMessage(
		tabs[0].id,
		{s: 'popup.js - chrome.tabs.sendMessage'},
		function(response){
			console.log("popup.js - chrome.tabs.sendMessage - callback");

			if (! response) {
				console.error("Somethign went wrong - no response!");
				console.dir(response);
				return;
			}

			if (! response.hasOwnProperty("links")) {
				console.error("Somethign went wrong - no links!");
				console.dir(response);
				return;
			}


			links = response.links;
			videos = links.filter(function(s) { return s.indexOf("video") !== -1; });
			photos = links.filter(function(s) { return s.indexOf("photo") !== -1; });

			appendLinks("photos_links", photos);
			appendLinks("videos_links", videos);

			console.dir(response);
		}
	);
  });
}

document.addEventListener(
	'DOMContentLoaded',
	function() {
		document.querySelector('#extract').addEventListener(
			'click',
			testSendMessage
		);
	}
);
