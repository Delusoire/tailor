import fs from "node:fs/promises";

import swc from "npm:@swc/core@1.5.24";
import postcss from "npm:postcss@8.4.38";

import atImport from "npm:postcss-import@16.1.0";
import tailwindcssNesting from "npm:tailwindcss@3.4.3/nesting/index.js";
import tailwindcss from "npm:tailwindcss@3.4.3";
import autoprefixer from "npm:autoprefixer@10.4.19";
import postcssRemapper, { type ClassMap } from "jsr:@delu/postcss-remapper@0.1.0";
import swcRemapper from "npm:swc-remapper@0.1.10";

export type { ClassMap };

export class Transpiler {
   public constructor(private classmap: ClassMap) { }

   public async js(input: string, output: string) {
      const buffer = await fs.readFile(input, "utf-8");
      const { code } = await swc.transform(buffer, {
         filename: input,
         isModule: true,
         jsc: {
            baseUrl: ".",
            experimental: {
               plugins: [
                  [swcRemapper(), { classmap: { CLASSMAP: this.classmap } }],
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
      });
      await fs.writeFile(output, code);
   }

   public async css(input: string, output: string, files: string[]) {
      const buffer = await fs.readFile(input, "utf-8");
      const PostCSSProcessor = await postcss.default([
         atImport(),
         tailwindcssNesting(),
         tailwindcss({
            config: {
               content: {
                  relative: true,
                  files,
               },
            },
         }),
         autoprefixer({}),
         postcssRemapper({ classmap: this.classmap }),
      ]);
      const p = await PostCSSProcessor.process(buffer, { from: input });
      await fs.writeFile(output, p.css);
   }
}
