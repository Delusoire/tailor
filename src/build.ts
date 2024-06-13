import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "jsr:@std/fs@0.229.3/ensure-dir";

import debounce from "npm:lodash@4.17.21/debounce.js";
import open from "npm:open@10.1.0";

import type { Transpiler } from "./transpile.ts";
import { walk } from "jsr:@std/fs@0.229.3/walk";

const reloadSpotifyDocument = debounce(() => open("spotify:app:rpc:reload"), 3000);

export type Metadata = any;

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
      const walker = walk(this.inputDir, { includeDirs: false });
      for await (const file of walker) {
         ps.push(this.buildFile(file.path));
      }
      return Promise.all(ps);
   }

   public getRelativePath(abs: string): string {
      return path.relative(this.inputDir, abs);
   }

   public getAbsolutePath(rel: string): string {
      return path.resolve(this.inputDir, rel);
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

   public async copyFile(rel: string): Promise<void> {
      const input = this.getInputPath(rel);
      const output = this.getOutputPath(rel);
      await ensureDir(path.dirname(output));
      await fs.copyFile(input, output);
   }

   public async buildFile(relFile: string, opts?: { reload?: boolean; log?: boolean; }) {
      const { reload = false, log = false } = opts ?? {};

      const absFile = this.getAbsolutePath(relFile);
      if (relFile.includes("node_modules")) {
         return;
      }
      switch (path.extname(relFile)) {
         case ".scss": {
            if (reload || absFile === this.scssInput) {
               log && console.log("building css", relFile);
               await this.css();
               reload && reloadSpotifyDocument();
            }
            break;
         }
         // deno-lint-ignore no-fallthrough
         case ".ts":
            if (relFile.endsWith(".d.ts")) {
               break;
            }
         case ".mjs":
         case ".jsx":
         case ".tsx": {
            log && console.log("building js", relFile);
            await this.js(relFile);
            reload && reloadSpotifyDocument();
            break;
         }
         default: {
            log && console.log("copying", relFile);
            this.copyUnknown && await this.copyFile(relFile);
            break;
         }
      }
   }
}
