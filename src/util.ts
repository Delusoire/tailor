
import fs from "node:fs/promises";
import type { Builder } from "./build.ts";
import type { Mapping } from "./transpile.ts";

export async function readJSON<T>(path: string): Promise<T> {
   const file = await fs.readFile(path, "utf-8");
   return JSON.parse(file) as T;
}

export function writeClassMapDts(mapping: Mapping): Promise<void> {
   function genType(obj: any) {
      let s = "";

      for (const [k, v] of Object.entries(obj)) {
         s += `readonly "${k}":`;
         if (typeof v === "string") {
            s += `"${v}"`;
         } else if (Object.getPrototypeOf(v) === Object.prototype) {
            s += genType(v);
         } else {
            s += "unknown";
         }
         s += ",";
      }

      return `{${s}}`;
   }

   const dts = `/* Bespoke Tailored Classmap (BTC) */

declare const MAP: ${genType(mapping)};
`;

   console.log("Writing classmap declaration...");

   return fs.writeFile("./classmap.d.ts", dts);
}

import open from "npm:open@10.1.0";

type DebouncedTask = (delay: number) => void;

const debounceTask = (task: () => void): DebouncedTask => {
   let expireAfter = 0;
   let timeoutId: number | null;
   return (delay: number) => {
      const _expireAfter = Date.now() + delay;
      if (expireAfter >= _expireAfter) {
         return;
      }
      expireAfter = _expireAfter;
      timeoutId && clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
         timeoutId = null;
         task();
      }, delay);
   };
};

export const reloadSpotifyDocument: DebouncedTask = debounceTask(() => open("spotify:app:spicetify:reload"));

export async function build(builder: Builder) {
   const timeStart = Date.now();

   await builder.build();

   console.log(`Build finished in ${(Date.now() - timeStart) / 1000}s!`);
}

export async function watch(builder: Builder, debounce: number) {
   console.log("Watching for changes...");

   const onBuildPost = debounce === -1
      ? () => { }
      : () => {
         reloadSpotifyDocument(debounce);
      };

   const watcher = Deno.watchFs(builder.inputDir);
   for await (const event of watcher) {
      for (const file of event.paths) {
         if (event.kind !== "modify") {
            continue;
         }

         const onBuildPre = () => {
            console.log(`Building ${file}...`);
            return true;
         };

         await builder.buildFile(file, onBuildPre, onBuildPost);
      }
   }
}
