#!/usr/bin/env node
import fs from "node:fs/promises";
import { Builder, Watcher } from "./build.js";
import { Transpiler } from "./transpile.js";
async function readJSON(path) {
    const file = await fs.readFile(path, "utf-8");
    return JSON.parse(file);
}
async function buildAndWatch({ classmap, metadata }) {
    const transpiler = new Transpiler(classmap);
    const builder = new Builder(metadata, transpiler);
    const watcher = new Watcher(builder);
    const timeStart = Date.now();
    await builder.js();
    await builder.css();
    console.log(`Build finished in ${(Date.now() - timeStart) / 1000}s!`);
    await watcher.watch();
}
// TODO: add cli options for these
const classmap = await readJSON("./classmap.json");
const metadata = await readJSON("./metadata.json");
await buildAndWatch({ classmap, metadata });
