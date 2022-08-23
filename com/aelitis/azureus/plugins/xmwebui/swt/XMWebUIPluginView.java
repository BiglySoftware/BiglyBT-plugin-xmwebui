/*
 * Created on Mar 19, 2008
 * Created by Paul Gardner
 * 
 * Copyright 2008 Vuze, Inc.  All rights reserved.
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details ( see the LICENSE file ).
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */


package com.aelitis.azureus.plugins.xmwebui.swt;


import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.aelitis.azureus.plugins.xmwebui.TransmissionVars;
import com.biglybt.ui.swt.ListenerGetOffSWT;
import com.biglybt.util.MapUtils;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.StyleRange;
import org.eclipse.swt.custom.StyledText;
import org.eclipse.swt.events.KeyEvent;
import org.eclipse.swt.events.KeyListener;
import org.eclipse.swt.events.SelectionAdapter;
import org.eclipse.swt.events.SelectionEvent;
import org.eclipse.swt.graphics.Color;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Combo;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Event;
import org.eclipse.swt.widgets.Group;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Listener;
import org.eclipse.swt.widgets.Text;
import com.biglybt.core.config.COConfigurationManager;
import com.biglybt.core.config.impl.ConfigurationManager;
import com.biglybt.core.internat.MessageText;
import com.biglybt.core.util.AEThread2;
import com.biglybt.core.util.Base32;
import com.biglybt.core.util.Debug;
import com.biglybt.core.util.RandomUtils;
import com.biglybt.pif.ui.UIInstance;
import com.biglybt.ui.swt.Messages;
import com.biglybt.ui.swt.Utils;
import com.biglybt.ui.swt.components.LinkLabel;
import com.biglybt.ui.swt.mainwindow.Colors;
import com.biglybt.ui.swt.pif.UISWTInstance;
import com.biglybt.ui.swt.pif.UISWTViewEvent;
import com.biglybt.ui.swt.pif.UISWTViewEventListener;
import org.json.simple.JSONObject;

import com.aelitis.azureus.plugins.xmwebui.XMWebUIPlugin;
import com.aelitis.azureus.plugins.xmwebui.client.connect.XMClientAccount;
import com.aelitis.azureus.plugins.xmwebui.client.connect.XMClientConnection;
import com.aelitis.azureus.plugins.xmwebui.client.connect.XMClientConnectionAdapter;
import com.aelitis.azureus.plugins.xmwebui.client.rpc.XMRPCClientException;


