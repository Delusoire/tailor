import path from "node:path";
import fs from "node:fs/promises";

import open from "open";

import debounce from "lodash/debounce.js";
import { Transpiler } from "./transpile.js";

const reloadSpotifyDocument = debounce(() => open("spotify:app:rpc:reload"), 3000);

export type Metadata = any;

export class Builder {
   cssEntry: string;

   private static jsGlob = "./**/*.{ts,tsx}";

   public constructor(private metadata: Metadata, private transpiler: Transpiler) {
      this.cssEntry = metadata.entries.css?.replace(/\.css$/, ".scss");
   }

   public async js(files?: string[]) {
      if (!files) {
         files = await Array.fromAsync(fs.glob(Builder.jsGlob));
         files = files.filter(f => !f.includes("node_modules"));
      }

      return Promise.all(files.map(file => this.transpiler.js(file)));
   }

   public async css() {
      if (!this.cssEntry) {
         return;
      }

      return this.transpiler.css(this.cssEntry, [Builder.jsGlob]);
   }
}

export class Watcher {
   constructor(private builder: Builder) {}

   private async onFsFileChange(event: fs.FileChangeInfo<string>) {
      switch (path.extname(event.filename!)) {
         case ".scss": {
            await this.builder.css();
            reloadSpotifyDocument();
            break;
         }
         case ".ts":
         case ".tsx": {
            await this.builder.js([event.filename!]);
            reloadSpotifyDocument();
            break;
         }
      }
   }

   public async watch() {
      console.log("Watching for changes...");
      const watcher = fs.watch(".", { recursive: true });
      for await (const event of watcher) {
         console.log(`${event.filename} was ${event.eventType}d`);
         await this.onFsFileChange(event);
      }
   }
}
