import path from "node:path";

import { ensureFile } from "jsr:@std/fs@1.0.0-rc.2/ensure-file";
import { expandGlobSync } from "jsr:@std/fs@1.0.0-rc.2/expand-glob";
import { walk } from "jsr:@std/fs@1.0.0-rc.2/walk";

import type { Transpiler } from "./transpile.ts";

export type Metadata = any;

export interface BuilderOpts {
	metadata: Metadata;
	identifier: string;
	inputDir: string;
	outputDir: string;
}

export interface BuildOpts {
	js?: boolean;
	css?: boolean;
	unknown?: boolean;
}

export class Builder {
	scriptsInput?: Array<string>;
	scssInput?: string;
	identifier: string;
	inputDir: string;
	outputDir: string;

	private static jsGlob = "./**/*.{ts,mjs,jsx,tsx}";

	public constructor(private transpiler: Transpiler, opts: BuilderOpts) {
		this.identifier = opts.identifier;
		this.inputDir = opts.inputDir;
		this.outputDir = opts.outputDir;

		const { js, css } = opts.metadata.entries;
		if (js) {
			const scriptWalkEntries = Array.from(
				expandGlobSync(Builder.jsGlob, {
					root: this.inputDir,
					includeDirs: false,
				}),
			);
			this.scriptsInput = scriptWalkEntries.map((entry) => entry.path);
		}
		if (css) {
			const cssInput = this.getAbsolutePath(css);
			this.scssInput = cssInput.replace(/\.css$/, ".scss");
		}
	}

	public async build(opts: BuildOpts = {}): Promise<void> {
		const now = Date.now();

		const scriptsInput = [];
		const unknownFiles = [];

		const ps = [];
		{
			const walker = walk(this.inputDir, { includeDirs: false });
			for await (const file of walker) {
				const path = file.path;
				const relFile = this.getRelativePath(path);
				const type = parseFileType(path);
				switch (type) {
					case FileType.ToJS:
						scriptsInput.push(path);
						break;
					case FileType.UNKNOWN:
						unknownFiles.push(relFile);
						break;
				}
			}

			if (opts.js && this.scriptsInput) {
				ps.push(this.js(scriptsInput, now));
			}
			if (opts.css && this.scssInput) {
				ps.push(this.css(this.scssInput));
			}
			if (opts.unknown) {
				ps.push(...unknownFiles.map((f) => this.copyFile(f)));
			}
		}

		if (ps.length) {
			const timestamp = this.getOutputPath("timestamp");
			if (this.transpiler.dev) {
				await ensureFile(timestamp);
				await Deno.writeTextFile(timestamp, String(now));
			} else {
				try {
					await Deno.remove(timestamp);
				} catch (error) {
					if (!(error instanceof Deno.errors.NotFound)) {
						throw error;
					}
				}
			}
			await Promise.all(ps);
		}
	}

	public getRelativePath(abs: string): string {
		return path.relative(this.inputDir, abs);
	}

	public getAbsolutePath(rel: string): string {
		return path.resolve(this.inputDir, rel);
	}

	public getInputPath(relToProj: string): string {
		return path.join(this.inputDir, relToProj);
	}

	public getOutputPath(relToProj: string): string {
		return path.join(this.outputDir, relToProj);
	}

	public async js(inputs: string[], timestamp: number = 0): Promise<void> {
		for (const input of inputs) {
			const rel = this.getRelativePath(input);
			const relJs = rel.slice(0, rel.lastIndexOf(".")) + ".js";
			const output = this.getOutputPath(relJs);
			const filepath = `/modules${this.identifier}/${relJs}`;
			await this.transpiler.js(
				input,
				output,
				this.inputDir,
				filepath,
				timestamp,
			);
		}
	}

	public async css(input: string): Promise<void> {
		const rel = this.getRelativePath(input);
		const relCss = rel.slice(0, rel.lastIndexOf(".")) + ".css";
		const output = this.getOutputPath(relCss);
		await this.transpiler.css(
			input,
			output,
			Array.from(this.scriptsInput ?? []),
		);
	}

	public async copyFile(rel: string): Promise<void> {
		const input = this.getInputPath(rel);
		const output = this.getOutputPath(rel);
		await ensureFile(output);
		await Deno.copyFile(input, output);
	}
}

export enum FileType {
	ToJS,
	ToCSS,
	JS,
	CSS,
	UNKNOWN,
}

export function parseFileType(relFile: string): FileType {
	switch (path.extname(relFile)) {
		case ".js": {
			return FileType.JS;
		}
		// deno-lint-ignore no-fallthrough
		case ".ts":
			if (relFile.endsWith(".d.ts")) {
				break;
			}
		case ".mjs":
		case ".jsx":
		case ".tsx": {
			return FileType.ToJS;
		}
		case ".css": {
			return FileType.CSS;
		}
		case ".scss": {
			return FileType.ToCSS;
		}
	}
	return FileType.UNKNOWN;
}
