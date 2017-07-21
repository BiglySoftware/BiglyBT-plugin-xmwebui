var vz = window.vz || {};

vz.mode = "trial";
vz.lastSelectionChanged = "";
vz.lastTorrenStates = "";

vz.updatePrefs = function( prefs ){
	var az_mode = prefs["az-mode"];
	if ( typeof az_mode == 'undefined' ){
		vz.mode = "trial";
	}else{
		vz.mode = az_mode;
	}
};

vz.searchQuery = null;

vz.validateSearch = function(str){
    if(!str || str == "" || str == "find...") {
        return false;
    }
    return true;
};

vz.executeSearch = function(search_input){
	if (typeof search_input === 'undefined') {
		search_input = $("#search_input").get(0).value;
	}
    if(! vz.validateSearch( search_input ) ) return;
    
    if (vz.hasExternalOSFunctions()) {
		try {
			if (externalOSFunctions.executeSearch(search_input)) {
				return true;
			}
		} catch(e) {
			console.log(e);
		}
    }
    
    var search_url;
    if (window.location.href.lastIndexOf("file:", 0) === 0) {
    	var root_url = $.url(RPC._Root);
    	var search_source = root_url.attr("source").substring(0, root_url.attr("source").length - root_url.attr("relative").length + 1);
        search_url = "http://search.vuze.com/xsearch/?q=" + encodeURIComponent(search_input) + "&xdmv=no&source=android&search_source=" + encodeURIComponent(search_source);
        $("#remotesearch_container").html("<iframe id='remotesearch'></iframe>");
        $("#remotesearch").attr({src: search_url});
    } else {
	    search_url = "http://search.vuze.com/xsearch/?q=" + search_input + "&xdmv=2.4.17.1&mode=plus&goo=//" + vz.mode + "&search_source=" + encodeURIComponent(window.location.href);
	    if( vz.searchQuery != search_url ) {
	        $("#remotesearch_container").text("");
	        vz.remote = null;
	        vz.createRemote( search_url );
	    }
    }
    vz.searchQuery = search_url;
    $("#torrent_container").hide();
    $("#remotesearch_container").show();
};

vz.backFromSearch = function(){
    $("#torrent_container").show();
    $("#remotesearch_container").hide();
};

vz.createRemote = function(remote_url){
    vz.remote = new easyXDM.Rpc(/** The channel configuration */{
        local: "../easyXDM/hash.html",
        swf: "easyxdm-2.4.18.4.swf",
        remote: remote_url,
        container: document.getElementById("remotesearch_container")
    }, /** The interface configuration */ {
        remote: {
            postMessage: {},
    		noOp: {}
        },
        local: {
            alertMessage: {
                method: function(msg){
                    alert(msg);
                },
                isVoid: true
            },
            download: {
                method: function(url){
                    /*make sure call isn't made several times*/
                    if( vz.dls[url] != null && (new Date().getTime() - vz.dls[url].ts < 2000) ) return
                    vz.ui.toggleRemoteSearch();
                    transmission.setFilterMode(Prefs._FilterIncomplete);
                    transmission.setSortMethod( 'age' );
                    transmission.setSortDirection( 'descending' );
                    transmission.remote.addTorrentByUrl( url, {} );
                    vz.dls[url] = {
                        url: url,
                        ts: new Date().getTime()
                        };
                },
                isVoid: true
            },
            noOp: {
                method: function(){
                //alert('done')
                },
                isVoid: true
            }
        }
    });
};

vz.ui = {};

vz.ui.toggleRemoteSearch = function(){
    if( $(".toolbar-main").is(":visible") ) {
        $(".toolbar-main").hide();
        $(".toolbar-vuze").show();
        //$("#toolbar").addClass("search")
        vz.executeSearch();
        $("#search_input").focus();
    } else {
        $(".toolbar-vuze").hide();
        $(".toolbar-main").show();
        //$("#toolbar").removeClass("search");
        vz.backFromSearch();
    }
};

vz.dls = {};
vz.utils = {};

