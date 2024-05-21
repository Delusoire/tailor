import path from "node:path";
import fs from "node:fs/promises";
import open from "open";
import debounce from "lodash/debounce.js";
const reloadSpotifyDocument = debounce(() => open("spotify:app:rpc:reload"), 3000);
async function* fs_walk(dir) {
    for await (const d of await fs.opendir(dir, {})) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory())
            yield* fs_walk(entry);
        else if (d.isFile())
            yield entry;
    }
}
export class Builder {
    transpiler;
    outDir;
    cssEntry;
    static jsGlob = "./**/*.{ts,mjs,jsx,tsx}";
    constructor(transpiler, metadata, outDir = ".") {
        this.transpiler = transpiler;
        this.outDir = outDir;
        this.cssEntry = metadata.entries.css?.replace(/\.css$/, ".scss");
    }
    async build(input) {
        const ps = [];
        for await (const file of fs_walk(input)) {
            ps.push(this.buildFile(file));
        }
        return Promise.all(ps);
    }
    getRelPath(p) {
        return path.join(this.outDir, p);
    }
    js(input) {
        const output = this.getRelPath(input.replace(/\.[^\.]+$/, ".js"));
        return this.transpiler.js(input, output);
    }
    css() {
        const input = this.cssEntry;
        const output = this.getRelPath(input.replace(/\.[^\.]+$/, ".css"));
        return this.transpiler.css(input, output, [Builder.jsGlob]);
    }
    copyFile(input) {
        const output = this.getRelPath(input);
        return fs.copyFile(input, output);
    }
    async buildFile(file, reload = false) {
        switch (path.extname(file)) {
            case ".scss": {
                if (reload || file.endsWith(this.cssEntry)) {
                    await this.css();
                    reload && reloadSpotifyDocument();
                }
                break;
            }
            case ".ts":
                if (file.endsWith(".d.ts")) {
                    break;
                }
            case ".mjs":
            case ".jsx":
            case ".tsx": {
                await this.js(file);
                reload && reloadSpotifyDocument();
                break;
            }
            default: {
                await this.copyFile(file);
                break;
            }
        }
    }
}
