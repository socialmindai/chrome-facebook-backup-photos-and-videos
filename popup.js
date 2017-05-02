var already_downloaded = 0;
var to_backup = 0;
var downloaded_now = 0;

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

function extractFbId(href) {
	regexs = {
		'photo': [
			/photo\.php\?fbid=([0-9]+)/,
			/\/.*\/photos\/[^/]+\/([0-9]+)/,
			/\/.*\/photos\/([0-9]+)\/$/,
		],
		'video': [
			/videos\/[a-z]+\.[0-9]+\/([0-9]+)\//,
			/videos\/([0-9]+)\//,
		]
	}

	for (var key in regexs) {
		for (var i in regexs[key]) {
			var regex = regexs[key][i];
			regex_match = href.match(regex);
			if (regex_match) {
				return {
					id: regex_match[1],
					type: key,
				 	href: href
				}
			}
		}
	}

	return undefined;
}

function appendLink(parent, fbid) {

	var tr = document.createElement("tr");
	cb = document.createElement("input");
	cb.setAttribute("id", "cb_" + fbid.id);
	cb.setAttribute("name", "cb_" + fbid.id);
	cb.setAttribute("url", fbid.href);
	cb.setAttribute("url_type", fbid.type);
	cb.setAttribute("fbid", fbid.id);
	cb.setAttribute("type", "checkbox");
	cb.checked = true;
	cb.addEventListener(
		'change',
		function(e) {
			if (e.target.checked) {
				to_backup++;
			} else {
				to_backup--;
			}
			updateBackUpCount(to_backup);
			hide("confirmbackups");
		}
	);

	var td1 = document.createElement("td");
	td1.appendChild(cb);
	tr.appendChild(td1);

	a = document.createElement("a");
	a.href = fbid.href;
	a.appendChild(document.createTextNode(fbid.id));
	var td2 = document.createElement("td");
	td2.appendChild(a);
	tr.appendChild(td2);

	parent.appendChild(tr);
}

function appendLinks(parent_id, content_type, links) {
	var parent = bId(parent_id);

	// remove all previous rows
	while (parent.hasChildNodes()) {
		parent.removeChild(parent.lastChild);
	}

	// extract fbids of requested type
	var fbids = {};
	for (var i = 0; i < links.length; i++) {
		var fbid = extractFbId(links[i]);
		if (! fbid) {
			console.error("Cannot extract fbid from " + href);
			continue;
		}
		if (fbid.type !== content_type) {
			// we don't want links for photos when we want videos
			continue;
		}
		fbids[fbid.id] = fbid;
	}

	// construct table
	var fbid_ids = [];
	for (var key in fbids) {
		appendLink(parent, fbids[key]);
		fbid_ids.push(fbids[key].id);
	}

	// uncheck already downloaded ones
	chrome.storage.local.get(fbid_ids, function(items){
		already_downloaded = 0;
		for (var i = 0; i < fbid_ids.length; i++) {
			var fbid = fbid_ids[i];
			if (items.hasOwnProperty(fbid)) {
				// console.log("Already downloaded: " + fbid);
				var cb = bId("cb_" + fbid);
				cb.checked = false;
				cb.title = chrome.i18n.getMessage("titleAlreadyDownloaded");
				already_downloaded++;
			}
		}
		updateBackedUpCount(already_downloaded);
		to_backup = fbid_ids.length - already_downloaded;
		updateBackUpCount(to_backup);
	});

	updateTotalCount(fbid_ids.length);
}

function updateTotalCount(count) {
	bId("totalcount1").innerHTML = count;
	bId("totalcount2").innerHTML = count;
}

function updateBackedUpCount(count) {
	bId("backedupcount").innerHTML = count;
}

function updateBackUpCount(count) {
	bId("backupcount").innerHTML = count;
}


function extractLinks(tabs) {
	hide("notsupported");
	show("supported");
//	show("goto_photos");
//	show("goto_videos");
	// hide("extract");
	// XXX show("results");
	show("resultswrapper");
	show("results_controls");

	chrome.tabs.sendMessage(
		tabs[0].id,
		{m: 'extract_links'},
		function(response){

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
				appendLinks("tableresults", "video", videos);
			} else {
				photos = links.filter(function(s) { return s.indexOf("photo") !== -1; });
				appendLinks("tableresults", "photo", photos);
			}
		}
	);

}

function constructFileNamePrefix(fbid, ts) {
	var d = new Date(ts * 1000);
	var iso = d.toISOString().replace(/[:.]/g, "-").replace("-000Z", "");
	return iso + "_" + fbid;
}

function markAsDownloaded(fbid) {
	var toStore = {};
	toStore["" + fbid] = 1;
	chrome.storage.local.set(toStore, function(){
		// console.log("Marked as downloaded - callback: " + fbid);
		var inp = bId("cb_" + fbid).checked = false;
		to_backup--;
		updateBackUpCount(to_backup);
		// TODO: we should update somewhere number of alredy downloaded

		if (to_backup === 0) {
			bId("confirmbackups").innerHTML = chrome.i18n.getMessage("txtConfirmBackups", [to_download]);
			// window.alert("Downloaded count: " + to_download);
			show("confirmbackups");
		}
	});
}

