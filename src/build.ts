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
   scssInput?: string;
   cssOutput?: string;
   inputDir: string;
   outputDir: string;
   copyUnknown: boolean;

   private static jsGlob = "./**/*.{ts,mjs,jsx,tsx}";

   public constructor(private transpiler: Transpiler, opts: BuilderOpts) {
      this.inputDir = opts.inputDir;
      this.outputDir = opts.outputDir;
      this.copyUnknown = opts.copyUnknown;

      const { css } = opts.metadata.entries;
      if (css) {
         const cssInput = path.resolve(this.inputDir, css);
         const relFile = path.relative(this.inputDir, cssInput);

         this.scssInput = cssInput.replace(/\.css$/, ".scss");
         this.cssOutput = path.resolve(this.outputDir, relFile);
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

   private getInputPath(rel: string) {
      return path.join(this.inputDir, rel);
   }

   private getOutputPath(rel: string) {
      return path.join(this.outputDir, rel);
   }

   public js(rel: string): Promise<void> {
      const input = this.getInputPath(rel);
      const output = this.getOutputPath(rel.replace(/\.[^\.]+$/, ".js"));
      return this.transpiler.js(input, output);
   }

   public css(): Promise<void> {
      if (!this.scssInput || !this.cssOutput) {
         return Promise.reject("couldn't find an entrypoint for css");
      }
      return this.transpiler.css(this.scssInput, this.cssOutput, [Builder.jsGlob]);
   }

   public copyFile(rel: string): Promise<void> {
      const input = this.getInputPath(rel);
      const output = this.getOutputPath(rel);
      return fs.copyFile(input, output);
   }

   public async buildFile(file: string, reload = false) {
      const absFile = path.resolve(this.inputDir, file);
      const relFile = path.relative(this.inputDir, file);
      if (relFile.includes("node_modules")) {
         return;
      }
      switch (path.extname(file)) {
         case ".scss": {
            if (reload || absFile === this.scssInput) {
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
            this.copyUnknown && await this.copyFile(relFile);
            break;
         }
      }
   }
}
