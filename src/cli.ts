import pkg from "./deno.json" with { type: "json" };

import path from "node:path";

import { Builder, type Metadata } from "./build.ts";
import { Transpiler, type Mapping } from "./transpile.ts";

// @deno-types="npm:@types/yargs@17.0.32"
import yargs from 'npm:yargs@17.7.2';
import { build, readJSON, watch, writeClassMapDts } from "./util.ts";

const argv = await yargs(Deno.args)
   .version(pkg.version)
   .usage("tailor is to bespoke as chef is to gourmet")
   .option("c", {
      alias: "classmap",
      type: "string",
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
   .option("debounce", {
      type: "number",
      default: Number.NEGATIVE_INFINITY,
      desc: "debounce time for reloading spotify (default is disabled)"
   })
   .option("module", {
      type: "string",
      desc: "module identifier",
      demandOption: true
   })
   .option("dev", {
      type: "boolean",
      default: false
   })
   .parse();

let classmap: Mapping = {};
if (argv.c) {
   console.log("Loading classmap...");
   classmap = await readJSON<Mapping>(argv.c);
}
const metadata = await readJSON<Metadata>(path.join(argv.i, "metadata.json"));

if (argv.d) {
   await writeClassMapDts(classmap);
}

const transpiler = new Transpiler(classmap, argv.dev);
const builder = new Builder(transpiler, {
   metadata,
   identifier: argv.module,
   inputDir: argv.i,
   outputDir: argv.o,
});

if (argv.b) {
   await build(builder, { js: true, css: true, unknown: argv.copy });
}
if (argv.w) {
   await watch(builder, argv.debounce);
}