vz.utils = {
    selectOnFocus: function(){
        $("#search_input").focus(function(){
            this.select();
        });
    }
};

vz.logout = function() {
	if (vz.hasExternalOSFunctions()) {
		externalOSFunctions.logout();
	} else {
		window.location.href = "/pairedServiceLogout?redirect_to=http://remote.vuze.com/logout.php";
	}
};

vz.showOpenTorrentDialog = function() {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.showOpenTorrentDialog();
			return true;
		} catch(e) {
			console.log(e);
		}
	}
	return false;
};

vz.handleConnectionError = function(errNo, msg, status) {
	if (vz.hasExternalOSFunctions()) {
		try {
			return externalOSFunctions.handleConnectionError(errNo, msg, status);
		} catch(e) {
			console.log(e);
		}
	}
	return false;
};

vz.showConfirmDeleteDialog = function(torrent) {
	if (vz.hasExternalOSFunctions()) {
		try {
			return externalOSFunctions.showConfirmDeleteDialog(torrent.getName(), torrent.getId());
		} catch(e) {
			console.log(e);
		}
	}
	return false;
};

vz.handleTapHold = function() {
	if (vz.hasExternalOSFunctions()) {
		try {
			return externalOSFunctions.handleTapHold();
		} catch(e) {
			console.log(e);
		}
	}
	return false;
};

vz.uiReady = function() {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.uiReady();
		} catch(e) {
			console.log(e);
		}
	}
};

vz.updateSpeed = function(downSpeed, upSpeed) {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.updateSpeed(downSpeed, upSpeed);
		} catch(e) {
			console.log(e);
		}
	}
};

vz.updateTorrentStates = function(haveActive, havePaused, haveActiveSel, havePausedSel) {
	if (vz.hasExternalOSFunctions()) {
		try {
			var t = String(haveActive) + String(havePaused)
					+ String(haveActiveSel) + String(havePausedSel);
			if (t !== vz.lastTorrenStates) {
				vz.lastTorrenStates = t;
				externalOSFunctions.updateTorrentStates(haveActive, havePaused,
						haveActiveSel, havePausedSel);
			}
		} catch(e) {
			console.log(e);
		}
	}
};


vz.updateTorrentCount= function(total) {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.updateTorrentCount(total);
		} catch(e) {
			console.log(e);
		}
	}
};

vz.selectionChanged = function(selectedTorrents, haveActiveSel, havePausedSel) {

	if (vz.hasExternalOSFunctions()) {
		try {
			var t = String(haveActiveSel) + String(havePausedSel)
					+ selectedTorrents.map(function(elem) {return elem.id;}).join(",");
			if (t !== vz.lastSelectionChanged) {
				vz.lastSelectionChanged = t;
				externalOSFunctions.selectionChanged(JSON.stringify(selectedTorrents),
						haveActiveSel, havePausedSel);
			}

		} catch (e) {
			console.log(e);
		}
	}
};

vz.updateSessionProperties = function(sessionProperties) {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.updateSessionProperties(JSON.stringify(sessionProperties));
		} catch(e) {
			console.log(e);
		}
	}
};

vz.torrentInfoShown = function(id, page) {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.torrentInfoShown(id, page);
		} catch(e) {
			console.log(e);
		}
	}
};

vz.slowAjax = function(id) {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.slowAjax(id);
		} catch(e) {
			console.log(e);
		}
	}
}

vz.slowAjaxDone = function(id, ms) {
	if (vz.hasExternalOSFunctions()) {
		try {
			externalOSFunctions.slowAjaxDone(id, ms);
		} catch(e) {
			console.log(e);
		}
	}
}

vz.goBack = function() {
	if ($('#ul_torrent_context_menu').is(':visible')) {
		externalOSFunctions.cancelGoBack(true);
		$('#ul_torrent_context_menu').hide();
		return false;
	}

	var visibleDialog = $('.ui-dialog-content:visible');
	if (visibleDialog.length) {
		externalOSFunctions.cancelGoBack(true);
		visibleDialog.dialog('close');
		return false;
	}
	
	visibleDialog = $(".dialog_container:visible");
	if (visibleDialog.length) {
		externalOSFunctions.cancelGoBack(true);
		visibleDialog.hide();
		return false;
	}
	
	externalOSFunctions.cancelGoBack(false);
	return true;
};

