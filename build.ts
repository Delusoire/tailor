import path from "node:path";
import fs from "node:fs/promises";

import open from "open";

import debounce from "lodash/debounce.js";
import { Transpiler } from "./transpile.js";

const reloadSpotifyDocument = debounce( () => open( "spotify:app:rpc:reload" ), 3000 );

export type Metadata = any;

async function* fs_walk( dir: string ): AsyncGenerator<string> {
   for await ( const d of await fs.opendir( dir, {} ) ) {
      const entry = path.join( dir, d.name );
      if ( d.isDirectory() ) yield* fs_walk( entry );
      else if ( d.isFile() ) yield entry;
   }
}

export class Builder {
   cssEntry: string;

   private static jsGlob = "./**/*.{ts,mjs,jsx,tsx}";

   public constructor( private transpiler: Transpiler, metadata: Metadata, private outDir = ".", ) {
      this.cssEntry = metadata.entries.css?.replace( /\.css$/, ".scss" );
   }

   public async build( input: string ) {
      const ps = [];
      for await ( const file of fs_walk( input ) ) {
         ps.push( this.buildFile( file ) );
      }
      return Promise.all( ps );
   }

   private getRelPath( p: string ) {
      return path.join( this.outDir, p );
   }

   public js( input: string ) {
      const output = this.getRelPath( input.replace( /\.[^\.]+$/, ".js" ) );
      return this.transpiler.js( input, output );
   }

   public css() {
      const input = this.cssEntry;
      const output = this.getRelPath( input.replace( /\.[^\.]+$/, ".css" ) );
      return this.transpiler.css( input, output, [ Builder.jsGlob ] );
   }

   public copyFile( input: string ) {
      const output = this.getRelPath( input );
      return fs.copyFile( input, output );
   }

   public async buildFile( file: string, reload = false ) {
      switch ( path.extname( file ) ) {
         case ".scss": {
            if ( reload || file.endsWith( this.cssEntry ) ) {
               await this.css();
               reload && reloadSpotifyDocument();
            }
            break;
         }
         case ".ts":
            if ( file.endsWith( ".d.ts" ) ) {
               break;
            }
         case ".mjs":
         case ".jsx":
         case ".tsx": {
            await this.js( file );
            reload && reloadSpotifyDocument();
            break;
         }
         default: {
            await this.copyFile( file );
            break;
         }
      }
   }

}