function extractTimeStamp(txt) {
	// data-utime="1493189486"
	m = txt.match(/data-utime="([0-9]+)"/);
	return m ? m[1] : 0
}

function downloadVideos(fbid, txt) {
	var ts = extractTimeStamp(txt);
	var prefix = constructFileNamePrefix(fbid, ts);

	var hd_src = txt.match(/hd_src:"([^"]+)"/);
	if (hd_src) {
		chrome.downloads.download({
			url: hd_src[1],
			filename: prefix + "_hd.mp4",
			conflictAction: "prompt"
		});
		markAsDownloaded(fbid);
		console.log("hd_src: " + hd_src[1]);
	} else {
		var sd_src = txt.match(/sd_src:"([^"]+)"/);
		if (sd_src) {
			chrome.downloads.download({
				url: sd_src[1],
				filename: prefix + "_sd.mp4",
				conflictAction: "prompt"
			});
			markAsDownloaded(fbid);
			console.log("sd_src: " + sd_src[1]);
		}
	}
}

function downloadPhoto(fbid, txt) {
	var ts = extractTimeStamp(txt);
	var prefix = constructFileNamePrefix(fbid, ts);
 	var src = txt.match(/data-ploi="([^"]+)"/);
	if (src) {
		/*
		console.log(src[1]);
		console.log(decodeURIComponent(src[1]));
		console.log(decodeURI(src[1]));
		*/
		img_src = src[1].replace(/amp;/g, "");
		chrome.downloads.download({
			url: img_src,
			filename: prefix + ".jpg",
			conflictAction: "prompt"
		});
		markAsDownloaded(fbid);
		console.log("img_src: " + img_src);
	}

}

function downloadHelper(fbid, url, url_type) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", url, true);
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
			var res = {};
			if (url_type === "video") {
				res = downloadVideos(fbid, xhr.responseText);
			} else if (url_type === "photo") {
				res = downloadPhoto(fbid, xhr.responseText);
			} else {
				console.error("Unsupported url_type: " + url_type);
			}
		}
	}
	xhr.send();
}

function getCheckboxesForDownload() {
	var checkboxes = [];
	inputs = document.getElementsByTagName("input");
	for (i = 0; i < inputs.length; i++) {
		inp = inputs[i];
		if (
			inp.hasAttribute("type") &&
			inp.getAttribute("type") === "checkbox" &&
			inp.hasAttribute("url_type") &&
			inp.hasAttribute("url")
		) {
			checkboxes.push(inp);
		}
	}
	return checkboxes;
}

function downloadAll() {
	inputs = getCheckboxesForDownload();
	checked_inputs = inputs.filter(
		function (inp) { return inp.checked}
	);

	to_download = checked_inputs.length;
	for (i = 0; i < checked_inputs.length; i++) {
		inp = checked_inputs[i];
		if (inp.checked) {
			var url = inp.getAttribute("url");
			var url_type = inp.getAttribute("url_type");
			var fbid = inp.getAttribute("fbid");
			downloadHelper(fbid, url, url_type);
		}
	}
}


function updateButtons(tabs, base_url, config) {

	chrome.tabs.onUpdated.addListener(
		function(tabId, changeInfo, tab) {
			console.log("chrome.tabs.onUpdated - " + tabId + " - " + tab.status);
			if (tab.status == "complete") {
				show("scroll_down");
				extractLinks([tab]);
			}
		}
	);


	function onClick(id, url) {
		document.querySelector('#' + id).addEventListener(
			'click',
			function() {
				hide("confirmbackups");
				// console.log(url);
				chrome.tabs.update(
					tabs[0].id,
					{ url: "https://" + url }
				);
			}
		);
	}

	types = ["photos", "videos"];
	for (var i in types) {
		var t = types[i];

		var url = config.construct_url(base_url, t);
		var id = "goto_" + t;
		if (url) {
			show(id);
			onClick(id, url);
		} else {
			hide(id);
		}
	}

	document.querySelector('#backup').addEventListener(
		'click',
		downloadAll
	);

	document.querySelector('#checkall').addEventListener(
		'click',
		function() {
			hide("confirmbackups");
			inputs = getCheckboxesForDownload();
			for (i = 0; i < inputs.length; i++) {
				inputs[i].checked = true;
			}
			to_backup = inputs.length;
			updateBackUpCount(to_backup);
		}
	);

	document.querySelector('#scroll_down').addEventListener(
		'click',
		function() {
			hide("confirmbackups");
			var prev = 0;
			var height = 0;
			var interval = setInterval(scrollDown, 2000);
			var MAX_ITERATIONS = 5;
			var current_iteration = 0;
			function scrollDown() {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{m: 'scroll_down'},
					function(response){
						current_iteration++;
						height = response.height;
						extractLinks(tabs);
						if (prev == height) {
							hide("scroll_down");
							clearInterval(interval);
						} else if (current_iteration >= MAX_ITERATIONS) {
							clearInterval(interval);
						} else {
							prev = height;
						}
					}
				);
		};
	}
	);
}

