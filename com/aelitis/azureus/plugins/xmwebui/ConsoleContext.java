/*
 * Copyright (C) Bigly Software.  All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

package com.aelitis.azureus.plugins.xmwebui;

import java.io.*;
import java.util.*;

import com.biglybt.core.CoreFactory;
import com.biglybt.core.util.*;
import com.biglybt.ui.console.ConsoleInput;

class
ConsoleContext
{
	private final String		uid;
	
	private final ConsoleInput console;
	private final InputStreamReader console_in_stream;
	private final PipedOutputStream console_out_stream;
	private final LinkedList<String> console_pending = new LinkedList<>();
	private final AESemaphore console_sem = new AESemaphore( "XMWebUIPlugin:console-ui" );
	private final Map<String, ConsoleContext> console_contexts;

	private boolean				console_closed;
	
	ConsoleContext(
		Map<String, ConsoleContext>		console_contexts,
		String		_uid )
	
		throws IOException
	{
		this.console_contexts = console_contexts;
		uid = _uid;
		
		PipedInputStream pis1 = new PipedInputStream( 32*1024 );
		
		console_out_stream = new PipedOutputStream( pis1 );
		
		PipedInputStream pis2 = new PipedInputStream( 32*1024 );
		
		PipedOutputStream console_in = new PipedOutputStream( pis2 );
		
		PrintStream out = new PrintStream( console_in, true );
		
		AEThread2.createAndStartDaemon(
			"XMWebUIPlugin:console-ui",
			()->{
				try{
					LineNumberReader lnr = new LineNumberReader( new InputStreamReader( pis2, Constants.UTF_8  ));
					
					while( true ){
					
						String line = lnr.readLine();
						
						if ( line == null ){
								
							break;
						}
						
						synchronized( ConsoleContext.this ){

							console_pending.add( line.trim());
						}
						
						console_sem.release();
						
					}
				}catch( Throwable e ){
					
					Debug.out( e );
					
				}finally{
					
					destroy();
				}
			});
		
		console_in_stream = new InputStreamReader( pis1, Constants.UTF_8 );
		
		console = new ConsoleInput( "", CoreFactory.getSingleton(), console_in_stream, out, Boolean.FALSE);
	}
	
	List<String>
	process(
		Map 	args )
	{
		List<String>	lines = new ArrayList<>();

		try{
			console_out_stream.write( (args.get( "cmd" ) + "\n" ).getBytes( Constants.UTF_8 ));
			
			String marker = Base32.encode(RandomUtils.nextSecureHash());
			
			console_out_stream.write( ("echo " + marker + "\n" ).getBytes( Constants.UTF_8 ));
					
			console_out_stream.flush();
			
			while( true ){
				
				if ( !console_sem.reserve(5000)){
					
					lines.add( "..." );
					
					break;
				}
				
				synchronized( ConsoleContext.this ){
					
					if ( console_closed ){
					
						break;
					}
				
					String line = console_pending.removeFirst();
					
					if ( line.contains( marker )){
						
						break;
						
					}else{
						
						lines.add( line );
					}
				}
			}
							
		}catch( Throwable e ){
			
			lines.add( "Processing failed: " + Debug.getNestedExceptionMessage( e ));
			
			destroy();
		}
		
		return( lines );
	}
	
	private void
	destroy()
	{
		try{
			synchronized( ConsoleContext.this ){
				
				console_closed = true;
			}
			
			try{
				console_in_stream.close();
				
			}catch( Throwable e ){
				
			}
			
			try{
				console_out_stream.close();
				
			}catch( Throwable e ){
				
			}
			
			console_sem.release();
	
		}finally{
			
			synchronized( console_contexts ){

				console_contexts.remove( uid );
			}
		}
	}
	
}
