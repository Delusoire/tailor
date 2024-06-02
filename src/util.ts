
import type { Mapping } from "./transpile.ts";
import fs from "node:fs/promises";
import type { Builder } from "./build.ts";


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

   return fs.writeFile("./classmap.d.ts", dts);
}

export async function build(builder: Builder, input: string) {
   const timeStart = Date.now();

   await builder.build(input);

   console.log(`Build finished in ${(Date.now() - timeStart) / 1000}s!`);
}

export async function watch(builder: Builder) {
   console.log("Watching for changes...");

   const watcher = fs.watch(".", { recursive: true });
   for await (const event of watcher) {
      console.log(`${event.filename} was ${event.eventType}d`);
      await builder.buildFile(event.filename!, true);
   }
}
