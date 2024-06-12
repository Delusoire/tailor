import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "jsr:@std/fs/ensure-dir";

import swc from "npm:@swc/core@1.5.24";
import postcss from "npm:postcss@8.4.38";

import postcssPluginRemapper, {
   type Mapping,
} from "jsr:@delu/postcss-plugin-remapper@0.1.1";
import swcPluginRemapper from "npm:@delusoire/swc-plugin-remapper@0.1.1";
import swcPluginTransformModuleSpecifiers from "npm:@delusoire/swc-plugin-transform-module-specifiers@0.1.2";
import autoprefixer from "npm:autoprefixer@10.4.19";
import atImport from "npm:postcss-import@16.1.0";
import tailwindcss from "npm:tailwindcss@3.4.3";
import tailwindcssNesting from "npm:tailwindcss@3.4.3/nesting/index.js";


export type { Mapping };

export class Transpiler {
   private swc_options!: swc.Options;
   public constructor(private classmap: Mapping) { }

   public init(baseUrl: string) {
      this.swc_options = {
         isModule: true,
         jsc: {
            baseUrl: path.resolve(baseUrl),
            experimental: {
               plugins: [
                  [swcPluginRemapper(), { mapping: { MAP: this.classmap } }],
                  [swcPluginTransformModuleSpecifiers(), {
                     extensions: [
                        [".ts", ".js"],
                        [".mjs", ".js"],
                        [".mts", ".js"],
                        [".jsx", ".js"],
                        [".tsx", ".js"],
                     ],
                  }],
               ],
            },
            loose: false,
            parser: {
               decorators: true,
               dynamicImport: true,
               syntax: "typescript",
               tsx: true,
            },
            target: "esnext",
            transform: {
               decoratorVersion: "2022-03",
               react: {
                  pragma: "React.createElement",
                  pragmaFrag: "React.Fragment",
               },
               useDefineForClassFields: false,
            },
         },
         sourceMaps: false,
      };
   }

   public async js(input: string, output: string) {
      const buffer = await fs.readFile(input, "utf-8");
      const { code } = await swc.transform(buffer, { ...this.swc_options, filename: input, outputPath: output });
      await ensureDir(path.dirname(output));
      await fs.writeFile(output, code);
   }

   public async css(input: string, output: string, files: string[]) {
      function reformatClassmap(classmap: Mapping) {
         const reformattedEntries = Object.keys(classmap).map(([k, v]) => {
            if (typeof v === "object") {
               v = reformatClassmap(v);
            }
            return [k.replaceAll("_", "-"), v];
         });
         return Object.fromEntries(reformattedEntries);
      }

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
         postcssPluginRemapper({
            mapping: { MAP: reformatClassmap(this.classmap) },
         }),
      ]);
      const p = await PostCSSProcessor.process(buffer, { from: input });
      await ensureDir(path.dirname(output));
      await fs.writeFile(output, p.css);
   }
}
