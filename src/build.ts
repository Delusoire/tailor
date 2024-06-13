import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "jsr:@std/fs@0.229.3/ensure-dir";

import { walk } from "jsr:@std/fs@0.229.3/walk";
import type { Transpiler } from "./transpile.ts";

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

   private onBuildPre(type: FileType, absFile: string) {
      if (type === FileType.CSS) {
         return absFile === this.scssInput;
      }
      return true;
   }

   public async buildFile(file: string, onBuildPre?: (type: FileType, absFile: string) => boolean, onBuildPost?: () => void) {
      const relFile = this.getRelativePath(file);
      if (relFile.includes("node_modules")) {
         return;
      }
      onBuildPre ??= this.onBuildPre.bind(this);
      const type = parseFileType(file);
      const absFile = this.getAbsolutePath(relFile);
      if (!onBuildPre(type, absFile)) {
         return;
      }
      switch (type) {
         case FileType.JS:
            await this.js(relFile);
            break;
         case FileType.CSS:
            await this.css();
            break;
         case FileType.UNKNOWN:
            this.copyUnknown && await this.copyFile(relFile);
            break;
      }
      onBuildPost?.();
   }
}

enum FileType {
   JS,
   CSS,
   UNKNOWN
}

function parseFileType(relFile: string): FileType {
   switch (path.extname(relFile)) {
      // deno-lint-ignore no-fallthrough
      case ".ts":
         if (relFile.endsWith(".d.ts")) {
            break;
         }
      case ".mjs":
      case ".jsx":
      case ".tsx": {
         return FileType.JS;
      }
      case ".scss": {
         return FileType.CSS;
      }
   }
   return FileType.UNKNOWN;
}
