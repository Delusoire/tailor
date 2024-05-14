import path from "node:path";
import fs from "node:fs/promises";

import open from "open";

import debounce from "lodash/debounce.js";
import { Transpiler } from "./transpile.js";

const reloadSpotifyDocument = debounce( () => open( "spotify:app:rpc:reload" ), 3000 );

export type Metadata = any;

export class Builder {
   cssEntry: string;

   private static jsGlob = "./**/*.{ts,jsx,tsx}";

   public constructor( metadata: Metadata, private transpiler: Transpiler ) {
      this.cssEntry = metadata.entries.css?.replace( /\.css$/, ".scss" );
   }

   public async js( files?: string[] ) {
      if ( !files ) {
         // @ts-ignore
         const glob = fs.glob( Builder.jsGlob );
         // @ts-ignore
         files = await Array.fromAsync( glob );
         files = files!.filter( f => !f.includes( "node_modules" ) && !f.endsWith( ".d.ts" ) );
      }

      return Promise.all( files.map( file => this.transpiler.js( file ) ) );
   }

   public async css() {
      if ( !this.cssEntry ) {
         return;
      }

      return this.transpiler.css( this.cssEntry, [ Builder.jsGlob ] );
   }
}

export class Watcher {
   constructor( private builder: Builder ) { }

   private async onFsFileChange( event: fs.FileChangeInfo<string> ) {
      const file = event.filename!;
      switch ( path.extname( file ) ) {
         case ".scss": {
            await this.builder.css();
            reloadSpotifyDocument();
            break;
         }
         case ".ts":
            if ( file.endsWith( ".d.ts" ) ) {
               break;
            }
         case ".jsx":
         case ".tsx": {
            await this.builder.js( [ file ] );
            reloadSpotifyDocument();
            break;
         }

      }
   }

   public async watch() {
      console.log( "Watching for changes..." );
      const watcher = fs.watch( ".", { recursive: true } );
      for await ( const event of watcher ) {
         console.log( `${ event.filename } was ${ event.eventType }d` );
         await this.onFsFileChange( event );
      }
   }
}
