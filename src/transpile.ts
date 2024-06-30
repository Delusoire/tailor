import path from "node:path";

import { ensureFile } from "jsr:@std/fs@1.0.0-rc.2/ensure-file";
import { fromFileUrl } from "jsr:@std/path@1.0.0-rc.2/from-file-url";

import swc from "npm:@swc/core@1.6.6";
import postcss from "npm:postcss@8.4.38";

import postcssPluginRemapper, {
   type Mapping,
} from "jsr:@delu/postcss-plugin-remapper@0.1.1";
import swcPluginRemapper from "npm:@delusoire/swc-plugin-remapper@0.1.3";
import swcPluginTransformModuleSpecifiers from "npm:@delusoire/swc-plugin-transform-module-specifiers@0.1.4";
import autoprefixer from "npm:autoprefixer@10.4.19";
import atImport from "npm:postcss-import@16.1.0";
import tailwindcss from "npm:tailwindcss@3.4.3";
import tailwindcssNesting from "npm:tailwindcss@3.4.3/nesting/index.js";
import { getTimestamp } from "./timestamp.ts";

export type { Mapping };

interface SwcOpts {
   baseUrl: string;
   classmap: Mapping;
}
function generateSwcOptions(opts: SwcOpts): swc.Options {
   return ({
      isModule: true,
      module: {
         type: "es6",
         strict: true,
         strictMode: true,
         lazy: false,
         importInterop: "none",
         // @ts-ignore
         resolveFully: true
      },
      jsc: {
         baseUrl: path.resolve(opts.baseUrl),
         experimental: {
            plugins: [
               [fromFileUrl(swcPluginRemapper()), { mapping: { MAP: opts.classmap } }],
               [fromFileUrl(swcPluginTransformModuleSpecifiers()), {
                  rules: [
                     [`\.js$`, ".js"],
                     [`\.ts$`, ".js"],
                     [`\.mjs$`, ".js"],
                     [`\.mts$`, ".js"],
                     [`\.jsx$`, ".js"],
                     [`\.tsx$`, ".js"],
                  ],
               }],
            ],
         },
         loose: false,
         parser: {
            decorators: true,
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
   });
}

export class Transpiler {
   public constructor(private classmap: Mapping, private dev: boolean) { }

   public async js(input: string, output: string, baseUrl: string, filePath: string, timestamp: number) {
      let program: string | swc.Program;


      const swc_options: swc.Options = Object.assign(
         generateSwcOptions({ baseUrl, classmap: this.classmap }),
         { filename: input, outputPath: output }
      );

      if (this.dev) {
         program = await swc.parseFile(input, { syntax: "typescript", tsx: true, decorators: true, comments: true, script: false, target: "esnext" });

         // deno-lint-ignore no-inner-declarations
         async function remap(node: swc.StringLiteral) {
            if (node.value.startsWith("./") || node.value.startsWith("../")) {
               node.value = `http://localhost:2077${filePath}/../${node.value}?t=${timestamp}`;
            } else if (node.value.startsWith("/modules/")) {
               node.value = `http://localhost:2077${node.value}`;
               //! We should probably cache this
               const timestamp = await getTimestamp(node.value.slice("/modules".length));
               if (timestamp) {
                  node.value += `?t=${timestamp}`;
               }
            }
         }

         for (const node of program.body) {
            switch (node.type) {
               case "ExportNamedDeclaration": {
                  if (node.source) {
                     await remap(node.source);
                  }
                  break;
               }
               case "ExportAllDeclaration": {
                  if (node.source) {
                     await remap(node.source);
                  }
                  break;
               }
               case "ImportDeclaration": {
                  if (node.source.value.startsWith(".")) {
                     await remap(node.source);
                  }
                  break;
               }
            }
         }
      } else {
         program = await Deno.readTextFile(input);
      }

      const { code } = await swc.transform(program, swc_options);
      await ensureFile(output);
      await Deno.writeTextFile(output, code);
   }

   public async css(input: string, output: string, files: string[]) {
      function reformatClassmap(classmap: Mapping) {
         const reformattedEntries = Object.entries(classmap).map(([k, v]) => {
            if (typeof v === "object") {
               v = reformatClassmap(v);
            }
            return [k.replaceAll("_", "-"), v];
         });
         return Object.fromEntries(reformattedEntries);
      }

      const buffer = await Deno.readTextFile(input);
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
      await ensureFile(output);
      await Deno.writeTextFile(output, p.css);
   }
}