public class
XMWebUIPluginView
	implements UISWTViewEventListener
{
	private final String CONFIG_PARAM_OLD = "xmwebui.remote.vuze.config";
	private final String CONFIG_PARAM_NEW = "xmwebui.remote.vuze.config.privx";	// not dumped in generated evidence
	
	private static final int LOG_NORMAL 	= 1;
	private static final int LOG_SUCCESS 	= 2;
	private static final int LOG_ERROR 		= 3;

	private static final String	CS_DISCONNECTED		= "Disconnected";
	private static final String	CS_BASIC			= "Basic";
	private static final String	CS_SECURE_DIRECT	= "Secure (Direct)";
	private static final String	CS_SECURE_PROXIED	= "Secure (Proxied)";
	

	private XMWebUIPlugin		plugin;
	private UISWTInstance		ui_instance;
	
	private Map<String,AccountConfig>		account_config 		= new HashMap<String,AccountConfig>();
	
	private Map<String,RemoteConnection>	remote_connections 	= new HashMap<String, RemoteConnection>();
	
	private ViewInstance	current_instance;
			
	public
	XMWebUIPluginView(
		XMWebUIPlugin		_plugin,
		UIInstance			_ui_instance )
	{
		plugin			= _plugin;
		ui_instance		= (UISWTInstance)_ui_instance;

		loadConfig();
		
		ui_instance.addView( UISWTInstance.VIEW_MAIN, "xmwebui", this );
	}
	
	private void 
	loadConfig()
	{
		if ( ConfigurationManager.getInstance().doesParameterNonDefaultExist( CONFIG_PARAM_OLD )){
			
			Map config = COConfigurationManager.getMapParameter( CONFIG_PARAM_OLD, new HashMap());
			
			COConfigurationManager.setParameter( CONFIG_PARAM_NEW, config );
			
			COConfigurationManager.removeParameter( CONFIG_PARAM_OLD );
		}
		
		Map config = COConfigurationManager.getMapParameter( CONFIG_PARAM_NEW, new HashMap());
		
		List<Map>	acs = (List<Map>)config.get( "acs" );
		
		if ( acs != null ){
			
			for ( Map m: acs ){
				
				try{
					AccountConfig ac = new AccountConfig( m );
					
					account_config.put( ac.getAccessCode(), ac );
					
				}catch( Throwable e ){
					
					Debug.out( e );
				}
			}
		}
	}
	
	private void
	saveConfig()
	{
		Map	config = new HashMap();
		
		List<Map>	list = new ArrayList<Map>();
		
		config.put( "acs", list );
		
		for ( AccountConfig ac: account_config.values()){
			
			try{
				list.add( ac.export());
				
			}catch( Throwable e ){
				
				Debug.out( e );
			}
		}
		
		COConfigurationManager.setParameter( CONFIG_PARAM_NEW,config );
		
		COConfigurationManager.save();
	}
	
	@Override
	public boolean
	eventOccurred(
		UISWTViewEvent event )
	{
		switch( event.getType() ){

			case UISWTViewEvent.TYPE_CREATE:{
				
				if ( current_instance != null ){
					
					return( false );
				}
								
				break;
			}
			case UISWTViewEvent.TYPE_INITIALIZE:{
				

				current_instance = new ViewInstance((Composite)event.getData());
				
				break;
			}
			case UISWTViewEvent.TYPE_DESTROY:{
				
				try{
					if ( current_instance != null ){
						
						current_instance.destroy();
					}
				}finally{
					
					current_instance = null;
				}
				
				break;
			}
		}
		
		return true;
	}
	
	private void
	setConnected(
		RemoteConnection		connection,
		boolean					is_connected )
	{
		if ( !is_connected ){
			
			synchronized( remote_connections ){
				
				remote_connections.remove( connection.getAccessCode());
			}
		}
			
		if ( current_instance != null ){
				
			current_instance.updateRemoteConnection( connection, is_connected );
		}
	}
	
	private void
	log(
		String	str )
	{
		if ( current_instance != null ){
			
			current_instance.print( str );
		}
	}
	
	private void
	logError(
		Throwable e )
	{
		if ( current_instance != null ){
			
			current_instance.print( Debug.getNestedExceptionMessage( e ), LOG_ERROR, false );
		}
	}
	
	private void
	logError(
		String	str )
	{
		if ( current_instance != null ){
			
			current_instance.print( str, LOG_ERROR, false );
		}
	}
	
	private class
	ViewInstance
	{		
		private Composite 	composite;
		private Combo 		ac_list;
		private Button		connect_button;
		private Button		remove_button;
		
		private AccountConfig	current_account;
		
		private Group 			options_group;
		private Text			description;
		private Button 			do_basic;
		private Button			do_basic_def;
		private Text			basic_username;
		private Text			basic_password;
		
		private Button			force_proxy;
		private Text			secure_password;
		
		private Group 			operation_group;
		private Label			status_label;
		
		private StyledText 	log ;
		
		private boolean	initialised;
		
		private
		ViewInstance(
			Composite	_comp )
		{
			composite	= _comp;
			
			Composite main = new Composite(composite, SWT.NONE);
			GridLayout layout = new GridLayout();
			layout.numColumns = 4;

			main.setLayout(layout);
			GridData grid_data = new GridData(GridData.FILL_BOTH );
			main.setLayoutData(grid_data);

			Label info_label = new Label( main, SWT.NULL );
			grid_data = new GridData();
			grid_data.horizontalSpan = 3;
			info_label.setLayoutData( grid_data );
			Messages.setLanguageText( info_label, "xmwebui.rpc.info" );
			
			new LinkLabel( main, "xmwebui.link", MessageText.getString(  "xmwebui.control.wiki.link" ));
			
			Label add_label = new Label( main, SWT.NULL );
			Messages.setLanguageText( add_label, "xmwebui.rpc.add.info" );
			
			final Text	ac_text = new Text( main, SWT.BORDER );
						
			final Button 	add_button = new Button( main, SWT.PUSH );
			Messages.setLanguageText( add_button, "xmwebui.rpc.add" );

			add_button.setEnabled( false );

			add_button.addSelectionListener(
					new SelectionAdapter()
					{
						@Override
						public void
						widgetSelected(
							SelectionEvent e ) 
						{
							String ac = ac_text.getText().trim();
						
							if ( !account_config.containsKey( ac )){
						
								AccountConfig conf = new AccountConfig( ac );
								
								account_config.put( ac, conf );
								
								saveConfig();
								
								updateAccountList();
								
								setSelectedAccount( conf );
							}
						}
					});
			
			ac_text.addListener(SWT.Modify, new Listener() {
			      @Override
			      public void handleEvent(Event event) {
			    	  add_button.setEnabled( ac_text.getText().trim().length() > 0 );
			      }
			    });
			
			new Label( main, SWT.NULL );
			
			Label sel_label = new Label( main, SWT.NULL );
			Messages.setLanguageText( sel_label, "xmwebui.rpc.select" );
			
			ac_list = new Combo( main, SWT.SINGLE | SWT.READ_ONLY );
						
			connect_button = new Button( main, SWT.PUSH );
			Messages.setLanguageText( connect_button, "xmwebui.rpc.connect" );
		
			connect_button.addSelectionListener(
				new SelectionAdapter()
				{
					@Override
					public void
					widgetSelected(
						SelectionEvent e ) 
					{
						int index = ac_list.getSelectionIndex();
						
						String ac = ac_list.getItem( index );
						
						ac = trimAccount( ac );
						
						synchronized( remote_connections ){
							
							RemoteConnection rc = remote_connections.get( ac );
							
							if ( rc == null ){
								
								rc = new RemoteConnection( account_config.get( ac ));
								
								remote_connections.put( ac, rc );
								
								final RemoteConnection f_rc = rc;
								
								new AEThread2("")
								{
									@Override
									public void
									run()
									{
										f_rc.connect();
									}
								}.start();
								
							}else{
								
								print( ac + " is already connecting/connected" );
							}
						}
					}
				});
			
			connect_button.setEnabled( false );
			
			remove_button = new Button( main, SWT.PUSH );
			Messages.setLanguageText( remove_button, "xmwebui.rpc.remove" );

			remove_button.addSelectionListener(
					new SelectionAdapter()
					{
						@Override
						public void
						widgetSelected(
							SelectionEvent e ) 
						{
							int index = ac_list.getSelectionIndex();
							
							if ( index != -1 ){
								
								String ac = ac_list.getItem( index );

								ac = trimAccount( ac );
								
								AccountConfig ac_config = account_config.remove( ac );
								
								if ( ac_config != null ){
									
									RemoteConnection rc = remote_connections.get( ac );

									if ( rc != null ){
										
										rc.destroy();
									}
									
									updateAccountList();
									
									saveConfig();
								}
							}
						}
					});
			
			options_group = new Group( main, SWT.NULL );
			Messages.setLanguageText( options_group, "xmwebui.rpc.options" );
			layout = new GridLayout();
			layout.numColumns = 6;

			options_group.setLayout(layout);
			grid_data = new GridData(GridData.FILL_HORIZONTAL);
			grid_data.horizontalSpan = 4;
			options_group.setLayoutData(grid_data);

			Label label = new Label( options_group, SWT.NULL );
			Messages.setLanguageText( label, "xmwebui.rpc.options.desc" );

			description = new Text( options_group, SWT.BORDER );
			description.addListener(
				SWT.FocusOut, 
				new Listener() 
				{
			        @Override
			        public void handleEvent(Event event) {
			        	if ( current_account != null ){
							
							current_account.setDescription( description.getText());
							
							updateAccountList();
							
							saveConfig();
						}
			        }
			    });
			
			label = new Label( options_group, SWT.NULL );
			grid_data = new GridData(GridData.FILL_HORIZONTAL);
			grid_data.horizontalSpan = 4;
			label.setLayoutData(grid_data);
			
			do_basic = new Button( options_group, SWT.CHECK );
			Messages.setLanguageText( do_basic, "xmwebui.rpc.options.enable.basic" );
			
			do_basic.addSelectionListener(
				new SelectionAdapter()
				{
					@Override
					public void
					widgetSelected(
						SelectionEvent e ) 
					{
						if ( current_account != null ){
							
							current_account.setBasicEnabled( do_basic.getSelection());
							
							updateSelectedAccount( current_account );
							
							saveConfig();
						}
					}
				});
			
			do_basic_def = new Button( options_group, SWT.CHECK );
			Messages.setLanguageText( do_basic_def, "xmwebui.rpc.options.basic.def.auth" );

			do_basic_def.addSelectionListener(
				new SelectionAdapter()
				{
					@Override
					public void
					widgetSelected(
						SelectionEvent e ) 
					{
						if ( current_account != null ){
							
							current_account.setBasicDefaults( do_basic_def.getSelection());
							
							updateSelectedAccount( current_account );
							
							saveConfig();
						}
					}
				});
			
			label = new Label( options_group, SWT.NULL );
			grid_data = new GridData();
			grid_data.horizontalIndent = 20;
			label.setLayoutData( grid_data );
			Messages.setLanguageText( label, "xmwebui.rpc.options.user" );

			
			basic_username = new Text( options_group, SWT.BORDER );
			
			basic_username.addListener(
				SWT.FocusOut, 
				new Listener() 
				{
			        @Override
			        public void handleEvent(Event event) {
			        	if ( current_account != null ){
							
							current_account.setBasicUser( basic_username.getText());
							
							updateSelectedAccount( current_account );
							
							saveConfig();
						}
			        }
			    });
			
			
			label = new Label( options_group, SWT.NULL );
			Messages.setLanguageText( label, "xmwebui.rpc.options.pw" );

			
			basic_password = new Text( options_group, SWT.BORDER );
			basic_password.setEchoChar( '*' );
			basic_password.addListener(
				SWT.FocusOut, 
				new Listener() 
				{
			        @Override
			        public void handleEvent(Event event) {
			        	if ( current_account != null ){
							
							current_account.setBasicPassword( basic_password.getText());
							
							updateSelectedAccount( current_account );
							
							saveConfig();
						}
			        }
			    });
				
			label = new Label( options_group, SWT.NULL );
			grid_data = new GridData();
			grid_data.horizontalSpan = 4;
			label.setLayoutData(grid_data);
			Messages.setLanguageText( label, "xmwebui.rpc.options.secure.pw" );
			
			force_proxy = new Button( options_group, SWT.CHECK );
			Messages.setLanguageText( force_proxy, "xmwebui.rpc.options.secure.force.proxy" );

			force_proxy.addSelectionListener(
				new SelectionAdapter()
				{
					@Override
					public void
					widgetSelected(
						SelectionEvent e ) 
					{
						if ( current_account != null ){
							
							current_account.setForceProxy( force_proxy.getSelection());
							
							updateSelectedAccount( current_account );
							
							saveConfig();
						}
					}
				});
			
			secure_password = new Text( options_group, SWT.BORDER );
			secure_password.setEchoChar( '*' );
			secure_password.addListener(
				SWT.FocusOut, 
				new Listener() 
				{
			        @Override
			        public void handleEvent(Event event) {
			        	if ( current_account != null ){
							
							current_account.setSecurePassword( secure_password.getText());
							
							updateSelectedAccount( current_account );
							
							saveConfig();
						}
			        }
			    });
			
			ac_list.addSelectionListener(
				new SelectionAdapter()
				{
					@Override
					public void
					widgetSelected(
						SelectionEvent e ) 
					{
						int index = ac_list.getSelectionIndex();
						
						
						if	( index == -1 ){
							
							setSelectedAccount( null );
							
						}else{
							
							String ac = ac_list.getItem( index );

							ac = trimAccount( ac );
							
							setSelectedAccount( account_config.get( ac ));
						}
					}
				});
			
				// operations
			
			operation_group = new Group( main, SWT.NULL );
			Messages.setLanguageText( operation_group, "xmwebui.rpc.operations" );
			layout = new GridLayout();
			layout.numColumns = 6;

			operation_group.setLayout(layout);
			grid_data = new GridData(GridData.FILL_HORIZONTAL);
			grid_data.horizontalSpan = 4;
			operation_group.setLayoutData(grid_data);
			
				// status
			
			status_label = new Label( operation_group, SWT.NULL );
			grid_data = new GridData(GridData.FILL_HORIZONTAL);
			grid_data.horizontalSpan = 6;
			status_label.setLayoutData(grid_data);
			Messages.setLanguageText( status_label, "xmwebui.rpc.constatus", new String[]{ CS_DISCONNECTED } );

			
				// launch ui
			
			Button launch_ui_button = new Button( operation_group, SWT.PUSH );
			Messages.setLanguageText( launch_ui_button, "xmwebui.rpc.launch.ui" );


			launch_ui_button.addSelectionListener(
					new SelectionAdapter()
					{
						@Override
						public void
						widgetSelected(
							SelectionEvent e ) 
						{
							RemoteConnection rc = getCurrentRemoteConnection();
							
							if ( rc != null ){
								
								URL url = rc.getProxyURL();
								
								Utils.launch( url.toExternalForm());
							}
						}
					});

				// status
			
			Button status_button = new Button( operation_group, SWT.PUSH );
			Messages.setLanguageText( status_button, "xmwebui.rpc.status" );


			status_button.addListener(SWT.Selection,
					(ListenerGetOffSWT) event -> {
						RemoteConnection rc = getCurrentRemoteConnection();
						
						if ( rc != null ){
							
							try{
								Map map = rc.getRPCStatus();
								
								log( map.toString());
								
							}catch( Throwable e ){
								
								logError( e );
							}
						}
					});
			
				// disconnect
			
			Button disconnect_button = new Button( operation_group, SWT.PUSH );
			Messages.setLanguageText( disconnect_button, "xmwebui.rpc.disconnect" );

			disconnect_button.addSelectionListener(
					new SelectionAdapter()
					{
						@Override
						public void
						widgetSelected(
							SelectionEvent e ) 
						{
							RemoteConnection rc = getCurrentRemoteConnection();
							
							if ( rc != null ){
								
								rc.destroy();
							}
						}
					});

			label = new Label( operation_group, SWT.NULL );
			grid_data = new GridData(GridData.FILL_HORIZONTAL);
			grid_data.horizontalSpan = 3;
			label.setLayoutData(grid_data);
			
				// command prompt
			
			label = new Label( operation_group, SWT.NULL );
			Messages.setLanguageText( label, "xmwebui.rpc.command" );

			final Text command = new Text( operation_group, SWT.BORDER );
			grid_data = new GridData(GridData.FILL_HORIZONTAL);
			grid_data.horizontalSpan = 4;
			command.setLayoutData(grid_data);
			
			command.addKeyListener(
				new KeyListener()
				{
					private List<String> history = new ArrayList<String>();
					
					private int	history_index = 0;
					
					@Override
					public void
					keyPressed(
						KeyEvent e )
					{
						int	code = e.keyCode;
						
						if ( code == SWT.ARROW_UP ){
						
							history_index--;
							
							if ( history_index < 0 ){
								
								history_index = 0;
							}
							
							if ( history_index < history.size()){
								
								String str =  history.get(history_index);
								
								command.setText( str );
								
								command.setSelection( str.length());
								
								e.doit = false;
							}
						}else if ( code == SWT.ARROW_DOWN ){
						
							history_index++;
							
							if ( history_index > history.size()){
								
								history_index = history.size();
							}
							
							if ( history_index < history.size()){
								
								command.setText( history.get(history_index));
								
								command.setSelection( command.getText().length());
								
								e.doit = false;
							}
						}
					}
					
					@Override
					public void
					keyReleased(
						KeyEvent e )
					{
						int	code = e.keyCode;
						
						if ( code == '\r' ){
						
							String str = command.getText().trim();
							
							command.setText( "" );
							
							if ( str.length() > 0 ){
								
								history.remove( str );
								
								history.add( str );
								
								if ( history.size() > 100 ){
									
									history.remove(0);
								}
								
								history_index = history.size();
								
								RemoteConnection rc = getCurrentRemoteConnection();
								
								if ( rc != null ){
								
									executeCommand( rc, str );
								}
							}
						}
					}
			    });
			
			new LinkLabel( operation_group, "xmwebui.link", MessageText.getString(  "xmwebui.commands.wiki.link" ));

			
				// log
			
			log = new StyledText( main,SWT.READ_ONLY | SWT.V_SCROLL | SWT.H_SCROLL | SWT.BORDER);
			grid_data = new GridData(GridData.FILL_BOTH);
			grid_data.horizontalSpan = 4;
			grid_data.verticalIndent = 10;
			log.setLayoutData(grid_data);
			log.setIndent( 4 );
			
			updateAccountList();
			
			initialised = true;
		}
		
		private void
		executeCommand(
			RemoteConnection		rc,
			String					str )
		{
			log( "> " + str );
			
			try{
				if ( str.equalsIgnoreCase( "status" )){
				
					log( "" + rc.getRPCStatus());
					
				}else if ( str.equalsIgnoreCase( "torrents" )){
					
					List<RemoteTorrent>	torrents = rc.getTorrents();
					
					int	pos = 1;
					
					for ( RemoteTorrent t: torrents ){
						
						log( (pos++) + ") " + t.getName());
					}
				}else if ( str.toLowerCase().startsWith( "search" )){
					
					int pos = str.indexOf(' ');
					
					String expr = "";
					
					if ( pos != -1 ){
						
						expr = str.substring( pos ).trim();
					}

					if ( expr.length() == 0 ){
						
						logError( "Search expression missing" );
						
					}else{
						
						rc.search( expr );
					}
				}else if ( str.equalsIgnoreCase( "close" )){
					
					rc.lifecycle( "close" );
					
				}else if ( str.equalsIgnoreCase( "restart" )){
					
					rc.lifecycle( "restart" );
	
				}else if ( str.equalsIgnoreCase( "update-check" )){
					
					rc.lifecycle( "update-check" );
	
				}else if ( str.equalsIgnoreCase( "update-apply" )){
					
					rc.lifecycle( "update-apply" );
					
				}else if ( str.toLowerCase().startsWith( "pairing" )){
					
					rc.pairing( str.substring( 7 ).trim());

				}else if ( str.toLowerCase( Locale.US ).startsWith( "console " )){
						
					rc.console(  str.substring( 7 ).trim());
					
				}else{
					
					logError( "Unrecognized command '" + str + "'" );
				}
			}catch( Throwable e ){
				
				logError( e );
			}
		}
		
		private void
		setSelectedAccount(
			AccountConfig		_ac )
		{
			if ( _ac == current_account && initialised ){
				
				return;
			}
			
			current_account	= _ac;
			
			if ( current_account == null ){
				
				log( "No code selected" );
				
				connect_button.setEnabled( false );
				remove_button.setEnabled( false );
				setEnabled( options_group, false );
				setEnabled( operation_group, false );
				
				if ( ac_list.getSelectionIndex() != -1 ){
				
					ac_list.deselectAll();
				}
			}else{
				
				log( "Code '" + current_account.getAccessCode() + "' selected" );
				
				connect_button.setEnabled( true );
				remove_button.setEnabled( true );
				setEnabled( options_group, true );
	
				RemoteConnection rc = remote_connections.get( current_account.getAccessCode());
				
				setEnabled( operation_group, rc != null && rc.isConnected());
				
				String[]	items = ac_list.getItems();
				
				boolean	found = false;
				
				for ( int i=0;i<items.length;i++ ){
					
					String ac = trimAccount( items[i] );
					
					if ( ac.equals( current_account.getAccessCode())){
						
						if ( ac_list.getSelectionIndex() != i ){
						
							ac_list.select( i );
						}
						
						found = true;
					}
				}
				
				if ( !found ){
					
					ac_list.deselectAll();
				}
			
				updateSelectedAccount( current_account );
			}
		}
		
		private void
		updateSelectedAccount(
			AccountConfig	ac )
		{
			boolean	basic_enable 		= ac.isBasicEnabled();
			boolean	basic_defs 			= ac.isBasicDefaults();
			String	basic_user_str		= ac.getBasicUser();
			
			description.setText( ac.getDescription());
			do_basic.setSelection( basic_enable );
			do_basic_def.setSelection( basic_defs );
			basic_username.setText( basic_user_str );
			basic_password.setText( "xxx" );
			force_proxy.setSelection( ac.isForceProxy());
			secure_password.setText( "xxx" );
			
			if ( basic_enable ){
				
				do_basic_def.setEnabled( true );
				
				basic_username.setEnabled( !basic_defs );
				basic_password.setEnabled( !basic_defs );
			}else{
				
				do_basic_def.setEnabled( false );
				basic_username.setEnabled( false );
				basic_password.setEnabled( false );
			}
		}
		
		private String
		trimAccount(
			String	ac )
		{
			int	pos = ac.indexOf( '-' );
			
			if ( pos != -1 ){
				
				ac = ac.substring( 0, pos ).trim();
			}
			
			return( ac );
		}
		
		private void
		updateAccountList()
		{
			int index = ac_list.getSelectionIndex();

			String selected_account;
			
			if ( index == -1 ){
				
				selected_account = null;
				
			}else{
				
				selected_account = trimAccount( ac_list.getItems()[ index ]);
			}
			
			ac_list.removeAll();
			
			List<String> acs = new ArrayList<String>();
			
			for ( AccountConfig c: account_config.values()){
				
				String ac = c.getAccessCode();
				
				String desc = c.getDescription();
				
				if ( desc.length() > 0 ){
					
					ac += " - " + desc;
				}
				
				acs.add( ac );
			}
			
			Collections.sort( acs );
				
			index = -1;
			
			for ( int i=0; i<acs.size(); i++){
				
				String ac = acs.get(i);
			
				if ( selected_account != null && selected_account.equals( trimAccount( ac ))){
					
					index = i;
				}
				
				ac_list.add( ac );
			}
			
			ac_list.getParent().layout( true );
			
			if ( index == -1 ){
				
				setSelectedAccount( null );
				
			}else{
				
				ac_list.select( index );
				
				setSelectedAccount( account_config.get( selected_account ));
			}
		}
		
		private void
		updateRemoteConnection(
			final RemoteConnection	rc,
			final boolean			is_connected )
		{
			Utils.execSWTThread(
				new Runnable()
				{
					@Override
					public void
					run()
					{
						if ( current_account != null ){
							
							if ( current_account.getAccessCode().equals( rc.getAccessCode())){
								
								setEnabled( operation_group, is_connected );
								
								String	text = "";
								
								if ( is_connected ){
									
									text = rc.getConnectionStatus();
									
								}else{
									
									text = CS_DISCONNECTED;
								}
								
								Messages.setLanguageText( status_label, "xmwebui.rpc.constatus", new String[]{ text } );
							}
						}
					}
				});
		}
		
		private RemoteConnection
		getCurrentRemoteConnection()
		{
			if ( current_account == null ){
				
				return( null );
			}
			
			synchronized( remote_connections ){
				
				return( remote_connections.get( current_account.getAccessCode()));
			}
		}
		
		private void
		setEnabled(
			Composite		comp,
			boolean			enable )
		{
			comp.setEnabled( enable );
			
			for ( Control c: comp.getChildren()){
				
				if ( c instanceof Composite ){
					
					setEnabled((Composite)c,enable );
					
				}else{
					
					c.setEnabled( enable );
				}
			}
		}
		
		private void
		destroy()
		{
		}

	
		protected void
		print(
			String		str,
			Throwable	e )
		{
			print( str + ": " + Debug.getNestedExceptionMessage( e ), LOG_ERROR, false );
		}
		
		protected void
		print(
			String		str )
		{
			print( str, LOG_NORMAL, false );
		}
	
		protected void
		print(
			final String		str,
			final int			log_type,
			final boolean		clear_first )
		{	
			if ( !log.isDisposed()){
	
				final int f_log_type = log_type;
	
				log.getDisplay().asyncExec(
						new Runnable()
						{
							@Override
							public void
							run()
							{
								if ( log.isDisposed()){
	
									return;
								}
	
								int	start;
	
								if ( clear_first ){
	
									start	= 0;
	
									log.setText( str + "\n" );
	
								}else{
	
									String	text = log.getText();
									
									start = text.length();
	
									if ( start > 32000 ){
										
										log.replaceTextRange( 0, 1024, "" );
										
										start = log.getText().length();
									}
									
									log.append( str + "\n" );
								}
	
								Color 	color;
	
								if ( f_log_type == LOG_NORMAL ){
	
									color = Colors.black;
	
								}else if ( f_log_type == LOG_SUCCESS ){
	
									color = Colors.green;
	
								}else{
	
									color = Colors.red;
								}
	
								if ( color != Colors.black ){
									
									StyleRange styleRange = new StyleRange();
									styleRange.start = start;
									styleRange.length = str.length();
									styleRange.foreground = color;
									log.setStyleRange(styleRange);
								}
								
								log.setSelection( log.getText().length());
							}
						});
			}
		}
	}
	
	private class
	AccountConfig
		implements XMClientAccount
	{
		private String		uid;
		private String		access_code;
		private String		description;
		private boolean		basic_enabled;
		private boolean		basic_defs;
		private String		basic_user;
		private String		basic_password;
		private boolean		force_proxy;
		private String		secure_password;
		
		private
		AccountConfig(
			String	_ac )
		{
			uid				= Base32.encode( RandomUtils.nextSecureHash());
			access_code		= _ac;
			description		= "";
			basic_enabled	= true;
			basic_defs		= true;
			basic_user		= "vuze";
			basic_password	= "";
			secure_password	= "";
		}
		
		private
		AccountConfig(
			Map		map )
		
			throws IOException
		{
			uid 	= MapUtils.getMapString( map, "uid", null );
			
			if ( uid == null ){
				
				uid = Base32.encode( RandomUtils.nextSecureHash());
			}
			
			access_code 	= MapUtils.getMapString( map, "ac", null );
			description 	= MapUtils.getMapString( map, "desc", "" );
			basic_enabled 	= MapUtils.getMapBoolean( map, "basic_enable", true );
			basic_defs 		= MapUtils.getMapBoolean( map, "basic_defs", true );
			basic_user 		= MapUtils.getMapString( map, "basic_user", "vuze" );
			basic_password 	= MapUtils.getMapString( map, "basic_password", "" );
			force_proxy 	= MapUtils.getMapBoolean( map, "force_proxy", false );
			secure_password = MapUtils.getMapString( map, "secure_password", "" );
		}
		
		private Map
		export()
		
			throws IOException
		{
			Map	map = new HashMap();
			
			MapUtils.setMapString( map, "uid", uid );
			MapUtils.setMapString( map, "ac", access_code );
			MapUtils.setMapString( map, "desc", description );
			MapUtils.exportBooleanAsLong( map, "basic_enable", basic_enabled );
			MapUtils.exportBooleanAsLong( map, "basic_defs", basic_defs );
			MapUtils.setMapString( map, "basic_user", basic_user );
			MapUtils.setMapString( map, "basic_password", basic_password );
			MapUtils.exportBooleanAsLong( map, "force_proxy", force_proxy );
			MapUtils.setMapString( map, "secure_password", secure_password );

			return( map );
		}
		
		public String
		getUID()
		{
			return( uid );
		}
		
		@Override
		public String
		getAccessCode()
		{
			return( access_code );
		}
		
		public void
		setDescription(
			String	str )
		{
			description = str;
		}
		
		public String
		getDescription()
		{
			return( description );
		}
		
		public void
		setBasicEnabled(
			boolean	e )
		{
			basic_enabled	= e;
		}
		
		@Override
		public boolean
		isBasicEnabled()
		{
			return( basic_enabled );
		}
		
		public void
		setBasicDefaults(
			boolean	e )
		{
			basic_defs	= e;
		}
		
		@Override
		public boolean
		isBasicDefaults()
		{
			return( basic_defs );
		}
		
		public void
		setBasicUser(
			String	str )
		{
			basic_user	= str;
		}
		
		@Override
		public String
		getBasicUser()
		{
			return( basic_user );
		}
		
		public void
		setBasicPassword(
			String	str )
		{
			basic_password	= str;
		}
		
		@Override
		public String
		getBasicPassword()
		{
			return( basic_password );
		}
		
		public void
		setForceProxy(
			boolean	b )
		{
			force_proxy = b;
		}
		
		@Override
		public boolean
		isForceProxy()
		{
			return( force_proxy );
		}
		
		@Override
		public String
		getSecureUser()
		{
			return( "vuze" );
		}
		
		public void
		setSecurePassword(
			String		str )
		{
			secure_password = str;
		}
		
		@Override
		public String
		getSecurePassword()
		{
			return( secure_password );
		}
		
		@Override
		public File
		getResourceDir() 
		{
			return( plugin.getResourceDir());
		}
	}
	
	private class
	RemoteConnection
		extends XMClientConnection
	{		
		private List<RemoteTorrent>	last_torrents;
		
		private
		RemoteConnection(
			XMClientAccount		ac )
		{
			super(
				ac, 
				new XMClientConnectionAdapter()
				{
					@Override
					public void
					setConnected(
						XMClientConnection	connection,
						boolean				is_connected )
					{
						XMWebUIPluginView.this.setConnected( (RemoteConnection)connection, is_connected );
					}
					
					@Override
					public void
					log(
						String	str )
					{
						XMWebUIPluginView.this.log( str );
					}
					
					@Override
					public void
					logError(
						String	str )
					{
						XMWebUIPluginView.this.logError( str );
					}
				});
		}
		

		private List<RemoteTorrent>
		getTorrents()
		
			throws XMRPCClientException
		{
			JSONObject	request = new JSONObject();
			
			request.put( "method", "torrent-get" );
			
			Map request_args = new HashMap();
			
			request.put( "arguments", request_args );
			
			List fields = new ArrayList();
			
			request_args.put(TransmissionVars.ARG_FIELDS, fields );
			
			fields.add( "name" );
			
			JSONObject reply = call( request );
			
			String result = (String)reply.get( "result" );
			
			if ( result.equals( "success" )){
				
				Map	args = (Map)reply.get( "arguments" );
					
				List<Map> torrent_maps = (List<Map>)args.get( "torrents" );
				
				List<RemoteTorrent> torrents = new ArrayList<RemoteTorrent>();
				
				for ( Map m: torrent_maps ){
					
					torrents.add( new RemoteTorrent( m ));
				}
				
				last_torrents = torrents;
				
				return( torrents );
				
			}else{
				
				throw( new XMRPCClientException( "RPC call failed: " + result ));
			}
		}
		
		private List<RemoteTorrent>
		getLastTorrents()
		{
			return( last_torrents );
		}
		
		private void
		search(
			String	expr )
		
			throws XMRPCClientException
		{
			JSONObject	request = new JSONObject();
			
			request.put( "method", "vuze-search-start" );
			
			Map request_args = new HashMap();
			
			request.put( "arguments", request_args );
						
			request_args.put( "expression", expr );
						
			JSONObject reply = call( request );

			//log( String.valueOf(reply ));
			
			String result = (String)reply.get( "result" );
			
			if ( result.equals( "success" )){
				
				Map	args = (Map)reply.get( "arguments" );
				
				final String	sid = (String)args.get( "sid" );
				
				log( "Search id: " + sid );
				
				List<Map>	engines = (List<Map>)args.get( "engines" );
				
				final Set<String> engine_ids = new HashSet<String>();
				
				for ( Map m: engines ){
					
					String eid 		= (String)m.get( "id" );
					String e_name	= (String)m.get( "name" );
					
					engine_ids.add( eid );
					
					log( "    " + eid + "/" + e_name );
				}
				
				new AEThread2( "result catcher" )
				{
					@Override
					public void
					run()
					{
						try{
							while( true ){
								
								try{
									Thread.sleep(500);
									
								}catch( Throwable e ){
								}
								
								JSONObject request = new JSONObject();
								
								request.put( "method", "vuze-search-get-results" );
								
								HashMap request_args = new HashMap();
								
								request.put( "arguments", request_args );
											
								request_args.put( "sid", sid );
								
								JSONObject reply = call( request );
								
								String result = (String)reply.get( "result" );
								
								if ( result.equals( "success" )){
									
									Map args = (Map)reply.get( "arguments" );
									
									
									List<Map> engine_results = (List<Map>)args.get( "engines" );
									
									for ( Map e_r: engine_results ){
										
										String eid = (String)e_r.get( "id" );
										
										if ( !engine_ids.contains( eid )){
											
											continue;
										}
										
										List e_results = (List)e_r.get( "results" );
										
										if ( e_results != null ){
											
											log( "    Engine results: " + eid + " - " + e_results.size());
										}
										
										boolean e_comp = (Boolean)e_r.get( "complete" );
										
										if ( e_comp ){
											
											String e_error = (String)e_r.get( "error" );
											
											if ( e_error == null ){
												
												log( "    Engine complete: " + eid );
												
											}else{
												
												log( "    Engine failed: " + eid + " - " + e_error );
											}
											
											engine_ids.remove( eid );
										}
									}
									
									boolean	complete = (Boolean)args.get( "complete" );
									
									if ( complete ){
										
										log( "Search complete" );
										
										break;
									}
								}else{
									
									throw( new XMRPCClientException( "RPC call failed: " + result ));
								}
							}
						}catch( Throwable e ){
							
							logError( "Search failed: " + Debug.getNestedExceptionMessage( e ));
						}
					}
				}.start();
				
			}else{
				
				throw( new XMRPCClientException( "RPC call failed: " + result ));
			}
		}
		
		private void
		lifecycle(
			final String	cmd )
		
			throws XMRPCClientException
		{
			new AEThread2( "lifecycle.async" )
			{
				@Override
				public void
				run()
				{

					try{
						JSONObject	request = new JSONObject();
						
						request.put( "method", "vuze-lifecycle" );
						
						Map request_args = new HashMap();
						
						request.put( "arguments", request_args );
									
						request_args.put( "cmd", cmd );
									
						JSONObject reply = call( request );
						
						String result = (String)reply.get( "result" );
						
						if ( result.equals( "success" )){
														
							Map reply_args = (Map)reply.get( "arguments" );
							
							if ( reply_args != null ){
								
								log( "    " + reply_args );
								
							}else{
								
								log( "    command accepted" );
							}
							
						}else{
							
							throw( new XMRPCClientException( "RPC call failed: " + result ));
						}
					}catch( Throwable e ){
						
						logError( Debug.getNestedExceptionMessage( e ));
					}
				}
			}.start();
		}
	
		private void
		pairing(
			String	cmd_line )
		
			throws XMRPCClientException
		{
			String[] bits = cmd_line.split( " " );
			
			String cmd = bits[0];
			
			JSONObject	request = new JSONObject();
						
			request.put( "method", "vuze-pairing" );
					
			Map request_args = new HashMap();
			
			request.put( "arguments", request_args );
						
			
			if ( cmd.equals( "enable" )){
				
				cmd = "set-enabled";
				
				request_args.put( "enabled", true );
				
			}else if ( cmd.equals( "disable" )){
				
				cmd = "set-enabled";
				
				request_args.put( "enabled", false );
			}
			
			if ( cmd.equals( "srp-enable" )){
				
				if ( bits.length < 2 ){
					
					throw( new XMRPCClientException( "Password required" ));
				}
				
				cmd = "set-srp-enabled";
				
				request_args.put( "enabled", true );
				request_args.put( "password", bits[1] );
				
			}else if ( cmd.equals( "srp-disable" )){
				
				cmd = "set-sro-enabled";
				
				request_args.put( "enabled", false );
			}

			request_args.put( "cmd", cmd );

			JSONObject reply = call( request );
			
			String result = (String)reply.get( "result" );
			
			if ( result.equals( "success" )){
											
				Map reply_args = (Map)reply.get( "arguments" );
				
				if ( reply_args != null ){
					
					log( "    " + reply_args );
					
				}else{
					
					log( "    command accepted" );
				}
				
			}else{
				
				throw( new XMRPCClientException( "RPC call failed: " + result ));
			}
		}	
		
		private void
		console(
			String	cmd_line )
		
			throws XMRPCClientException
		{
			JSONObject	request = new JSONObject();
						
			request.put( "method", "bigly-console" );
					
			Map request_args = new HashMap();
			
			request.put( "arguments", request_args );
				
			request_args.put( "instance_id", getUID());
			
			request_args.put( "cmd", cmd_line );

			JSONObject reply = call( request );
			
			String result = (String)reply.get( "result" );
			
			if ( result.equals( "success" )){
						
				Map reply_args = (Map)reply.get( "arguments" );
				
				List<String> lines = (List<String>)reply_args.get( "lines" );
				
				for ( String line: lines ){
					
					log( line );
				}
			}else{
				
				throw( new XMRPCClientException( "RPC call failed: " + result ));
			}
		}	
		
	}
	
	private class
	RemoteTorrent
	{
		private Map		map;
		private
		RemoteTorrent(
			Map		_m )
		{
			map = _m;
		}
		
		private String
		getName()
		{
			return( (String)map.get( "name" ));
		}
	}
}
