import open from "npm:open@10.1.0";

import {
	type Builder,
	type BuildOpts,
	FileType,
	parseFileType,
} from "./build.ts";
import type { Mapping } from "./transpile.ts";

export async function readJSON<T>(path: string): Promise<T> {
	const file = await Deno.readTextFile(path);
	return JSON.parse(file) as T;
}

export function genClassMapDts(mapping: Mapping): string {
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
	return dts;
}

function createPromise<T>(): PromiseWithResolvers<T> & { resolved: boolean } {
	return Object.assign(Promise.withResolvers<T>(), {
		resolved: false,
	});
}

type Task = () => Promise<void>;
type DebouncedTask = (delay: number) => Promise<void>;
export const debounceTask = (task: Task): DebouncedTask => {
	let p = createPromise<void>();
	let currentWaitUntil = Date.now();

	let timeoutId: number | null;
	return (delay: number) => {
		const waitUntil = Date.now() + delay;
		if ((timeoutId && !p.resolved) || currentWaitUntil >= waitUntil) {
			return p.promise;
		}
		currentWaitUntil = waitUntil;
		timeoutId && clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			timeoutId = null;

			task()
				.then(() => p.resolve())
				.catch((e) => p.reject(e))
				.finally(() => {
					p.resolved = true;

					p = createPromise<void>();
					currentWaitUntil = Date.now();
				});
		}, delay);
		return p.promise;
	};
};

export const getDebouncedReloadModuleTask: (
	module?: string | undefined | null,
) => DebouncedTask = (module?: string | undefined | null) => {
	const reloadRpcScheme = "spotify:app:rpc:reload";
	const url = module == null
		? reloadRpcScheme
		: `${reloadRpcScheme}?module=${module}`;
	return debounceTask(() => open(url) as Promise<any>);
};

export async function build(builder: Builder, opts: BuildOpts = {}) {
	const timeStart = Date.now();

	await builder.build(opts);

	console.log(`Build finished in ${(Date.now() - timeStart) / 1000}s!`);
}

export async function watch(builder: Builder, debounce: number) {
	console.log("Watching for changes...");

	const module = builder.identifier;

	const reload = async () => {
		const reloadRpcScheme = "spotify:app:rpc:reload";
		const url = module == null
			? reloadRpcScheme
			: `${reloadRpcScheme}?module=${module}`;
		await open(url);
	};

	const opts: BuildOpts = {};

	const debouncedBuild = debounceTask(async () => {
		console.log("Building...");
		await build(builder, opts);
		await reload();
		opts.js = opts.css = false;
	});

	const watcher = Deno.watchFs(builder.inputDir);
	for await (const event of watcher) {
		for (const file of event.paths) {
			if (event.kind !== "modify") {
				continue;
			}

			const type = parseFileType(file);
			if (type === FileType.ToJS) {
				opts.js = true;
			} else if (type === FileType.ToCSS) {
				opts.css = true;
			}

			console.log(`Building ${file}...`);
			debouncedBuild(debounce);
		}
	}
}
