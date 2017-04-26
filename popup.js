var current_url = "";

function bId(id) {
	return document.getElementById(id);
}

function hide(id) {
	bId(id).style.display = 'none';
}

function show(id) {
	bId(id).style.display = '';
}


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
			/videos\/[a-z]+\.[0-9]+\/([0-9]+)\//,
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
	console.log("appendLink: " + href);
	fbid = extractFbId(href);
	if (! fbid) {
		console.error("Cannot extract fbid from " + href);
		return;
	}

	var tr = document.createElement("tr");
	fbid = extractFbId(href);
	cb = document.createElement("input");

	cb.setAttribute("name", "cb_" + fbid.id);
	cb.setAttribute("url", href);
	cb.setAttribute("url_type", fbid.type);
	cb.setAttribute("type", "checkbox");
	cb.checked = true;

	var td1 = document.createElement("td");
	td1.appendChild(cb);
	tr.appendChild(td1);

	a = document.createElement("a");
	a.href = href;
	a.appendChild(document.createTextNode(fbid.id));
	var td2 = document.createElement("td");
	td2.appendChild(a);
	tr.appendChild(td2);

	parent.appendChild(tr);
}



function appendLinks(parent_id, links) {
	var parent = bId(parent_id);
	console.log("appendLinks");
	console.dir(parent_id);
	console.dir(links);

	while (parent.hasChildNodes()) {
		parent.removeChild(parent.lastChild);
	}

	for (i = 0; i < links.length; i++) {
		appendLink(parent, links[i]);
	}
}

function extractLinks(tabs) {
	console.log("Calling extractLinks");
	console.dir(tabs);
	hide("notgroup");
	show("ingroup");
	show("goto_photos");
	show("goto_videos");
	// hide("extract");
	show("results");

	chrome.tabs.sendMessage(
		tabs[0].id,
		{m: 'extract_links'},
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
			if (videos.length > 0) {
				appendLinks("tableresults", videos);
			} else {
				photos = links.filter(function(s) { return s.indexOf("photo") !== -1; });
				appendLinks("tableresults", photos);
			}

			console.dir(response);
		}
	);

}


function updateButtons(tabs, group_id) {

	chrome.tabs.onUpdated.addListener(
		function(tabId, changeInfo, tab) {
			console.log("chrome.tabs.onUpdated - " + tabId + " - " + tab.status);
			if (tab.status == "complete") {
				extractLinks([tab]);
			}
		}
	);

	var base_url = "https://www.facebook.com/groups/" + group_id + "/";
	document.querySelector('#goto_photos').addEventListener(
		'click',
		function() {
			chrome.tabs.update(
				tabs[0].id,
				{ url: base_url + "photos/" }
			);
		}
	);
	document.querySelector('#goto_videos').addEventListener(
		'click',
		function() {
			chrome.tabs.update(
				tabs[0].id,
				{ url: base_url + "videos/" }
			);
		}
	);
}


document.addEventListener(
	'DOMContentLoaded',
	function() {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			console.log("Calling chrome.tabs.sendMessage");
    	chrome.tabs.sendMessage(
				tabs[0].id,
				{m: 'current_url'},
				function(response){
					// now we should show/hide proper buttons
					console.dir(response);
					var url = response.url
					var group_regex = /facebook\.com\/groups\/([0-9]+)\//

					regex_match = url.match(group_regex);
					if (regex_match) {
						// we are in group now
						console.dir(regex_match);
						show("ingroup");
						hide("notgroup");
						var group_id = regex_match[1];

						updateButtons(tabs, group_id);


						var is_photo = url.match(/\/groups\/([0-9]+)\/photos/);
						var is_video = url.match(/\/groups\/([0-9]+)\/videos/);
						if (is_photo || is_video) {
							//hide("goto_photos");
							//hide("goto_videos");
							extractLinks(tabs);
						} else {
							// hide("extract");
							hide("results");

						}
					} else {
						show("notgroup");
						hide("ingroup");
					}
				}
			);
		});
	}
);
