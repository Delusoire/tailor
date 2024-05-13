#!/usr/bin/env node

import fs from "node:fs/promises";

import { type Metadata, Builder, Watcher } from "./build.js";
import { type ClassMap, Transpiler } from "./transpile.js";

async function readJSON<T>( path: string ): Promise<T> {
   const file = await fs.readFile( path, "utf-8" );
   return JSON.parse( file ) as T;
}

function writeClassMapDts( classmap: ClassMap ) {
   function genType( obj: any ) {
      let s = "";

      for ( const [ k, v ] of Object.entries( obj ) ) {
         s += `"${ k }":`;
         if ( typeof v === "string" ) {
            s += `"${ v }"`;
         } else if ( Object.getPrototypeOf( v ) === Object.prototype ) {
            s += genType( v );
         } else {
            s += "unknown";
         }
         s += ",";
      }

      return `{${ s }}`;
   }

   const dts = `/* Bespoke Tailored Classmap (BTC) */

declare const CLASSMAP = ${ genType( classmap ) } as const;
`;

   return fs.writeFile( "./classmap.d.ts", dts );
}

interface BuildOpts {
   classmap: ClassMap;
   metadata: Metadata;
}

async function buildAndWatch( { classmap, metadata }: BuildOpts ) {
   const transpiler = new Transpiler( classmap );
   const builder = new Builder( metadata, transpiler );
   const watcher = new Watcher( builder );

   const timeStart = Date.now();

   await builder.js();
   await builder.css();

   console.log( `Build finished in ${ ( Date.now() - timeStart ) / 1000 }s!` );

   await watcher.watch();
}

// TODO: add cli options for these
const classmap = await readJSON<ClassMap>( "./classmap.json" );
const metadata = await readJSON<Metadata>( "./metadata.json" );

await writeClassMapDts( classmap );

await buildAndWatch( { classmap, metadata } );
