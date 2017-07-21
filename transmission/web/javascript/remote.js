/* Transmission Revision 14025 */
/**
 * Copyright © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

var RPC = {
	_DaemonVersion          : 'version',
	_DownSpeedLimit         : 'speed-limit-down',
	_DownSpeedLimited       : 'speed-limit-down-enabled',
	_StartAddedTorrent      : 'start-added-torrents',
	_QueueMoveTop           : 'queue-move-top',
	_QueueMoveBottom        : 'queue-move-bottom',
	_QueueMoveUp            : 'queue-move-up',
	_QueueMoveDown          : 'queue-move-down',
	/* Original:
	_Root                   : '../rpc',
	 */
	_Root                   : './transmission/rpc',
	_TurtleDownSpeedLimit   : 'alt-speed-down',
	_TurtleState            : 'alt-speed-enabled',
	_TurtleUpSpeedLimit     : 'alt-speed-up',
	_UpSpeedLimit           : 'speed-limit-up',
	_UpSpeedLimited         : 'speed-limit-up-enabled',
	_AzMode                 : 'az-mode',
	_BasicAuth              : ''
};

// >> Vuze: Override some RPC prefs via url parameters
var url = window.location.toString();
// Android API 11-15 doesn't support url parameters on local files.  We
// hack it into userAgent :)
if (navigator.userAgent.lastIndexOf("?", 0) === 0) {
	url = url + navigator.userAgent;
	url = url.replace(/[\r\n]/g, "");
}
var urlParser = $.url(url);
root = urlParser.param("_Root");
if (typeof root !== "undefined") {
	RPC._Root = root;
}

basicAuth = urlParser.param("_BasicAuth");
if (typeof basicAuth !== "undefined") {
	RPC._BasicAuth = basicAuth;
}
// << Vuze

function TransmissionRemote(controller)
{
	this.initialize(controller);
	return this;
}

