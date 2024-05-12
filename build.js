import path from "node:path";
import fs from "node:fs/promises";
import open from "open";
import debounce from "lodash/debounce.js";
import { Transpiler } from "./transpile.js";
const reloadSpotifyDocument = debounce(() => open("spotify:app:rpc:reload"), 3000);
export class Builder {
    metadata;
    transpiler;
    cssEntry;
    static jsGlob = "./**/*.{ts,tsx}";
    constructor(metadata, transpiler) {
        this.metadata = metadata;
        this.transpiler = transpiler;
        this.cssEntry = metadata.entries.css?.replace(/\.css$/, ".scss");
    }
    async js(files) {
        if (!files) {
            files = await Array.fromAsync(fs.glob(Builder.jsGlob));
            files = files.filter(f => !f.includes("node_modules"));
        }
        return Promise.all(files.map(file => this.transpiler.js(file)));
    }
    async css() {
        if (!this.cssEntry) {
            return;
        }
        return this.transpiler.css(this.cssEntry, [Builder.jsGlob]);
    }
}
export class Watcher {
    builder;
    constructor(builder) {
        this.builder = builder;
    }
    async onFsFileChange(event) {
        switch (path.extname(event.filename)) {
            case ".scss": {
                await this.builder.css();
                reloadSpotifyDocument();
                break;
            }
            case ".ts":
            case ".tsx": {
                await this.builder.js([event.filename]);
                reloadSpotifyDocument();
                break;
            }
        }
    }
    async watch() {
        console.log("Watching for changes...");
        const watcher = fs.watch(".", { recursive: true });
        for await (const event of watcher) {
            console.log(`${event.filename} was ${event.eventType}d`);
            await this.onFsFileChange(event);
        }
    }
}