// TODO: there should be better way how to recognize, where we are
var regexp_configs = {
	// URLs that should be ignored
	ignore: {
		regex_base: /(facebook\.com\/(bookmarks|campaign|settings|pages))/,
	},
	// groups have always groups in their URL
	group: {
		regex_base: /(facebook\.com\/groups\/([^/&?]+)\/)/,
		regex_photos: /(facebook\.com\/groups\/([^/&?]+)\/)photos/,
		regex_videos: /(facebook\.com\/groups\/([^/&?]+)\/)videos/,
		construct_url: function(base, t) {
			return base + t;
		}
	},
	// pages could have pg as part of their URL
	page: {
		regex_base: /(facebook\.com\/pg\/([^/&?]+)\/)/,
		regex_photos: /(facebook\.com\/pg\/([^/&?]+)\/)photos/,
		regex_videos: /(facebook\.com\/pg\/([^/&?]+)\/)videos/,
		construct_url: function(base, t) {
			return base + t;
		}
	},
	// events don't have videos URL
	event: {
		regex_base: /(facebook\.com\/events\/([^/&?]+)\/)/,
		regex_photos: /(facebook\.com\/events\/([^/&?]+)\/)photos/,
		regex_videos: /(facebook\.com\/events\/([^/&?]+)\/)videos/,
		construct_url: function(base, t) {
			if (t === 'videos') {
				return undefined;
			}
			return base + t;
		}
	},
	// people without username has profile id
	profile: {
		regex_base: /(facebook\.com\/profile\.php\?id=([^/&]+))/,
		regex_photos: /(facebook\.com\/profile\.php\?id=([^/&]+)).*sk=photos/,
		regex_videos: /(facebook\.com\/profile\.php\?id=([^/&]+)).*sk=videos/,
		construct_url: function(base, t) {
			return base + "&sk=" + t;
		}
	},
	// lets assume that the rest is either
	// pages have / at the end, whereas profiles don't :)
	// facebook.com/zuck/ => zuck
	// facebook.com/Funny.Cats.Videos.Daily => Funny.Cats.Videos.Daily/
	rest: {
		regex_base: /(facebook\.com\/([^/&?]+))/,
		regex_photos: /(facebook\.com\/([^/&?]+))\/photos/,
		regex_videos: /(facebook\.com\/([^/&?]+))\/videos/,
		construct_url: function(base, t) {
			return base + "/" + t;
		}
	},
}

/*
document.addEventListener(
	'DOMContentLoaded',
*/
window.onload = function() {
		loadI18nMessages();

		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		// console.log("Calling chrome.tabs.sendMessage");

		hide("notsupported");
		hide("supported");
		hide("confirmbackups");
		hide("resultswrapper");

		chrome.tabs.sendMessage(
			tabs[0].id,
			{m: 'current_url'},
			function(response){
				if (response === undefined) {
					// Extension is not running on supported URL
					return;
				}

				var url = response.url
				if (url.match(/facebook\.com\//) === undefined) {
					console.log(url);
					return;
				}
				hide("notsupporteddomain");
				show("notsupported");
				hide("supported");

				for (var config_key in regexp_configs) {
					var config = regexp_configs[config_key];

					var regex_match = url.match(config['regex_base']);
					if (regex_match) {
						if (config_key === 'ignore') {
							// this is not supported URL
							// we have set up correct element visibility at the beginning
							return;
						}
						show("supported");
						hide("notsupported");

						base_url = regex_match[1];
						updateButtons(tabs, base_url, config);

						var is_photo = url.match(config['regex_photos']);
						var is_video = url.match(config['regex_videos']);
						if (is_photo || is_video) {
							//hide("goto_photos");
							//hide("goto_videos");
							extractLinks(tabs);
						} else {
							// hide("extract");
							// XXX hide("results");
							hide("results_controls");
							hide("confirmbackups");
							hide("resultswrapper");
						}
						return;
					}

				}
			});
		});
	}
//);


function loadI18nMessages() {
  function setProperty(selector, prop, msg) {
    document.querySelector(selector)[prop] = chrome.i18n.getMessage(msg);
  }
	/* https://goo.gl/Jk3ayA
  setProperty('title', 'innerText', 'tabTitle');
  setProperty('#q', 'placeholder', 'searchPlaceholder');
  setProperty('#clear-all', 'title', 'clearAllTitle');
  setProperty('#open-folder', 'title', 'openDownloadsFolderTitle');
	*/
	setProperty('#goto_videos', 'innerText', 'btnBackupVideos');
	setProperty('#goto_photos', 'innerText', 'btnBackupPhotos');
	setProperty('#checkall', 'innerText', 'btnCheckAll');
	setProperty('#scroll_down', 'innerText', 'btnMore');
	setProperty('#backup', 'innerText', 'btnBackup');
	setProperty('#alreadybackedup', 'innerText', 'txtAlreadyBackedup');
	setProperty('#willbebackedup', 'innerText', 'txtWillBeBackedup');

	setProperty('#notsupporteddomain', 'innerHTML', 'txtNotSupportedDomain');
	setProperty('#notsupported', 'innerHTML', 'txtNotSupported');

}
