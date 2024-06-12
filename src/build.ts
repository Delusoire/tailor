import fs from "node:fs/promises";
import path from "node:path";

import debounce from "npm:lodash@4.17.21/debounce.js";
import open from "npm:open@10.1.0";
import type { Transpiler } from "./transpile.ts";

const reloadSpotifyDocument = debounce(() => open("spotify:app:rpc:reload"), 3000);

export type Metadata = any;

async function* fs_walk(dir: string): AsyncGenerator<string> {
   for await (const d of await fs.opendir(dir, { bufferSize: 32 })) {
      const entry = path.join(dir, d.name);
      if (d.isDirectory()) yield* fs_walk(entry);
      else if (d.isFile()) yield entry;
   }
}


export interface BuilderOpts {
   metadata: Metadata;
   inputDir: string;
   outputDir: string;
   copyUnknown: boolean;
}

export class Builder {
   cssEntry?: string;
   inputDir: string;
   outputDir: string;
   copyUnknown: boolean;

   private static jsGlob = "./**/*.{ts,mjs,jsx,tsx}";

   public constructor(private transpiler: Transpiler, opts: BuilderOpts) {
      this.inputDir = opts.inputDir;
      this.outputDir = opts.outputDir;
      this.copyUnknown = opts.copyUnknown;

      const { css } = opts.metadata.entries;
      const scss = css?.replace(/\.css$/, ".scss");
      if (scss) {
         this.cssEntry = path.resolve(this.inputDir, scss);
      }

      transpiler.init(this.inputDir);
   }

   public async build(): Promise<void[]> {
      const ps = [];
      for await (const file of fs_walk(this.inputDir)) {
         ps.push(this.buildFile(file));
      }
      return Promise.all(ps);
   }

   private getRelPath(p: string) {
      return path.join(this.outputDir, p);
   }

   public js(input: string): Promise<void> {
      const output = this.getRelPath(input.replace(/\.[^\.]+$/, ".js"));
      return this.transpiler.js(input, output);
   }

   public css(): Promise<void> {
      const input = this.cssEntry;
      if (!input) {
         return Promise.reject("couldn't find an entrypoint for css");
      }
      const output = this.getRelPath(input.replace(/\.[^\.]+$/, ".css"));
      return this.transpiler.css(input, output, [Builder.jsGlob]);
   }

   public async buildFile(file: string, reload = false) {
      const absFile = path.resolve(this.inputDir, file);
      const relFile = path.relative(this.inputDir, file);
      if (relFile.includes("node_modules")) {
         return;
      }
      switch (path.extname(file)) {
         case ".scss": {
            if (reload || absFile === this.cssEntry) {
               await this.css();
               reload && reloadSpotifyDocument();
            }
            break;
         }
         // deno-lint-ignore no-fallthrough
         case ".ts":
            if (file.endsWith(".d.ts")) {
               break;
            }
         case ".mjs":
         case ".jsx":
         case ".tsx": {
            await this.js(relFile);
            reload && reloadSpotifyDocument();
            break;
         }
         default: {
            if (this.copyUnknown) {
               await fs.copyFile(file, this.getRelPath(relFile));
            }
            break;
         }
      }
   }
}
