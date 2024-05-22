import fs from "node:fs/promises";

import swc from "@swc/core";
import postcss from "postcss";

import atImport from "postcss-import";
import tailwindcssNesting from "tailwindcss/nesting/index.js";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import postcssRemapper, { type ClassMap } from "@delu/postcss-remapper";
import swcRemapper from "@delu/swc-remapper";

export class Transpiler {
   public constructor( private classmap: ClassMap ) { }

   public async js( input: string, output: string ) {
      const buffer = await fs.readFile( input, "utf-8" );
      const { code } = await swc.transform( buffer, {
         filename: input,
         isModule: true,
         jsc: {
            baseUrl: ".",
            experimental: {
               plugins: [
                  [ swcRemapper(), { classmap: { CLASSMAP: this.classmap } } ],
               ],
            },
            parser: {
               syntax: "typescript",
               tsx: true,
               decorators: true,
               dynamicImport: true,
            },
            target: "esnext",
            transform: {
               decoratorVersion: "2022-03",
               react: {
                  pragma: "React.createElement",
                  pragmaFrag: "React.Fragment",
               },
            },
            loose: false,
         },
         outputPath: output,
         sourceMaps: false,
      } );
      await fs.writeFile( output, code );
   }

   public async css( input: string, output: string, files: string[] ) {
      const buffer = await fs.readFile( input, "utf-8" );
      const PostCSSProcessor = await postcss.default( [
         atImport(),
         tailwindcssNesting(),
         tailwindcss( {
            config: {
               content: {
                  relative: true,
                  files,
               },
            },
         } ),
         autoprefixer( {} ),
         postcssRemapper( { classmap: this.classmap } ),
      ] );
      const p = await PostCSSProcessor.process( buffer, { from: input } );
      await fs.writeFile( output, p.css );
   }
}
