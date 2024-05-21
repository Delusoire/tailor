#!/usr/bin/env node
import fs from "node:fs/promises";
import { Builder } from "./build.js";
import { Transpiler } from "./transpile.js";
async function readJSON(path) {
    const file = await fs.readFile(path, "utf-8");
    return JSON.parse(file);
}
function writeClassMapDts(classmap) {
    function genType(obj) {
        let s = "";
        for (const [k, v] of Object.entries(obj)) {
            s += `"${k}":`;
            if (typeof v === "string") {
                s += `"${v}"`;
            }
            else if (Object.getPrototypeOf(v) === Object.prototype) {
                s += genType(v);
            }
            else {
                s += "unknown";
            }
            s += ",";
        }
        return `{${s}}`;
    }
    const dts = `/* Bespoke Tailored Classmap (BTC) */

declare const CLASSMAP = ${genType(classmap)} as const;
`;
    return fs.writeFile("./classmap.d.ts", dts);
}
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from "node:path";
const argv = await yargs(hideBin(process.argv))
    .version()
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
    .option("w", {
    alias: "watch",
    type: "boolean",
    default: false,
    desc: "watch for file changes"
})
    .parse();
const classmap = await readJSON(argv.c);
const metadata = await readJSON(path.join(argv.i, "metadata.json"));
await writeClassMapDts(classmap);
const transpiler = new Transpiler(classmap);
const builder = new Builder(transpiler, {
    metadata,
    outDir: argv.o,
    copyUnknown: argv.copy
});
async function build() {
    const timeStart = Date.now();
    await builder.build(argv.i);
    console.log(`Build finished in ${(Date.now() - timeStart) / 1000}s!`);
}
async function watch() {
    console.log("Watching for changes...");
    const watcher = fs.watch(".", { recursive: true });
    for await (const event of watcher) {
        console.log(`${event.filename} was ${event.eventType}d`);
        await builder.buildFile(event.filename, true);
    }
}
await build();
if (argv.w) {
    await watch();
}
