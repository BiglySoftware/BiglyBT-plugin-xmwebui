/* Transmission Revision 14090 */
/**
 * Copyright © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function Transmission()
{
	this.initialize();
}

Transmission.prototype =
{
	/****
	*****
	*****  STARTUP
	*****
	****/

	initialize: function()
	{
		var e;

		// Initialize the helper classes
		this.remote = new TransmissionRemote(this);
		this.inspector = new Inspector(this, this.remote);
		this.prefsDialog = new PrefsDialog(this.remote);
		$(this.prefsDialog).bind('closed', $.proxy(this.onPrefsDialogClosed,this));

		// >> Vuze: Always show menu!
		this.isMenuEnabled = true; //!isMobileDevice;
		this.uiPaused = false;
		this.skipClick = false;
		// << Vuze

		// Initialize the implementation fields
		this.filterText    = '';
		this._torrents     = {};
		this._rows         = [];
		this.dirtyTorrents = {};
		this.uriCache      = {};

		// Initialize the clutch preferences
		Prefs.getClutchPrefs(this);

		// Set up user events
		$('#toolbar-pause').click($.proxy(this.stopSelectedClicked,this));
		$('#toolbar-start').click($.proxy(this.startSelectedClicked,this));
		$('#toolbar-pause-all').click($.proxy(this.stopAllClicked,this));
		$('#toolbar-start-all').click($.proxy(this.startAllClicked,this));
		$('#toolbar-remove').click($.proxy(this.removeClicked,this));
		$('#toolbar-open').click($.proxy(this.openTorrentClicked,this));

		$('#prefs-button').click($.proxy(this.togglePrefsDialogClicked,this)); 
		// >> Vuze
		$('#toolbar-search').click($.proxy(this.searchClicked,this));
		$('#toolbar-remote').click($.proxy(this.returnFromSearchClicked,this));
		$('#toolbar-remote-search').click($.proxy(this.remoteSearchClicked,this));
		$('#log_out').click($.proxy(this.vuzeLogOutClicked,this));
		// << Vuze


		// Vuze: added ".button()" to give it jQuery UI style
		$('#upload_confirm_button').button().click($.proxy(this.confirmUploadClicked,this));
		$('#upload_cancel_button').button().click($.proxy(this.hideUploadDialog,this));

		$('#move_confirm_button').button().click($.proxy(this.confirmMoveClicked,this));
		$('#move_cancel_button').button().click($.proxy(this.hideMoveDialog,this));

		/* Vuze: No Turtle or Compact Button
		$('#turtle-button').click($.proxy(this.toggleTurtleClicked,this));
		$('#compact-button').click($.proxy(this.toggleCompactClicked,this));
		*/

		// tell jQuery to copy the dataTransfer property from events over if it exists
		jQuery.event.props.push("dataTransfer");

		// Vuze: added ".button()" to give it jQuery UI style
		$('#torrent_upload_form').submit(function() { $('#upload_confirm_button').button().click(); return false; });
		/* >> Vuze: Inspector now inline
		$('#inspector-close').click($.proxy(this.toggleInspector,this));
		*/
		$('#toolbar-inspector').click($.proxy(this.toggleInspector,this));

		e = $('#filter-mode');
		e.val(this[Prefs._FilterMode]);
		e.change($.proxy(this.onFilterModeClicked,this));
		$('#filter-tracker').change($.proxy(this.onFilterTrackerClicked,this));

		if (!isMobileDevice) {
			$(document).bind('keydown', $.proxy(this.keyDown,this) );
			$(document).bind('keyup', $.proxy(this.keyUp, this) );
			$('#torrent_container').click( $.proxy(this.deselectAll,this) );
			$('#torrent_container').bind('dragover', $.proxy(this.dragenter,this));
			$('#torrent_container').bind('dragenter', $.proxy(this.dragenter,this));
			$('#torrent_container').bind('drop', $.proxy(this.drop,this));
			$('#inspector_link').click( $.proxy(this.toggleInspector,this) );

			this.setupSearchBox();
			this.createContextMenu();
		}

		if (this.isMenuEnabled)
			this.createSettingsMenu();
 
		e = {};
		e.torrent_list              = $('#torrent_list')[0];
		e.toolbar_buttons           = $('#toolbar ul li');
		e.toolbar_pause_button      = $('#toolbar-pause')[0];
		e.toolbar_start_button      = $('#toolbar-start')[0];
		e.toolbar_remove_button     = $('#toolbar-remove')[0];
		this.elements = e;

		// Apply the prefs settings to the gui
		this.initializeSettings();

		// Get preferences & torrents from the daemon
		var async = false;
		this.loadDaemonPrefs(async);
		if (this.remote.hasError()) {
			return;
		}
		this.loadDaemonStats(async);
		this.initializeTorrents();
		this.refreshTorrents(true);
		this.togglePeriodicSessionRefresh(true);

		this.updateButtonsSoon();
		
		vz.uiReady();
	},

	loadDaemonPrefs: function(async) {
		this.remote.loadDaemonPrefs(function(data) {
			var o = data['arguments'];
			if (typeof o === "undefined") {
				// if this wasn't async, we have a big problem.  hope the user refreshes!
				return;
			}
			// data might be {"result":"error:some error"}
			Prefs.getClutchPrefs(o);
			this.updateGuiFromSession(o);
			this.sessionProperties = o;
			vz.updateSessionProperties(o);
		}, this, async);
	},

	loadImages: function() {
		for (var i=0, row; row=arguments[i]; ++i)
			jQuery("<img>").attr("src", row);
	},

	/*
	 * Load the clutch prefs and init the GUI according to those prefs
	 */
	initializeSettings: function()
	{
		Prefs.getClutchPrefs(this);

		if (this.isMenuEnabled)
		{
			$('#sort_by_' + this[Prefs._SortMethod]).addClass('menu-item-selected');
			/* Vuze: Replaced
			$('#sort_by_' + this[Prefs._SortMethod]).selectMenuItem();
			*/

			if (this[Prefs._SortDirection] === Prefs._SortDescending)
				$('#reverse_sort_order').addClass('menu-item-selected');
			/* Vuze: Replaced
				$('#reverse_sort_order').selectMenuItem();
			*/
		}

		this.initCompactMode();

		/* >> Vuze: Pairing Logout, hide turtle mode, 'Add' for isMobileDevice (Why?) */
		// determine whether to display logout button
		
		$.ajax({
			url: "/isServicePaired",
			success: function(responseText) {
				var json = eval('(' + responseText + ')');
				if (json['servicepaired']) {
					$("#log_out").show();
				} else {
					$("#log_out").hide();
				}
			}
		});

		/* Vuze : No Turtle Button 
		$("div.limit_turtle").hide()
		*/

		if (isMobileDevice) {
			$("div#open_link span").text("Add")
		}
        /* << Vuze */
	},
	
	/*
	 * Set up the search box
	 */
	setupSearchBox: function()
	{
		var tr = this;
		var search_box = $('#torrent_search');
		search_box.bind('keyup click', function() {
			tr.setFilterText(this.value);
		});
		/* Vuze: Removed browser logic (jquery no longer has browser)
		if (!$.browser.safari)
		{
			search_box.addClass('blur');
			search_box[0].value = 'Filter';
			search_box.bind('blur', function() {
				if (this.value === '') {
					$(this).addClass('blur');
					this.value = 'Filter';
					tr.setFilterText(null);
				}
			}).bind('focus', function() {
				if ($(this).is('.blur')) {
					this.value = '';
					$(this).removeClass('blur');
				}
			});
		}
		 */
	},

	/**
	 * Create the torrent right-click menu
	 */
	createContextMenu: function() {
		var tr = this;

		// Set up the context menu
		$('#ul_torrent_context_menu').menu();
		$('#ul_torrent_context_menu').hide();
		$('ul#torrent_list').bind('contextmenu', function(e) {
			// select current row
			var element = $(e.target).closest('.torrent')[0];
			var i = $('#torrent_list > li').index(element);
			if ((i!==-1) && !tr._rows[i].isSelected())
				tr.setSelectedRow(tr._rows[i]);

			$('#ul_torrent_context_menu').css({left : e["pageX"], top : e["pageY"]}).show();
			$(document).one('click', function() {
				$('#ul_torrent_context_menu').hide();
			});
			return false;
		});
		$('ul#torrent_list').bind('taphold', function(e) {
			e.stopPropagation();
			e.preventDefault();

			// taphold doesn't have pageX and others.. try originalEvent
			if (typeof e.originalEvent != 'undefined') {
				e = e.originalEvent;
				e.stopPropagation();
				e.preventDefault();
			}


			// select current row
			var element = $(e.target).closest('.torrent')[0];
			var i = $('#torrent_list > li').index(element);
			if ((i!==-1) && !tr._rows[i].isSelected())
				tr.setSelectedRow(tr._rows[i]);

			if (vz.handleTapHold()) {
				return;
			}

			tr.showContextMenu();

			return false;
		});
		$("#ul_torrent_context_menu" ).on( "menuselect", $.proxy(this.onContextMenuClicked,this));
		

		/* >> Vuze: replaced with jQueryUI.menu
		var bindings = {
			context_pause_selected:       function() { tr.stopSelectedTorrents(); },
			context_resume_selected:      function() { tr.startSelectedTorrents(false); },
			context_resume_now_selected:  function() { tr.startSelectedTorrents(true); },
			context_move:                 function() { tr.moveSelectedTorrents(false); },
			context_remove:               function() { tr.removeSelectedTorrents(); },
			context_removedata:           function() { tr.removeSelectedTorrentsAndData(); },
			context_verify:               function() { tr.verifySelectedTorrents(); },
			context_reannounce:           function() { tr.reannounceSelectedTorrents(); },
			context_move_top:             function() { tr.moveTop(); },
			context_move_up:              function() { tr.moveUp(); },
			context_move_down:            function() { tr.moveDown(); },
			context_move_bottom:          function() { tr.moveBottom(); },
			context_select_all:           function() { tr.selectAll(); },
			context_deselect_all:         function() { tr.deselectAll(); }
		};

		// Set up the context menu
		$('ul#torrent_list').contextMenu('torrent_context_menu', {
			bindings:          bindings,
			menuStyle:         { width: '310px', backgroundColor: '#fff', border: 'none', padding: '5px 0', textAlign: 'left' },
			itemStyle:         { backgroundColor: 'transparent', margin: '0', padding: '3px 10px 3px 20px', color: '#000', cursor: 'default', border: 'none'},
			itemHoverStyle:    { backgroundColor: '#24e', color: '#fff', border: 'none'},
			shadow:            false,
			boundingElement:   $('div#torrent_container'),
			boundingRightPad:  20,
			boundingBottomPad: 5,
			onContextMenu: function(ev) {
				var element = $(ev.target).closest('.torrent')[0];
				var i = $('#torrent_list > li').index(element);
				if ((i!==-1) && !tr._rows[i].isSelected())
					tr.setSelectedRow(tr._rows[i]);
				return true;
			}
		});
		*/
	},

	// >> Vuze: Show context menu, centered
	showContextMenu: function() {
		$('#ul_torrent_context_menu').position({
			   my: "center",
			   at: "center",
			   of: $('ul#torrent_list'),
			   within: $('ul#torrent_list')
			});
		$('#ul_torrent_context_menu').center();
		$('#ul_torrent_context_menu').show();
		$(document).one('click', function() {
			$('#ul_torrent_context_menu').hide();
		});
	},
	// << Vuze

	createSettingsMenu: function() {
		$('#settings_menu').click($.proxy(this.settingsMenuClicked,this));
		$('#footer_super_menu').menu();
		$('#footer_super_menu').hide();
		$("#footer_super_menu" ).on( "menuselect", $.proxy(this.onMenuClicked,this));

		$('#unlimited_download_rate').addClass('menu-item-selected');
		$('#unlimited_upload_rate').addClass('menu-item-selected');
		/* Vuze: Replaced transMenu with jQueryUI.menu
		$('#settings_menu').transMenu({
			selected_char: '&#x2714;',
			/* >> Vuze
			direction: 'up',
			/**
			direction: 'down',
			/* << Vuze *
			onClick: $.proxy(this.onMenuClicked,this)
		});

		$('#unlimited_download_rate').selectMenuItem();
		$('#unlimited_upload_rate').selectMenuItem();
		*/
	},
	
	settingsMenuClicked: function(ev) {
		$('#footer_super_menu').toggle();
	},

	/****
	*****
	****/

	updateFreeSpaceInAddDialog: function()
	{
		var formdir = $('input#add-dialog-folder-input').val();
		this.remote.getFreeSpace (formdir, this.onFreeSpaceResponse, this);
	},

	onFreeSpaceResponse: function(dir, bytes)
	{
		var e, str, formdir;

		formdir = $('input#add-dialog-folder-input').val();
		if (formdir == dir)
		{
			e = $('label#add-dialog-folder-label');
			if (bytes > 0)
				str = '  <i>(' + Transmission.fmt.size(bytes) + ' Free)</i>';
			else
				str = '';
			e.html ('Destination folder' + str + ':');
		}
	},


	/****
	*****
	*****  UTILITIES
	*****
	****/

	getAllTorrents: function()
	{
		var torrents = [];
		for (var key in this._torrents)
			torrents.push(this._torrents[key]);
		return torrents;
	},

	getTorrentIds: function(torrents)
	{
		return $.map(torrents.slice(0), function(t) {return t.getId();});
	},

	scrollToRow: function(row)
	{
		if (isMobileDevice) // FIXME: why?
			return;

		var list = $('#torrent_container'),
		    scrollTop = list.scrollTop(),
		    innerHeight = list.innerHeight(),
		    offsetTop = row.getElement().offsetTop,
		    offsetHeight = $(row.getElement()).outerHeight();

		if (offsetTop < scrollTop)
			list.scrollTop(offsetTop);
		else if (innerHeight + scrollTop < offsetTop + offsetHeight)
			list.scrollTop(offsetTop + offsetHeight - innerHeight);
	},

	seedRatioLimit: function() {
		var p = this.sessionProperties;
		if (p && p.seedRatioLimited)
			return p.seedRatioLimit;
		return -1;
	},

	setPref: function(key, val)
	{
		this[key] = val;
		Prefs.setValue(key, val);
	},

	/****
	*****
	*****  SELECTION
	*****
	****/

	getSelectedRows: function() {
		return $.grep(this._rows, function(r) {return r.isSelected();});
	},

	getRowFromTorrent: function(torrent) {
		var id = torrent.getId();
		return $.grep(this._rows, function(r) {return r.getTorrent().getId() == id;})[0];
	},

	getSelectedTorrents: function() {
		return $.map(this.getSelectedRows(),function(r) {
			return r.getTorrent();
		});
	},

	getSelectedTorrentIds: function() {
		return this.getTorrentIds(this.getSelectedTorrents());
	},

	setSelectedRow: function(row) {
		$(this.elements.torrent_list).children('.selected').removeClass('selected');
		this.selectRow(row);
	},

	selectRow: function(row) {
		$(row.getElement()).addClass('selected');
		this.callSelectionChangedSoon();
	},

	deselectRow: function(row) {
		$(row.getElement()).removeClass('selected');
		this.callSelectionChangedSoon();
	},

	selectAll: function() {
		$(this.elements.torrent_list).children().addClass('selected');
		this.callSelectionChangedSoon();
	},
	deselectAll: function() {
		$(this.elements.torrent_list).children('.selected').removeClass('selected');
		this.callSelectionChangedSoon();
		delete this._last_torrent_clicked;
	},

	indexOfLastTorrent: function() {
		for (var i=0, r; r=this._rows[i]; ++i)
			if (r.getTorrentId() === this._last_torrent_clicked)
				return i;
		return -1;
	},

	// Select a range from this row to the last clicked torrent
	selectRange: function(row)
	{
		var last = this.indexOfLastTorrent();

		if (last === -1)
		{
			this.selectRow(row);
		}
		else // select the range between the prevous & current
		{
			var next = this._rows.indexOf(row);
			var min = Math.min(last, next);
			var max = Math.max(last, next);
			for (var i=min; i<=max; ++i)
				this.selectRow(this._rows[i]);
		}

		this.callSelectionChangedSoon();
	},

	selectionChanged: function()
	{
		clearTimeout(this.selectionChangedTimer);
		delete this.selectionChangedTimer;

		this.updateButtonStates();

		/** >> Vuze: Inspector is now inline and does not follow the cursor
		this.inspector.setTorrents(this.inspectorIsVisible() ? this.getSelectedTorrents() : []);
		*/
	},

	callSelectionChangedSoon: function()
	{
		if (!this.selectionChangedTimer)
		{
			var callback = $.proxy(this.selectionChanged,this),
			    msec = 200;
			this.selectionChangedTimer = setTimeout(callback, msec);
		}
	},

	/*--------------------------------------------
	 *
	 *  E V E N T   F U N C T I O N S
	 *
	 *--------------------------------------------*/

	/*
	 * Process key event
	 */
	keyDown: function(ev)
	{
		var handled = false,
		    rows = this._rows,
		    up = ev.keyCode === 38, // up key pressed
		    dn = ev.keyCode === 40, // down key pressed
		    shift = ev.keyCode === 16; // shift key pressed

		if ((up || dn) && rows.length)
		{
			var last = this.indexOfLastTorrent(),
			    i = last,
			    anchor = this._shift_index,
			    r,
			    min = 0,
			    max = rows.length - 1;

			if (dn && (i+1 <= max))
				++i;
			else if (up && (i-1 >= min))
				--i;

			var r = rows[i];

			if (anchor >= 0)
			{
				// user is extending the selection
				// with the shift + arrow keys...
				if (   ((anchor <= last) && (last < i))
				    || ((anchor >= last) && (last > i)))
				{
					this.selectRow(r);
				}
				else if (((anchor >= last) && (i > last))
				      || ((anchor <= last) && (last > i)))
				{
					this.deselectRow(rows[last]);
				}
			}
			else
			{
				if (ev.shiftKey)
					this.selectRange(r);
				else
					this.setSelectedRow(r);
			}
			this._last_torrent_clicked = r.getTorrentId();
			this.scrollToRow(r);
			handled = true;
		}
		else if (shift)
		{
			this._shift_index = this.indexOfLastTorrent();
		}

		return !handled;
	},

	keyUp: function(ev) {
		if (ev.keyCode === 16) // shift key pressed
			delete this._shift_index;
	},

	isButtonEnabled: function(ev) {
		var p = (ev.target || ev.srcElement).parentNode;
		return p.className!=='disabled'
		    && p.parentNode.className!=='disabled';
	},

	stopSelectedClicked: function(ev) {
		if (this.isButtonEnabled(ev)) {
			this.stopSelectedTorrents();
			this.hideMobileAddressbar();
		}
	},

	startSelectedClicked: function(ev) {
		if (this.isButtonEnabled(ev)) {
			this.startSelectedTorrents(false);
			this.hideMobileAddressbar();
		}
	},

	stopAllClicked: function(ev) {
		if (this.isButtonEnabled(ev)) {
			this.stopAllTorrents();
			this.hideMobileAddressbar();
		}
	},

	startAllClicked: function(ev) {
		if (this.isButtonEnabled(ev)) {
			this.startAllTorrents(false);
			this.hideMobileAddressbar();
		}
	},

	openTorrentClicked: function(ev) {
		if (this.isButtonEnabled(ev)) {
			if (!vz.showOpenTorrentDialog()) {
				$('body').addClass('open_showing');
				this.uploadTorrentFile();
			}
			this.updateButtonStates();
		}
	},

	/* >> Vuze */
	searchClicked: function(ev) {
		vz.ui.toggleRemoteSearch();
	},

	returnFromSearchClicked: function(ev) {
		vz.ui.toggleRemoteSearch();
	},

	remoteSearchClicked: function(ev) {
		vz.executeSearch();
	},
	
	vuzeLogOutClicked: function(ev) {
		vz.logout();
	},
	
	pauseUI: function() {
		clearTimeout(this.refreshTorrentsTimeout);
		this.uiPaused = true;
	},
	
	resumeUI: function() {
		this.uiPaused = false;
		// schedule the next request
		this.refreshTorrents();
	},

	updateTagList: function(callback) {
		this.remote.getTagList (function(tags) {
			this.tags = tags;
			if (callback !== undefined) {
				callback();
			}
		}, this);
	},

	/* << Vuze */

	dragenter: function(ev) {
		if (ev.dataTransfer && ev.dataTransfer.types) {
			var types = ["text/uri-list", "text/plain"];
			for (var i = 0; i < types.length; ++i) {
				// it would be better to look at the links here;
				// sadly, with Firefox, trying would throw.
				if (ev.dataTransfer.types.contains(types[i])) {
					ev.stopPropagation();
					ev.preventDefault();
					ev.dropEffect = "copy";
					return false;
				}
			}
		}
		else if (ev.dataTransfer) {
			ev.dataTransfer.dropEffect = "none";
		}
		return true;
	},

	drop: function(ev)
	{
		var i, uri, uris=null,
		    types = ["text/uri-list", "text/plain"],
		    paused = this.shouldAddedTorrentsStart();

		if (!ev.dataTransfer || !ev.dataTransfer.types)
			return true;

		for (i=0; !uris && i<types.length; ++i)
			if (ev.dataTransfer.types.contains(types[i]))
				uris = ev.dataTransfer.getData(types[i]).split("\n");

		for (i=0; uri=uris[i]; ++i) {
			if (/^#/.test(uri)) // lines which start with "#" are comments
				continue;
			if (/^[a-z-]+:/i.test(uri)) // close enough to a url
				this.remote.addTorrentByUrl(uri, {
					paused : paused
				});
		}

		ev.preventDefault();
		return false;
	},

	hideUploadDialog: function() {
		$('body.open_showing').removeClass('open_showing');
		$('#upload_container').hide();
		this.updateButtonStates();
	},

	confirmUploadClicked: function() {
		this.uploadTorrentFile(true);
		this.hideUploadDialog();
	},

	hideMoveDialog: function() {
		$('#move_container').hide();
		this.updateButtonStates();
	},

	confirmMoveClicked: function() {
		this.moveSelectedTorrents(true);
		this.hideUploadDialog();
	},

	removeClicked: function(ev) {
		if (this.isButtonEnabled(ev)) {
			this.removeSelectedTorrents();
			this.hideMobileAddressbar();
		}
	},

	// turn the periodic ajax session refresh on & off
	togglePeriodicSessionRefresh: function(enabled) {
		clearInterval(this.sessionInterval);
		delete this.sessionInterval;
		if (enabled) {
		        var callback = $.proxy(this.loadDaemonPrefs,this),
		        // >> Vuze: Was 8s.. why do we need to call it so often!?
			    msec = 80000;
			this.sessionInterval = setInterval(callback, msec);
		}
	},

	/* Vuze : No Turtle Button 
	toggleTurtleClicked: function()
	{
		var o = {};
		o[RPC._TurtleState] = !$('#turtle-button').hasClass('selected');
		this.remote.savePrefs(o);
	},
	*/

	/*--------------------------------------------
	 *
	 *  I N T E R F A C E   F U N C T I O N S
	 *
	 *--------------------------------------------*/

	onPrefsDialogClosed: function() {
		$('#prefs-button').removeClass('selected');
	},

	togglePrefsDialogClicked: function(ev)
	{
		var e = $('#prefs-button');

		if (e.hasClass('selected'))
			this.prefsDialog.close();
		else {
			e.addClass('selected');
			this.prefsDialog.show();
		}
	},

	showPrefsDialog: function()
	{
		this.prefsDialog.show();
	},

	setFilterText: function(search) {
		this.filterText = search ? search.trim() : null;
		this.refilter(true);
	},

	setSortMethod: function(sort_method) {
		this.setPref(Prefs._SortMethod, sort_method);
		this.refilter(true);
	},

	setSortDirection: function(direction) {
		this.setPref(Prefs._SortDirection, direction);
		this.refilter(true);
	},

	// >> Vuze
	onContextMenuClicked: function(ev, ui) 
	{
		var id = ui.item[0].id;
		var tr = this;
	    var element = $(ui.item[0]);

		//console.log(ev.type + " for " + id);

		// >> Vuze: Submenu? exit early. No Submenu? Hide the menu.
		if ( element.children( "a[aria-haspopup='true']" ).length ) {
			return false;
		} else {
			$(ev.target).hide();
		}
		// << Vuze


		$('#ul_torrent_context_menu').hide();

		switch (id) {
		case 'context_pause_selected': {
			tr.stopSelectedTorrents();
			break;
		}
		case 'context_resume_selected': {
			tr.startSelectedTorrents(false);
			break;
		}
		case 'context_resume_now_selected': {
			tr.startSelectedTorrents(true);
			break;
		}
		case 'context_move': {
			tr.moveSelectedTorrents(false);
			break;
		}
		case 'context_remove': {
			tr.removeSelectedTorrents();
			break;
		}
		case 'context_removedata': {
			tr.removeSelectedTorrentsAndData();
			break;
		}
		case 'context_verify': {
			tr.verifySelectedTorrents();
			break;
		}
		case 'context_reannounce': {
			tr.reannounceSelectedTorrents();
			break;
		}
		case 'context_move_top': {
			tr.moveTop();
			break;
		}
		case 'context_move_up': {
			tr.moveUp();
			break;
		}
		case 'context_move_down': {
			tr.moveDown();
			break;
		}
		case 'context_move_bottom': {
			tr.moveBottom();
			break;
		}
		case 'context_select_all': {
			tr.selectAll();
			break;
		}
		case 'context_deselect_all': {
			tr.deselectAll();
			break;
		}
		}
		return true;
	},
	// << Vuze
	
	onMenuClicked: function(ev, ui)
	{
		var o, dir,
		    id = ui.item[0].id,
		    remote = this.remote,
		    element = $(ui.item[0]);

		elementA = element.find('a');

		// >> Vuze: Submenu? exit early. No Submenu? Hide the menu.
		if ( element.children( "a[aria-haspopup='true']" ).length ) {
			return false;
		} else {
			$(ev.target).hide();
		}
		// << Vuze

		if (element.hasClass('sort-mode'))
		{
			element.parent().find('.sort-mode').each(function() {
				/* Vuze: Removed
				element.parent().deselectMenuItem();
				*/
				$(this).removeClass('menu-item-selected');
			});
			/* Vuze: Removed
			element.selectMenuItem();
			*/
			element.addClass('menu-item-selected');
			this.setSortMethod(id.replace(/sort_by_/, ''));
		}
		else if (element.hasClass('upload-speed'))
		{
			o = {};
			o[RPC._UpSpeedLimit] = parseInt(elementA.html());
			o[RPC._UpSpeedLimited] = true;
			remote.savePrefs(o);
		}
		else if (element.hasClass('download-speed'))
		{
			o = {};
			o[RPC._DownSpeedLimit] = parseInt(elementA.html());
			o[RPC._DownSpeedLimited] = true;
			remote.savePrefs(o);
		}
		else switch (id)
		{
			/* >> Vuze: Add compact view menu back in */
			case 'compact_view':
				this.toggleCompactClicked();
				break;
			/* << Vuze */
			
			case 'preferences':
				this.showPrefsDialog();
				break;

			case 'statistics':
				this.showStatsDialog();
				break;

			case 'about-button':
				o = 'Transmission ' + this.serverVersion;
				$('#about-dialog #about-title').html(o);
				$('#about-dialog').dialog({
					title: 'About',
					show: 'fade',
					hide: 'fade'
				});
				break;

			case 'homepage':
				window.open('http://www.vuze.com/');
				break;

			case 'tipjar':
				window.open('http://www.transmissionbt.com/donate.php?sourceRef=Vuze');
				break;	

			case 'unlimited_download_rate':
				o = {};
				o[RPC._DownSpeedLimited] = false;
				remote.savePrefs(o);
				break;

			case 'limited_download_rate':
				o = {};
				o[RPC._DownSpeedLimited] = true;
				remote.savePrefs(o);
				break;

			case 'unlimited_upload_rate':
				o = {};
				o[RPC._UpSpeedLimited] = false;
				remote.savePrefs(o);
				break;

			case 'limited_upload_rate':
				o = {};
				o[RPC._UpSpeedLimited] = true;
				remote.savePrefs(o);
				break;

			case 'reverse_sort_order':
				/* Vuze: Removed
				if (element.menuItemIsSelected()) {
				 */
				if (element.hasClass('menu-item-selected')) {
					dir = Prefs._SortAscending;
					/* Vuze: Removed
					element.deselectMenuItem();
					 */
					element.removeClass('menu-item-selected');
				} else {
					dir = Prefs._SortDescending;
					/* Vuze: Removed
					element.selectMenuItem();
					*/
					element.addClass('menu-item-selected');
				}
				this.setSortDirection(dir);
				break;

			case 'toggle_notifications':
				Notifications && Notifications.toggle();
				break;

			default:
				console.log('unhandled: ' + id);
				break;

		}
		$('#settings_menu').trigger('closemenu');
		ev.stopImmediatePropagation();
	},

	onTorrentChanged: function(ev, tor)
	{
		// update our dirty fields
		this.dirtyTorrents[ tor.getId() ] = true;

		// enqueue ui refreshes
		this.refilterSoon();
		this.updateButtonsSoon();
	},

	updateFromTorrentGet: function(updates, removed_ids)
	{
		//console.log(">updateFromTorrentGet " + updates.length);
		var i, o, t, id, needed, needinfo = [],
		    callback, fields;

		for (i=0; o=updates[i]; ++i)
		{
			id = o.id;
			if ((t = this._torrents[id]))
			{
				needed = t.needsMetaData();
				t.refresh(o);
				if (needed && !t.needsMetaData())
					needinfo.push(id);
			}
			else {
				// Vuze: We had issues where the callback was being registered after the first call to the callback
				//       The "fix" was to pass the callback into the initialization and have it bind 'dataChanged'
				callback = $.proxy(this.onTorrentChanged,this);

				t = this._torrents[id] = new Torrent(o, callback);
				this.dirtyTorrents[id] = true;
				// do we need more info for this torrent?
				//console.log("-updateFromTorrentGet:" + i + " name= " + ('name' in t.fields) + ";status=" + ('status' in t.fields));
				if(!('name' in t.fields) || !('status' in t.fields))
					needinfo.push(id);

				t.notifyOnFieldChange('status', $.proxy(function (newValue, oldValue) {
					if (oldValue === Torrent._StatusDownload && (newValue == Torrent._StatusSeed || newValue == Torrent._StatusSeedWait)) {
						$(this).trigger('downloadComplete', [t]);
					} else if (oldValue === Torrent._StatusSeed && newValue === Torrent._StatusStopped && t.isFinished()) {
						$(this).trigger('seedingComplete', [t]);
					} else {
						$(this).trigger('statusChange', [t]);
					}
				}, this));
			}
		}

		//console.log("needinfo " + needinfo.length);
		if (needinfo.length) {
			// whee, new torrents! get their initial information.
			fields = ['id'].concat(Torrent.Fields.Metadata,
			                       Torrent.Fields.Stats);
			this.updateTorrents(needinfo, fields);
			this.refilterSoon();
		}

		if (removed_ids) {
			this.deleteTorrents(removed_ids);
			this.refilterSoon();
		}
	},

	updateTorrents: function(ids, fields)
	{
		this.remote.updateTorrents(ids, fields,
		                           this.updateFromTorrentGet, this);
	},

	refreshTorrents: function(force)
	{
		if (typeof force != 'boolean') {
			force = false;
		}
		var callback = $.proxy(this.refreshTorrents,this),
		    msec = this[Prefs._RefreshRate] * 1000,
		    fields = ['id'].concat(Torrent.Fields.Stats);

		// send a request right now
		this.updateTorrents('recently-active', fields);

		// schedule the next request
		clearTimeout(this.refreshTorrentsTimeout);
		if (force || (!this.uiPaused && msec > 0)) {
			this.refreshTorrentsTimeout = setTimeout(callback, msec);
		}
	},

	initializeTorrents: function()
	{
		var fields = ['id'].concat(Torrent.Fields.Metadata,
		                           Torrent.Fields.Stats);
		this.updateTorrents(null, fields);
	},

	onRowClicked: function(ev)
	{
		if ($(ev.target).hasParent("#torrent_inspector").length > 0) {
			// part of torrent inpector -- return early and allow propogation
			return;
		}

		// Prevents click carrying to parent element
		// which deselects all on click
		ev.stopPropagation();
		// prevent click event when tap is pressed
		ev.preventDefault();

		// ev.preventDefault doesn't always cancel click event..
		// ignore clicks if tap has been pressed once
		if (!this.skipClick) {
			if (ev.type == 'tap') {
				this.skipClick = true;
			}
		} else {
			if (ev.type == 'click') {
				return;
			}
		}

		//console.log(ev.type + " for " + ev.target.className);

		// but still hide the context menu if it is showing
		$('#ul_torrent_context_menu').hide();

		
		var meta_key = ev.metaKey || ev.ctrlKey,
		    row = ev.currentTarget.row;

		// handle the per-row "torrent_resume" button
		if (ev.target.className === 'torrent_resume') {
			this.startTorrent(row.getTorrent());
			return;
		}

		// handle the per-row "torrent_pause" button
		if (ev.target.className === 'torrent_pause') {
			this.stopTorrent(row.getTorrent());
			return;
		}

		/* >> Vuze */
		// handle the per-row "torrent_info" button
		if ($(ev.target).hasClass('torrent_info')) {
			
			if ($(ev.target).hasClass('selected')) {
				this.setInspectorVisible(false);
				$(this.elements.torrent_list).find('.torrent_info.selected').removeClass('selected');
			} else {
				$(this.elements.torrent_list).find('.torrent_info.selected').removeClass('selected');
				if (this.inspectorIsVisible()) {
					var iOffset = $('#torrent_inspector').offset();
					var y2 = iOffset.top + $('#torrent_inspector').outerHeight();
					var btnY1 = $(ev.target).offset().top;
					if (btnY1 > y2) {
						var list = $('#torrent_container');
					    var scrollTop = list.scrollTop();
						$(window).scrollTop(scrollTop - $('#torrent_inspector').outerHeight());
					}
				}

				this.inspector.setTorrents([ row.getTorrent() ]);
				this.setInspectorVisible(true);

				$(ev.target).toggleClass('selected', true);
				//this.setInspectorVisible(true);
			}

		} else 
		/* << Vuze */

		if (isMobileDevice) {
			if (row.isSelected())
				this.setInspectorVisible(true);
			this.setSelectedRow(row);

		} else if (ev.shiftKey) {
			this.selectRange(row);
			// Need to deselect any selected text
			window.focus();

		// Apple-Click, not selected
		} else if (!row.isSelected() && meta_key) {
			this.selectRow(row);

		// Regular Click, not selected
		} else if (!row.isSelected()) {
			this.setSelectedRow(row);

		// Apple-Click, selected
		} else if (row.isSelected() && meta_key) {
			this.deselectRow(row);

		// Regular Click, selected
		} else if (row.isSelected()) {
			this.deselectRow(row);
		}

		this._last_torrent_clicked = row.getTorrentId();
	},

	deleteTorrents: function(ids)
	{
		var i, id;

		if (ids && ids.length)
		{
			for (i=0; id=ids[i]; ++i) {
				this.dirtyTorrents[id] = true;
				delete this._torrents[id];
			}
			this.refilter();
		}
	},

	shouldAddedTorrentsStart : function()
	{
		return this.prefsDialog.shouldAddedTorrentsStart();
	},
	
	/*
	 * Select a torrent file to upload
	 */
	uploadTorrentFile: function(confirmed)
	{
		var i, file,
		    reader,
		    fileInput   = $('input#torrent_upload_file'),
		    folderInput = $('input#add-dialog-folder-input'),
		    startInput  = $('input#torrent_auto_start'),
		    urlInput    = $('input#torrent_upload_url');

		if (!confirmed)
		{
			// update the upload dialog's fields
			fileInput.val("");
			urlInput.val('');
			startInput.prop('checked', this.shouldAddedTorrentsStart());
			folderInput.val($("#download-dir").val());
			folderInput.change($.proxy(this.updateFreeSpaceInAddDialog,this));
			this.updateFreeSpaceInAddDialog();

			// show the dialog
			$('#upload_container').show();
			urlInput.focus();
		}
		else
		{
			var paused = !startInput.is(':checked'),
			    destination = folderInput.val(),
			    remote = this.remote;

			jQuery.each (fileInput[0].files, function(i,file) {
				var reader = new FileReader();
				// >> Vuze: Add error notification
				reader.onerror = function(evt) {
						    switch(evt.target.error.code) {
						      case evt.target.error.NOT_FOUND_ERR:
						        alert('File Not Found!');
						        break;
						      case evt.target.error.NOT_READABLE_ERR:
						        alert('File is not readable');
						        break;
						      case evt.target.error.ABORT_ERR:
						        break; // noop
						      default:
						        alert('An error occurred reading this file.');
						    };
				};
				// << Vuze
				reader.onload = function(e) { 
					var contents = e.target.result;
					var key = "base64,"
					var index = contents.indexOf (key);
					if (index > -1) {
						var metainfo = contents.substring(index + key.length);
						var arguments = {
							'destination' : destination,
							'paused' : paused
						};

						remote.addTorrentByMetainfo(metainfo, arguments);
					}
				}
				reader.readAsDataURL (file);
				
			});
			var url = $('#torrent_upload_url').val();
			if (url != '') {
				// Vuze: Rev 14090 added code which is almost the same as remote.addTorrentByUrl
				remote.addTorrentByUrl($('#torrent_upload_url').val(), {
					paused : paused,
					'destination' : destination
				});
			}
		}
	},

	promptSetLocation: function(confirmed, torrents) {
		if (! confirmed) {
			var path;
			if (torrents.length === 1) {
				path = torrents[0].getDownloadDir();
			} else {
				path = $("#download-dir").val();
			}
			$('input#torrent_path').attr('value', path);
			$('#move_container').show();
			// Vuze: some browsers don't scroll up to the dialog, so manually scroll
			$(document).scrollTop($('#move_container').offset());
			$('#torrent_path').focus();
		} else {
			var ids = this.getTorrentIds(torrents);
			this.remote.moveTorrents(
				ids, 
				$("input#torrent_path").val(), 
				this.refreshTorrents, 
				this);
			$('#move_container').hide();
		}
	},

	moveSelectedTorrents: function(confirmed) {
		var torrents = this.getSelectedTorrents();
		if (torrents.length)
			this.promptSetLocation(confirmed, torrents);
	},

	removeSelectedTorrents: function() {
		var torrents = this.getSelectedTorrents();
		if (torrents.length)
			this.promptToRemoveTorrents(torrents);
	},

	removeSelectedTorrentsAndData: function() {
		var torrents = this.getSelectedTorrents();
		if (torrents.length)
			this.promptToRemoveTorrentsAndData(torrents);
	},

	promptToRemoveTorrents: function(torrents) {
		if (torrents.length === 1)
		{
			var torrent = torrents[0],
			    header = 'Remove ' + torrent.getName() + '?',
			    message = 'Once removed, continuing the transfer will require the torrent file. Are you sure you want to remove it?';
			dialog.confirm(header, message, 'Remove', 'transmission.removeTorrents', torrents);
		}
		else
		{
			var header = 'Remove ' + torrents.length + ' transfers?',
			    message = 'Once removed, continuing the transfers will require the torrent files. Are you sure you want to remove them?';
			dialog.confirm(header, message, 'Remove', 'transmission.removeTorrents', torrents);
		}
	},

	promptToRemoveTorrentsAndData:function(torrents)
	{
		if (torrents.length === 1)
		{
			if (vz.showConfirmDeleteDialog(torrents[0])) {
				return;
			}
			var torrent = torrents[0],
			    header = 'Remove ' + torrent.getName() + ' and delete data?',
			    message = 'All data downloaded for this torrent will be deleted. Are you sure you want to remove it?';
			dialog.confirm(header, message, 'Remove', 'transmission.removeTorrentsAndData', torrents);
		}
		else
		{
			var header = 'Remove ' + torrents.length + ' transfers and delete data?',
			    message = 'All data downloaded for these torrents will be deleted. Are you sure you want to remove them?';
			dialog.confirm(header, message, 'Remove', 'transmission.removeTorrentsAndData', torrents);
		}
	},

	removeTorrents: function(torrents) {
		var ids = this.getTorrentIds(torrents);
		this.remote.removeTorrents(ids, this.refreshTorrents, this);
	},

	removeTorrentsAndData: function(torrents) {
		this.remote.removeTorrentsAndData(torrents);
	},

	verifySelectedTorrents: function() {
		this.verifyTorrents(this.getSelectedTorrents());
	},

	reannounceSelectedTorrents: function() {
		this.reannounceTorrents(this.getSelectedTorrents());
	},

	startAllTorrents: function(force) {
		this.startTorrents(this.getAllTorrents(), force);
	},
	startSelectedTorrents: function(force) {
		this.startTorrents(this.getSelectedTorrents(), force);
	},
	startTorrent: function(torrent) {
		this.startTorrents([ torrent ], false);
	},

	startTorrents: function(torrents, force) {
		this.remote.startTorrents(this.getTorrentIds(torrents), force,
		                          this.refreshTorrents, this);
	},
	verifyTorrent: function(torrent) {
		this.verifyTorrents([ torrent ]);
	},
	verifyTorrents: function(torrents) {
		this.remote.verifyTorrents(this.getTorrentIds(torrents),
		                           this.refreshTorrents, this);
	},

	reannounceTorrent: function(torrent) {
		this.reannounceTorrents([ torrent ]);
	},
	reannounceTorrents: function(torrents) {
		this.remote.reannounceTorrents(this.getTorrentIds(torrents),
		                               this.refreshTorrents, this);
	},

	stopAllTorrents: function() {
		this.stopTorrents(this.getAllTorrents());
	},
	stopSelectedTorrents: function() {
		this.stopTorrents(this.getSelectedTorrents());
	},
	stopTorrent: function(torrent) {
		this.stopTorrents([ torrent ]);
	},
	stopTorrents: function(torrents) {
		this.remote.stopTorrents(this.getTorrentIds(torrents),
		                         this.refreshTorrents, this);
	},
	changeFileCommand: function(torrentId, rowIndices, command) {
		this.remote.changeFileCommand(torrentId, rowIndices, command);
	},

	hideMobileAddressbar: function(delaySecs) {
		if (isMobileDevice && !scroll_timeout) {
			var callback = $.proxy(this.doToolbarHide,this),
			    msec = delaySecs*1000 || 150;
			scroll_timeout = setTimeout(callback,msec);
		}
	},
	doToolbarHide: function() {
		window.scrollTo(0,1);
		scroll_timeout=null;
	},

	// Queue
	moveTop: function() {
		this.remote.moveTorrentsToTop(this.getSelectedTorrentIds(),
		                              this.refreshTorrents, this);
	},
	moveUp: function() {
		this.remote.moveTorrentsUp(this.getSelectedTorrentIds(),
		                           this.refreshTorrents, this);
	},
	moveDown: function() {
		this.remote.moveTorrentsDown(this.getSelectedTorrentIds(),
		                             this.refreshTorrents, this);
	},
	moveBottom: function() {
		this.remote.moveTorrentsToBottom(this.getSelectedTorrentIds(),
		                                 this.refreshTorrents, this);
	},

	/***
	****
	***/

	updateGuiFromSession: function(o)
	{
		var limit, limited, e, b, text,
                    fmt = Transmission.fmt,
                    menu = $('#settings_menu');

		if ("version" in o) {
			this.serverVersion = o.version;
		}

		this.prefsDialog.set(o);

		/* Vuze : No Turtle Button 
		if (RPC._TurtleState in o)
		{
			b = o[RPC._TurtleState];
			e = $('#turtle-button');
			text = [ 'Click to ', (b?'disable':'enable'),
			         ' Temporary Speed Limits (',
			         fmt.speed(o[RPC._TurtleUpSpeedLimit]),
			         ' up,',
			         fmt.speed(o[RPC._TurtleDownSpeedLimit]),
			         ' down)' ].join('');
			e.toggleClass('selected', b);
			e.attr('title', text);
		}
		*/

		if (this.isMenuEnabled && (RPC._DownSpeedLimited in o)
		                       && (RPC._DownSpeedLimit in o))
		{
			limit = o[RPC._DownSpeedLimit];
			limited = o[RPC._DownSpeedLimited];

			e = menu.find('#limited_download_rate > a');
                        e.html('Limit (' + fmt.speed(limit) + ')');

                        if (!limited)
                        	e = menu.find('#unlimited_download_rate');
                        else
                        	e = e.parent();
                        /* Vuze: Not sure what deselectMenuSiblings does
                        e.deselectMenuSiblings().selectMenuItem();
                        */
        				e.addClass('menu-item-selected');
		}

		if (this.isMenuEnabled && (RPC._UpSpeedLimited in o)
		                       && (RPC._UpSpeedLimit in o))
		{
			limit = o[RPC._UpSpeedLimit];
			limited = o[RPC._UpSpeedLimited];

			e = menu.find('#limited_upload_rate > a');
                        e.html('Limit (' + fmt.speed(limit) + ')');

                        if (!limited)
                        	e = menu.find('#unlimited_upload_rate');
                        else
                        	e = e.parent();
                        /* Vuze: Not sure what deselectMenuSiblings does
                        e.deselectMenuSiblings().selectMenuItem();
                        */
        				e.addClass('menu-item-selected');
		}
		
		vz.updatePrefs(o);
	},

	updateStatusbar: function()
	{
		var u=0, d=0,
		    i, row,
		    haveActive = false,
		    havePaused = false,
		    fmt = Transmission.fmt,
		    torrents = this.getAllTorrents();

		// up/down speed
		for (i=0; row=torrents[i]; ++i) {
			u += row.getUploadSpeed();
			d += row.getDownloadSpeed();
			var isStopped = row.isStopped();
			if (!isStopped) haveActive = true;
			if (isStopped) havePaused = true;
		}

		$('#speed-up-container').toggleClass('active', u>0 );
		$('#speed-up-label').text( fmt.speedBps( u ) );

		$('#speed-dn-container').toggleClass('active', d>0 );
		$('#speed-dn-label').text( fmt.speedBps( d ) );

		// visible torrents
		$('#filter-count').text( fmt.countString('Transfer','Transfers',this._rows.length ) );

		vz.updateSpeed(d, u);
		vz.updateTorrentCount(this._rows.length);
		vz.updateTorrentStates(haveActive, havePaused);
	},

	setEnabled: function(key, flag)
	{
		$(key).toggleClass('disabled', !flag);
	},

	updateFilterSelect: function()
	{
		var i, names, name, str, o,
		    e = $('#filter-tracker'),
		    trackers = this.getTrackers();

		// build a sorted list of names
		names = [];
		for (name in trackers)
			names.push (name);
		names.sort();

		// build the new html
		if (!this.filterTracker)
			str = '<option value="all" selected="selected">All</option>';
		else
			str = '<option value="all">All</option>';
		for (i=0; name=names[i]; ++i) {
			o = trackers[name];
			str += '<option value="' + o.domain + '"';
			if (trackers[name].domain === this.filterTracker) str += ' selected="selected"';
			str += '>' + name + '</option>';
		}

		if (!this.filterTrackersStr || (this.filterTrackersStr !== str)) {
			this.filterTrackersStr = str;
			$('#filter-tracker').html(str);
		}
	},

	updateButtonsSoon: function()
	{
		if (!this.buttonRefreshTimer)
		{
			var callback = $.proxy(this.updateButtonStates,this),
			    msec = 100;
			this.buttonRefreshTimer = setTimeout(callback, msec);
		}
	},

	updateButtonStates: function()
	{
		var e = this.elements,
		    haveSel = false,
		    haveActiveSel = false,
		    havePausedSel = false,
		    selectedTorrents = [];

		clearTimeout(this.buttonRefreshTimer);
		delete this.buttonRefreshTimer;

		for (var i=0, row; row=this._rows[i]; ++i) {
			var isStopped = row.getTorrent().isStopped();
			var isSelected = row.isSelected();
			if (isSelected) {
				haveSel = true;
				selectedTorrents[selectedTorrents.length] = row.getTorrent().fields;
			}
			if (isSelected && !isStopped) haveActiveSel = true;
			if (isSelected && isStopped) havePausedSel = true;
		}
		
		// >> Vuze: callback
		vz.selectionChanged(selectedTorrents, haveActiveSel, havePausedSel);
		// << Vuze


		this.setEnabled(e.toolbar_pause_button,  haveActiveSel);
		this.setEnabled(e.toolbar_start_button,  havePausedSel);
		this.setEnabled(e.toolbar_remove_button, haveSel);
	},

	/****
	*****
	*****  INSPECTOR
	*****
	****/

	inspectorIsVisible: function()
	{
		return $('#torrent_inspector').is(':visible');
	},
	toggleInspector: function(ev)
	{
	    var row = ev.currentTarget.row;

	    if (this.inspectorIsVisible()) {
			var torrents = this.inspector.getTorrents();
			if (torrents.length == 0 || torrents[0].getId() == row.getTorrentId()) {
				this.setInspectorVisible(false);
		    	return;
			}
	    }
	    
		this.inspector.setTorrents([ row.getTorrent() ]);
    	this.setInspectorVisible(true);
	},
	setInspectorVisible: function(visible)
	{
		if (!visible) {
			$('#torrent_inspector').toggle(visible);
			this.inspector.setTorrents([ ]);
			// Move to body since row might disappear
			$("#torrent_inspector").appendTo($('body'));
			return;
		}
		$('#torrent_inspector').toggle(!visible);
		var torrents = this.inspector.getTorrents();
		if (torrents.length == 0) {
			return;
		}
		var row = this.getRowFromTorrent(torrents[0]);
		var rowElement = row.getElement();
		
		$("#torrent_inspector").appendTo(rowElement);
		$('#torrent_inspector').toggle(visible);
		$('#toolbar-inspector').toggleClass('selected',visible);
		/* Vuze: Removed for inline inspector! 
		if ($('#inspector-close').css('display') === "block") {
			if (visible)
				this.inspector.setTorrents(this.getSelectedTorrents());
	
			// update the ui widgetry
			$('#torrent_inspector').toggle(visible);
			$('#toolbar-inspector').toggleClass('selected',visible);
			this.hideMobileAddressbar();
			if (isMobileDevice) {
				$('body').toggleClass('inspector_showing',visible);
			} else {
				var y = $('body').scrollTop() + 82;
				$('#torrent_inspector').css('padding-top', y + 'px');

				// >> Vuze: Not needed now that layout isn't a scrollable div
				var w = visible ? $('#torrent_inspector').outerWidth() + 1 + 'px' : '0px';
				$('#torrent_container')[0].style.right = w;
				// << Vuze
			}
		} else {
			$('#torrent_inspector').dialog({'title': 'Torrent Inspector'});
		}
		*/
	},

	/****
	*****
	*****  FILTER
	*****
	****/

	refilterSoon: function()
	{
		if (!this.refilterTimer) {
			var tr = this,
			    callback = function(){tr.refilter(false);},
			    msec = 100;
			this.refilterTimer = setTimeout(callback, msec);
		}
	},

	sortRows: function(rows)
	{
		var i, tor, row,
		    id2row = {},
		    torrents = [];

		for (i=0; row=rows[i]; ++i) {
			tor = row.getTorrent();
			torrents.push(tor);
			id2row[ tor.getId() ] = row;
		}

		Torrent.sortTorrents(torrents, this[Prefs._SortMethod],
		                               this[Prefs._SortDirection]);

		for (i=0; tor=torrents[i]; ++i)
			rows[i] = id2row[ tor.getId() ];
	},

	refilter: function(rebuildEverything)
	{
		var i, e, id, t, row, tmp, rows, clean_rows, dirty_rows, frag,
		    sort_mode = this[Prefs._SortMethod],
		    sort_direction = this[Prefs._SortDirection],
		    filter_mode = this[Prefs._FilterMode],
		    filter_text = this.filterText,
		    filter_tracker = this.filterTracker,
		    renderer = this.torrentRenderer,
		    list = this.elements.torrent_list,
		    old_sel_count = $(list).children('.selected').length;

		this.updateFilterSelect();
		
		clearTimeout(this.refilterTimer);
		delete this.refilterTimer;

		if (rebuildEverything) {
			// Vuze: set inspector invisible so it moves outside of the row (and thus doesn't get deleted)
			this.setInspectorVisible(false);

			$(list).empty();
			this._rows = [];
			for (id in this._torrents)
				this.dirtyTorrents[id] = true;
		}

		// rows that overlap with dirtyTorrents need to be refiltered.
		// those that don't are 'clean' and don't need refiltering.
		clean_rows = [];
		dirty_rows = [];
		for (i=0; row=this._rows[i]; ++i) {
			if(row.getTorrentId() in this.dirtyTorrents)
				dirty_rows.push(row);
			else
				clean_rows.push(row);
		}

		// remove the dirty rows from the dom
		e = [];
		for (i=0; row=dirty_rows[i]; ++i)
			e.push (row.getElement());
		$(e).detach();

		// drop any dirty rows that don't pass the filter test
		tmp = [];
		for (i=0; row=dirty_rows[i]; ++i) {
			id = row.getTorrentId();
			t = this._torrents[ id ];
			if (t && t.test(filter_mode, filter_text, filter_tracker))
				tmp.push(row);
			delete this.dirtyTorrents[id];
		}
		dirty_rows = tmp;

		// make new rows for dirty torrents that pass the filter test
		// but don't already have a row
		for (id in this.dirtyTorrents) {
			t = this._torrents[id];
			if (t && t.test(filter_mode, filter_text, filter_tracker)) {
				row = new TorrentRow(renderer, this, t);
				e = row.getElement();
				e.row = row;
				dirty_rows.push(row);
				$(e).click($.proxy(this.onRowClicked,this));
				$(e).dblclick($.proxy(this.toggleInspector,this));

				// Vuze: add tap, as it doesn't have a 300ms delay on mobiles
				$(e).bind('tap', $.proxy(this.onRowClicked,this));
				// Vuze: tap is 'fuzzy' and seems to prefer the element it binds on,
				// Bind directly on torrent_info button, otherwise it's really
				// hard to tap the button.
				ti = $(e).find(".torrent_info");
				if (ti.length > 0) {
					ti[0].row = row;
					ti.bind('tap', $.proxy(this.onRowClicked,this));
				}
			}
		}

		// sort the dirty rows
		this.sortRows (dirty_rows);

		// now we have two sorted arrays of rows
		// and can do a simple two-way sorted merge.
		rows = [];
		var ci=0, cmax=clean_rows.length;
		var di=0, dmax=dirty_rows.length;
		frag = document.createDocumentFragment();
		while (ci!=cmax || di!=dmax)
		{
			var push_clean;

			if (ci==cmax)
				push_clean = false;
			else if (di==dmax)
				push_clean = true;
			else {
				var c = Torrent.compareTorrents(
				           clean_rows[ci].getTorrent(),
				           dirty_rows[di].getTorrent(),
				           sort_mode, sort_direction);
				push_clean = (c < 0);
			}

			if (push_clean)
				rows.push(clean_rows[ci++]);
			else {
				row = dirty_rows[di++];
				e = row.getElement();
				if (ci !== cmax)
					list.insertBefore(e, clean_rows[ci].getElement());
				else
					frag.appendChild(e);
				rows.push(row);
			}
		}
		list.appendChild(frag);

		// update our implementation fields
		this._rows = rows;
		this.dirtyTorrents = {};

		// jquery's even/odd starts with 1 not 0, so invert its logic
		e = []
		for (i=0; row=rows[i]; ++i)
			e.push(row.getElement());
		$(e).filter(":odd").addClass('even'); 
		$(e).filter(":even").removeClass('even'); 

		// sync gui
		this.updateStatusbar();
		if (old_sel_count !== $(list).children('.selected').length)
			this.selectionChanged();
	},

	setFilterMode: function(mode)
	{
		// set the state
		this.setPref(Prefs._FilterMode, mode);

		// >> Vuze: Make sure filter mode widgeth has correct value
		$('#filter-mode').val(this[Prefs._FilterMode]);
		// << Vuze

		// refilter
		this.refilter(true);
	},

	onFilterModeClicked: function(ev)
	{
		this.setFilterMode($('#filter-mode').val());
	},

	onFilterTrackerClicked: function(ev)
	{
		var tracker = $('#filter-tracker').val();
		this.setFilterTracker(tracker==='all' ? null : tracker);
	},

	setFilterTracker: function(domain)
	{
		// update which tracker is selected in the popup
		var key = domain ? this.getReadableDomain(domain) : 'all',
		    id = '#show-tracker-' + key;
		$(id).addClass('selected').siblings().removeClass('selected');

		this.filterTracker = domain;
		this.refilter(true);
	},

	// example: "tracker.ubuntu.com" returns "ubuntu.com"
	getDomainName: function(host)
	{
		var dot = host.indexOf('.');
		if (dot !== host.lastIndexOf('.'))
			host = host.slice(dot+1);
		return host;
	},

	// example: "ubuntu.com" returns "Ubuntu"
	getReadableDomain: function(name)
	{
		if (name.length)
			name = name.charAt(0).toUpperCase() + name.slice(1);
		var dot = name.indexOf('.');
		if (dot !== -1)
			name = name.slice(0, dot);
		return name;
	},

	getTrackers: function()
	{
		var ret = {};

		var torrents = this.getAllTorrents();
		for (var i=0, torrent; torrent=torrents[i]; ++i)
		{
			var names = [];
			var trackers = torrent.getTrackers();
			for (var j=0, tracker; tracker=trackers[j]; ++j)
			{
				var uri, announce = tracker.announce;

				if (announce in this.uriCache)
					uri = this.uriCache[announce];
				else {
					uri = this.uriCache[announce] = parseUri (announce);
					uri.domain = this.getDomainName (uri.host);
					uri.name = this.getReadableDomain (uri.domain);
				}

				if (!(uri.name in ret))
					ret[uri.name] = { 'uri': uri,
					                  'domain': uri.domain,
					                  'count': 0 };

				if (names.indexOf(uri.name) === -1)
					names.push(uri.name);
			}
			for (var j=0, name; name=names[j]; ++j)
				ret[name].count++;
		}

		return ret;
	},

	/***
	****
	****  Compact Mode
	****
	***/

	toggleCompactClicked: function()
	{
		this.setCompactMode(!this[Prefs._CompactDisplayState]);
	},
	setCompactMode: function(is_compact)
	{
		var key = Prefs._CompactDisplayState,
		    was_compact = this[key];

		if (was_compact !== is_compact) {
			this.setPref(key, is_compact);
			this.onCompactModeChanged();
		}
	},
	initCompactMode: function()
	{
		this.onCompactModeChanged();
	},
	onCompactModeChanged: function()
	{
		var compact = this[Prefs._CompactDisplayState];

		// update the ui: context menu
		// (disabled in iphone mode...)
		if (!isMobileDevice) {
			var e = $('#compact_view');
			if (compact)
				e.addClass('menu-item-selected');
			/* Vuze: Replaced
				e.selectMenuItem();
			*/
			else
				e.removeClass('menu-item-selected');
			/* Vuze: Replaced
				e.deselectMenuItem();
			*/
		}

		// update the ui: footer button
		$("#compact-button").toggleClass('selected',compact);

		// update the ui: torrent list
		this.torrentRenderer = compact ? new TorrentRendererCompact()
		                               : new TorrentRendererFull();
		this.refilter(true);
	},

	/***
	****
	****  Statistics
	****
	***/

	// turn the periodic ajax stats refresh on & off
	togglePeriodicStatsRefresh: function(enabled) {
		clearInterval(this.statsInterval);
		delete this.statsInterval;
		if (enabled) {
			var callback = $.proxy(this.loadDaemonStats,this),
                            msec = 5000;
			this.statsInterval = setInterval(callback, msec);
		}
	},

	loadDaemonStats: function(async) {
		this.remote.loadDaemonStats(function(data) {
			this.updateStats(data['arguments']);
		}, this, async);
	},

	// Process new session stats from the server
	updateStats: function(stats)
	{
		var s, ratio,
		    fmt = Transmission.fmt;

		s = stats["current-stats"];
		ratio = Math.ratio(s.uploadedBytes,s.downloadedBytes);
		$('#stats-session-uploaded').html(fmt.size(s.uploadedBytes));
		$('#stats-session-downloaded').html(fmt.size(s.downloadedBytes));
		$('#stats-session-ratio').html(fmt.ratioString(ratio));
		$('#stats-session-duration').html(fmt.timeInterval(s.secondsActive));

		s = stats["cumulative-stats"];
		ratio = Math.ratio(s.uploadedBytes,s.downloadedBytes);
		$('#stats-total-count').html(s.sessionCount + " times");
		$('#stats-total-uploaded').html(fmt.size(s.uploadedBytes));
		$('#stats-total-downloaded').html(fmt.size(s.downloadedBytes));
		$('#stats-total-ratio').html(fmt.ratioString(ratio));
		$('#stats-total-duration').html(fmt.timeInterval(s.secondsActive));
	},


	showStatsDialog: function() {
		this.loadDaemonStats();
		this.hideMobileAddressbar();
		this.togglePeriodicStatsRefresh(true);
		$('#stats-dialog').dialog({
			close: $.proxy(this.onStatsDialogClosed,this),
			show: 'fade',
			hide: 'fade',
			title: 'Statistics'
		});
	},

	onStatsDialogClosed: function() {
		this.hideMobileAddressbar();
		this.togglePeriodicStatsRefresh(false);
	}
};