TransmissionRemote.prototype =
{
	/*
	 * Constructor
	 */
	initialize: function(controller) {
		this._controller = controller;
		this._error = '';
		this._lastCallWasError = false;
		this._token = '';
		/* >> Vuze Added */
		this._request_count = 0;
		this._error_array = new Array();
		this._errors_tolerated = 5;
   		/* << Vuze Added */
	},

	/* >> Vuze Added */
    isPersistentError: function(){
		var remote = this;
        var max = remote._error_array.length > 0 ? Math.max.apply(null, remote._error_array) : 0;
        return $.grep(remote._error_array, function(n, i){
            return n >= ( max - remote._errors_tolerated )
        }).length > remote._errors_tolerated
    },

    hasError: function() {
    	return this._lastCallWasError;
    },
	/* << Vuze Added */
    
	/*
	 * Display an error if an ajax request fails, and stop sending requests
	 * or on a 409, globally set the X-Transmission-Session-Id and resend
	 */
	ajaxError: function(jqXHR, textStatus, exception, ajaxObject) {
		var token,
		   remote = this;

		// set the Transmission-Session-Id on a 409
		if (jqXHR.status === 409 && (token = jqXHR.getResponseHeader('X-Transmission-Session-Id'))){
			remote._token = token;
			$.ajax(ajaxObject);
			return;
		}

		remote._error = jqXHR.responseText
		? jqXHR.responseText.trim().replace(/(<([^>]+)>)/ig,"")
				: "";
		if(!remote._error.length ) {
			remote._error = 'Server not responding' + ' (' + String(textStatus);
			if (String(exception).length > 0) {
				remote._error += ': ' + String(exception);
			}
			remote._error += ')';
		}

		/* >> Vuze Added */
		remote._lastCallWasError = true;
//		remote._error_array.push( remote._request_count )
//
//		if( !remote.isPersistentError() ) { 
//			console.log("not a persistent error -- exit");
//			return;
//		}
		if (vz.handleConnectionError(jqXHR.status, remote._error, textStatus)) {
			return;
		}
   		/* << Vuze Added */


		// Vuze: Fixes Uncaught ReferenceError: remote is not defined
		errorQuoted = remote._error.replace(/"/g, '\\"');
		
		dialog.confirm('Connection Failed',
			'Could not connect to the server. You may need to reload the page to reconnect.',
			'Details',
			'alert("' + errorQuoted + '");',
			null,
			'Dismiss');
		remote._controller.togglePeriodicSessionRefresh(false);
	},

	appendSessionId: function(XHR) {
		/* >> Vuze Added */
		if (RPC._BasicAuth.length > 0) {
			XHR.setRequestHeader('Authorization', 'Basic ' + RPC._BasicAuth);
		}
		if(this._token)
		/* << Vuze Added */
		XHR.setRequestHeader('X-Transmission-Session-Id', this._token);
	},

	sendRequest: function(data, callback, context, async) {
		var remote = this;
		if (typeof async != 'boolean')
			async = true;

		/* >> Vuze Added */
		remote._request_count += 1;
		remote._lastCallWasError = false;
   		/* >> Vuze Added */

		// >> Vuze: iPod caches without this
		data['math'] = Math.random();
		// << Vuze
		
		var ajaxSettings = {
			odata: data,
			startTime: new Date().getTime(),
			url: RPC._Root,
			type: 'POST',
			contentType: 'json',
			dataType: 'json',
			cache: false,
			timeout: 60000,
			data: JSON.stringify(data),
			beforeSend: function(XHR){ remote.appendSessionId(XHR); },
			error: function(request, textStatus, exception){
				if (request.status !== 409) {
					try {
						console.log('ajax error for ' + JSON.stringify(request));
						console.log('ajax textStatus: ' + textStatus);
						console.log('ajax error: ' + exception);
					} catch (err) {
						// ignore
					}
				}
				remote.ajaxError(request, textStatus, exception, ajaxSettings);
				},
			success: callback,
			context: context,
			async: async
		};
		
		
		if (async) {
			ajaxSettings.slowAjaxTimeOut = setTimeout(function() {
				ajaxSettings.slowAjaxTimeOut = null;
				vz.slowAjax(ajaxSettings.odata['method']);
			}, 1000);
		}

		$.ajax(ajaxSettings).always(function() {
			diff = (new Date().getTime()) - ajaxSettings.startTime ;
			if (typeof ajaxSettings.slowAjaxTimeOut !== "undefined") {
				if (ajaxSettings.slowAjaxTimeOut != null) {
					clearTimeout(ajaxSettings.slowAjaxTimeOut);
				} else {
					vz.slowAjaxDone(ajaxSettings.odata['method'], diff);
				}
			}
		});
		
	},

	loadDaemonPrefs: function(callback, context, async) {
		var o = { method: 'session-get' };
		this.sendRequest(o, callback, context, async);
	},
	
	checkPort: function(callback, context, async) {
		var o = { method: 'port-test' };
		this.sendRequest(o, callback, context, async);
	},
	
	loadDaemonStats: function(callback, context, async) {
		var o = { method: 'session-stats' };
		this.sendRequest(o, callback, context, async);
	},

	updateTorrents: function(torrentIds, fields, callback, context) {
		var o = {
			method: 'torrent-get',
				'arguments': {
				'fields': fields
			}
		};
		if (torrentIds)
			o['arguments'].ids = torrentIds;
		o['math'] = Math.random();
		this.sendRequest(o, function(response) {
			var args = response['arguments'];
			callback.call(context,args.torrents,args.removed);
		});
	},

	getFreeSpace: function(dir, callback, context) {
		var remote = this;
		var o = {
			method: 'free-space',
			arguments: { path: dir }
		};
		this.sendRequest(o, function(response) {
			var args = response['arguments'];
			callback.call (context, args.path, args['size-bytes']);
		});
	},

	changeFileCommand: function(torrentId, fileIndices, command) {
		var remote = this,
		    args = { ids: [torrentId] };
		args[command] = fileIndices;
		this.sendRequest({
			arguments: args,
			method: 'torrent-set'
		}, function() {
			remote._controller.refreshTorrents(true);
			// There was never a refreshTorrents that accepted an ID..
			//remote._controller.refreshTorrents([torrentId]);
		});
	},

	sendTorrentSetRequests: function(method, torrent_ids, args, callback, context) {
		if (!args) args = { };
		args['ids'] = torrent_ids;
		var o = {
			method: method,
			arguments: args
		};
		this.sendRequest(o, callback, context);
	},

	sendTorrentActionRequests: function(method, torrent_ids, callback, context) {
		this.sendTorrentSetRequests(method, torrent_ids, null, callback, context);
	},

	startTorrents: function(torrent_ids, noqueue, callback, context) {
		var name = noqueue ? 'torrent-start-now' : 'torrent-start';
		this.sendTorrentActionRequests(name, torrent_ids, callback, context);
	},
	stopTorrents: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests('torrent-stop', torrent_ids, callback, context);
	},

	moveTorrents: function(torrent_ids, new_location, callback, context) {
		var remote = this;
		this.sendTorrentSetRequests( 'torrent-set-location', torrent_ids, 
			{"move": true, "location": new_location}, callback, context);
	},

	/* Vuze:Tag list! */
	getTagList: function(callback, context) {
		var remote = this;
		var o = {
			method: 'tags-get-list',
		};
		this.sendRequest(o, function(response) {
			var args = response['arguments'];
			var tagArray = [];
			args.tags.forEach(function(tag) {
				tagArray[tag.uid] = tag;
			});
			callback.call (context, tagArray);
		});
	},

	removeTorrents: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests('torrent-remove', torrent_ids, callback, context);
	},
	removeTorrentsAndData: function(torrents) {
		var remote = this;
		var o = {
			method: 'torrent-remove',
			arguments: {
				'delete-local-data': true,
				ids: [ ]
			}
		};

		if (torrents) {
			for (var i=0, len=torrents.length; i<len; ++i) {
				o.arguments.ids.push(torrents[i].getId());
			}
		}
		this.sendRequest(o, function() {
			remote._controller.refreshTorrents(true);
		});
	},
	// >> Vuze
	removeTorrentById: function(id, deleteData) {
		if (typeof deleteData != "boolean") {
			deleteData = true;
		}
		var remote = this;
		var o = {
			method: 'torrent-remove',
			arguments: {
				'delete-local-data': deleteData,
				ids: [ id ]
			}
		};

		this.sendRequest(o, function() {
			remote._controller.refreshTorrents(true);
		});
	},
	// << Vuze
	verifyTorrents: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests('torrent-verify', torrent_ids, callback, context);
	},
	reannounceTorrents: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests('torrent-reannounce', torrent_ids, callback, context);
	},
	addTorrentByUrl: function(url, options) {
		// >> Vuze: fill in default options
		if (typeof options !== "object" || options == null) {
			options = {
				'download-dir' : $("#download-dir").val(),
				paused : !transmission.shouldAddedTorrentsStart()
			};
		}
		// << Vuze

		var remote = this;
		if (url.match(/^[0-9a-f]{40}$/i)) {
			url = 'magnet:?xt=urn:btih:'+url;
		}
		var o = {
			method: 'torrent-add',
			arguments: {
				paused: (options.paused),
				'download-dir': (options.destination),
				filename: url
			}
		};
		this.sendRequest(o, function(response) {
			var result = response['result'];
			if (result != "success") {
				alert("Error adding torrent:\n\n" + result);
			}
			remote._controller.refreshTorrents(true);
		});
	},
	// >> Vuze
	addTorrentByMetainfo: function(metainfo, options) {
		var remote = this;

		if (typeof options !== "object" || options == null) {
			options = {
				destination : $("#download-dir").val(),
				paused : !transmission.shouldAddedTorrentsStart()
			};
		}

		var o = {
			'method' : 'torrent-add',
			arguments : {
				paused: (options.paused),
				'download-dir': (options.destination),
				'metainfo' : metainfo
			}
		};
		remote.sendRequest(o, function(response) {
			if (response.result != 'success') {
				alert('Error adding torrent: ' + response.result);
			}
			remote._controller.refreshTorrents(true);
		});
	},
	// << Vuze
	savePrefs: function(args) {
		var remote = this;
		var o = {
			method: 'session-set',
			arguments: args
		};
		this.sendRequest(o, function() {
			remote._controller.loadDaemonPrefs();
		});
	},
	updateBlocklist: function() {
		var remote = this;
		var o = {
			method: 'blocklist-update'
		};
		this.sendRequest(o, function() {
			remote._controller.loadDaemonPrefs();
		});
	},

	// Added queue calls
	moveTorrentsToTop: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests(RPC._QueueMoveTop, torrent_ids, callback, context);
	},
	moveTorrentsToBottom: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests(RPC._QueueMoveBottom, torrent_ids, callback, context);
	},
	moveTorrentsUp: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests(RPC._QueueMoveUp, torrent_ids, callback, context);
	},
	moveTorrentsDown: function(torrent_ids, callback, context) {
		this.sendTorrentActionRequests(RPC._QueueMoveDown, torrent_ids, callback, context);
	}
};
