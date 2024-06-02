import pkg from "./deno.json" with { type: "json" };

import path from "node:path";

import { type Metadata, Builder } from "./build.ts";
import { Transpiler, type Mapping } from "./transpile.ts";

import yargs from 'npm:yargs@17.7.2';
import { build, readJSON, watch, writeClassMapDts } from "./util.ts";

const argv = await yargs(Deno.args)
   .version(pkg.version)
   .usage("tailor is to bespoke as chef is to gourmet")
   .option("c", {
      alias: "classmap",
      type: "string",
      default: "classmap.json",
      desc: "path to classmap"
   })
   .option("i", {
      alias: "input",
      type: "string",
      default: ".",
      desc: "input folder"
   })
   .option("o", {
      alias: "output",
      type: "string",
      default: ".",
      desc: "output folder"
   })
   .option("copy", {
      type: "boolean",
      default: false,
      desc: "copy unsupported files"
   })
   .option("d", {
      alias: "declaration",
      type: "boolean",
      default: false,
      desc: "emit declaration"
   })
   .option("b", {
      alias: "build",
      type: "boolean",
      default: false,
      desc: "build and apply classmap"
   })
   .option("w", {
      alias: "watch",
      type: "boolean",
      default: false,
      desc: "watch for file changes"
   })
   .parse();

const classmap = await readJSON<Mapping>(argv.c);
const metadata = await readJSON<Metadata>(path.join(argv.i, "metadata.json"));

if (argv.d) {
   await writeClassMapDts(classmap);
}

const transpiler = new Transpiler(classmap);
const builder = new Builder(transpiler, {
   metadata,
   outDir: argv.o,
   copyUnknown: argv.copy
});

if (argv.b) {
   await build(builder, argv.i);
}
if (argv.w) {
   await watch(builder);
}
