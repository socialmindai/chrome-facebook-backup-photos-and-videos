var already_downloaded = 0;
var total_count = 0;
var to_backup = 0;
var downloaded_now = 0;


// TODO: there should be better way how to recognize, where we are
var regexp_configs = {
	// URLs that should be ignored
	ignore: {
		regex_base: /(facebook\.com\/(bookmarks|campaign|settings|pages|permalink\.php))/,
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

photo_video_regex = {
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

// we need this for group albums
album_regex = /\/(media\/set\/|media_set\?set=)/

var _AnalyticsCode = 'UA-97010726-4';

var _gaq = _gaq || [];
_gaq.push(['_setAccount', _AnalyticsCode]);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
})();

/**
 * Track a click on a button using the asynchronous tracking API.
 *
 * See http://code.google.com/apis/analytics/docs/tracking/asyncTracking.html
 * for information on how to use the asynchronous tracking API.
 */
function trackButtonClick(e) {
  _gaq.push(['_trackEvent', e.target.id, 'clicked']);
}


function bId(id) {
	return document.getElementById(id);
}

function hide(id) {
	bId(id).style.display = 'none';
}

function show(id) {
	bId(id).style.display = '';
}

function showOrHide(id, should_show) {
	if (should_show) {
		show(id);
	} else {
		hide(id);
	}
}

function btnActivate(id, activate) {
	var btn = bId(id);
	if (activate) {
		btn.classList.add('active');
	} else {
		btn.classList.remove('active');
	}
}

function btnDisable(id, disable) {
	var btn = bId(id);
	if (disable) {
		btn.classList.add('disabled');
	} else {
		btn.classList.remove('disabled');
	}
}

function cC(id_) {
	var c = document.createElement("input");
}

function extractFbId(href) {
	for (var key in photo_video_regex) {
		for (var i in photo_video_regex[key]) {
			var regex = photo_video_regex[key][i];
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
			updateBackUpCount();
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
		updateBackedUpCount();
		to_backup = fbid_ids.length - already_downloaded;
		updateBackUpCount();
	});
	total_count = fbid_ids.length;
	updateTotalCount();
}

function updateTotalCount() {
	bId("totalcount1").innerHTML = total_count;
	bId("totalcount2").innerHTML = total_count;
}

function updateBackedUpCount() {
	bId("backedupcount").innerHTML = already_downloaded;
}

function updateBackUpCount() {
	bId("backupcount").innerHTML = to_backup;
	btnDisable("btn_backup", to_backup === 0);
	btnDisable("btn_check_all", to_backup === total_count);
}

function showResultsView() {
	hide("notsupported");
	show("supported");
	show("resultswrapper");
	show("results_controls");
}

function extractLinks(tabs) {
	showResultsView();

	var control_buttons = document.getElementsByClassName("controlbutton");
	for(var i = 0; i < control_buttons.length; i++) {
		btnDisable(control_buttons[i].id, false);
	}

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
		updateBackUpCount();
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
		_gaq.push(['_trackEvent', 'download', 'video_hd']);
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
			_gaq.push(['_trackEvent', 'download', 'video_sd']);
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
		_gaq.push(['_trackEvent', 'download', 'photo']);
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


function updateGeneralButtons(tabs) {
	chrome.tabs.onUpdated.addListener(
		function(tabId, changeInfo, tab) {
			console.log("chrome.tabs.onUpdated - " + tabId + " - " + tab.status);
			if (tab.status == "complete") {
				extractLinks([tab]);
			}
		}
	);

	document.querySelector('#btn_backup').addEventListener(
		'click',
		downloadAll
	);

	document.querySelector('#btn_check_all').addEventListener(
		'click',
		function() {
			hide("confirmbackups");
			inputs = getCheckboxesForDownload();
			for (i = 0; i < inputs.length; i++) {
				inputs[i].checked = true;
			}
			to_backup = inputs.length;
			updateBackUpCount();
		}
	);

	document.querySelector('#btn_scroll_down').addEventListener(
		'click',
		function() {
			hide("confirmbackups");
			var prev = 0;
			var height = 0;
			var interval = setInterval(scrollDown, 5000);
			hide("btn_scroll_down_label");
			show("btn_scroll_down_spinner");
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
							btnDisable("btn_scroll_down", true);
							show("btn_scroll_down_label");
							hide("btn_scroll_down_spinner");
							clearInterval(interval);
						} else if (current_iteration >= MAX_ITERATIONS) {
							show("btn_scroll_down_label");
							hide("btn_scroll_down_spinner");
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

function updateMediaButtons(tabs, base_url, config) {

	function onClick(id, url) {
		document.querySelector('#' + id).addEventListener(
			'click',
			function() {
				var media_buttons = document.getElementsByClassName("mediabutton");
				for(var i = 0; i < media_buttons.length; i++) {
					btnActivate(media_buttons[i].id, false);
				}
				btnActivate(id, true);
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
		var id = "btn_goto_" + t;
		if (url) {
			show(id);
			onClick(id, url);
		} else {
			hide(id);
		}
	}
}

function showAsSupported(is_supported) {
	showOrHide("supported", is_supported);
	showOrHide("notsupported", ! is_supported);
}

function showMediaButtons(show_buttons) {
	showOrHide("btn_goto_photos", show_buttons);
	showOrHide("btn_goto_videos", show_buttons);
	bId("resultswrapper").style['padding-top'] = show_buttons ? 110 : 80;
	btnDisable("btn_scroll_down", show_buttons);
}

/*
document.addEventListener(
	'DOMContentLoaded',
*/
window.onload = function() {
	loadI18nMessages();

	_gaq.push(['_trackEvent', 'load', chrome.app.getDetails().version]);
	var buttons = document.querySelectorAll('button');
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].addEventListener('click', trackButtonClick);
	}

	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		// console.log("Calling chrome.tabs.sendMessage");

		hide("notsupported");
		hide("supported");
		hide("confirmbackups");
		hide("resultswrapper");
		hide("btn_scroll_down_spinner");

		updateGeneralButtons(tabs);

		chrome.tabs.sendMessage(
			tabs[0].id,
			{m: 'current_url'},
			function(response){
				if (response === undefined) {
					// Extension is not running on supported URL
					_gaq.push(['_trackEvent', 'view', 'view_noresponse']);
					return;
				}

				var url = response.url
				if (url.match(/facebook\.com\//) === undefined) {
					console.log(url);
					_gaq.push(['_trackEvent', 'view', 'view_notsupporteddomain']);
					return;
				}
				hide("notsupporteddomain");
				showAsSupported(false);

				fbid = extractFbId(url);
				if (fbid !== undefined) {
					_gaq.push(['_trackEvent', 'view', 'view_singleitem']);
					showAsSupported(true);
					showMediaButtons(false);
					showResultsView();
					appendLinks("tableresults", fbid.type, [url]);
					return;
				}

				var regex_match = url.match(album_regex);
				if (regex_match) {
					_gaq.push(['_trackEvent', 'view', 'view_album']);
					showAsSupported(true);
					showMediaButtons(false);
					showResultsView();
					extractLinks(tabs);
					return;
				}

				for (var config_key in regexp_configs) {
					var config = regexp_configs[config_key];

					var regex_match = url.match(config['regex_base']);
					if (regex_match) {
						if (config_key === 'ignore') {
							// this is not supported URL
							// we have set up correct element visibility at the beginning
							_gaq.push(['_trackEvent', 'view', 'view_notsupportedurl']);
							return;
						}
						showMediaButtons(true);
						showAsSupported(true);

						base_url = regex_match[1];
						updateMediaButtons(tabs, base_url, config);

						var is_photo = url.match(config['regex_photos']);
						var is_video = url.match(config['regex_videos']);
						if (is_photo || is_video) {
							_gaq.push(['_trackEvent', 'view', 'view_' + (is_photo ? 'photos' : 'videos')]);
							btnActivate("btn_goto_videos", is_video);
							btnActivate("btn_goto_photos", is_photo);
							extractLinks(tabs);
						} else {
							_gaq.push(['_trackEvent', 'view', 'view_mainpage']);
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
	setProperty('#btn_goto_videos', 'innerText', 'btnBackupVideos');
	setProperty('#btn_goto_photos', 'innerText', 'btnBackupPhotos');
	setProperty('#btn_check_all_label', 'innerText', 'btnCheckAll');
	setProperty('#btn_scroll_down_label', 'innerText', 'btnMore');
	setProperty('#btn_backup_label', 'innerText', 'btnBackup');
	setProperty('#alreadybackedup', 'innerText', 'txtAlreadyBackedup');
	setProperty('#willbebackedup', 'innerText', 'txtWillBeBackedup');

	setProperty('#notsupporteddomain', 'innerHTML', 'txtNotSupportedDomain');
	setProperty('#notsupported', 'innerHTML', 'txtNotSupported');

}