vz.hasExternalOSFunctions = function() {
	return  typeof externalOSFunctions !== 'undefined';
};

function isTouchDevice(){
	try{
		document.createEvent("TouchEvent");
		return true;
	}catch(e){
		return false;
	}
}

// From http://chris-barr.com/2010/05/scrolling_a_overflowauto_element_on_a_touch_screen_device/#comment-65
function touchScroll(selector) {
    if (isTouchDevice()) {
        var scrollStartPosY=0;
        var scrollStartPosX=0;
        $('body').delegate(selector, 'touchstart', function(e) {
            scrollStartPosY=this.scrollTop+e.originalEvent.touches[0].pageY;
            scrollStartPosX=this.scrollLeft+e.originalEvent.touches[0].pageX;
        });
        $('body').delegate(selector, 'touchmove', function(e) {
            if ((this.scrollTop < this.scrollHeight-this.offsetHeight &&
                this.scrollTop+e.originalEvent.touches[0].pageY < scrollStartPosY-5) ||
                (this.scrollTop != 0 && this.scrollTop+e.originalEvent.touches[0].pageY > scrollStartPosY+5))
                    e.preventDefault();
            if ((this.scrollLeft < this.scrollWidth-this.offsetWidth &&
                this.scrollLeft+e.originalEvent.touches[0].pageX < scrollStartPosX-5) ||
                (this.scrollLeft != 0 && this.scrollLeft+e.originalEvent.touches[0].pageX > scrollStartPosX+5))
                    e.preventDefault();
            this.scrollTop=scrollStartPosY-e.originalEvent.touches[0].pageY;
            this.scrollLeft=scrollStartPosX-e.originalEvent.touches[0].pageX;
        });
    }
}

function vuzeOnResize() {
    var h = ($(window).height() - 80);
	$('#remotesearch_container').height(h);
	if ($(window).width() > 900) {
    	$("#torrent_logo").show();
	} else {
    	$("#torrent_logo").hide();
	}
}

function getWebkitVersion() {
    var result = /AppleWebKit\/([\d.]+)/.exec(navigator.userAgent);
    if (result) {
        return parseFloat(result[1]);
    }
    return null;
}

$(document).ready( function(){
	
	if (!vz.hasExternalOSFunctions() && $.url().param("testAND") != "1") {
		$(window).resize(vuzeOnResize);
		vuzeOnResize();
	}

    vz.utils.selectOnFocus();
    // WebKit 533.1  (Android 2.3.3) needs scrollable divs hack
    // WebKit 533.17.9  (iPhone OS 4_2_1) needs scrollable divs hack
    //
    // WebKit 534.13 can do scrollable divs
    // WebKit 534.30 (Android 4.1.2) can do scrollable divs
    // WebKit 535.19 (Chrome 18.0.1025.166) can do scrollable divs
    // Assumed: 534 added scrollable Divs!
    var webkitVersion = getWebkitVersion();
	if (webkitVersion != null && webkitVersion < 534) {
		touchScroll(".scrollable");
	}
	
	var ua = navigator.userAgent;
	if (ua.indexOf("iPhone OS 4_") !== -1 || ua.indexOf("iPhone OS 3_") !== -1) {
		// older iPods crash on search results
		$("#toolbar-search").hide();
	}
});

if (vz.hasExternalOSFunctions() || $.url().param("testAND") == "1") {
	var fileref=document.createElement("link");
	fileref.setAttribute("rel", "stylesheet");
	fileref.setAttribute("type", "text/css");
	fileref.setAttribute("href", "./style/transmission/vuzeandroid.css");
	document.getElementsByTagName("head")[0].appendChild(fileref);
}
