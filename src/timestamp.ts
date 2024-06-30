const SPICETIFY_CONFIG_DIR = Deno.env.get("SPICETIFY_CONFIG_DIR");
const vault = await import(`${SPICETIFY_CONFIG_DIR}/modules/vault.json`, { with: { type: "json" } });
const modules = Object.keys(vault.default.modules).sort((a, b) => b.length - a.length);

function getModule(path: string) {
   path = path.slice("/modules".length);
   return modules.find((module) => path.startsWith(module));
}

export function getTimestamp(path: string) {
   const module = getModule(path);
   const timestamp = `./modules${module}/timestamp`;
   return Deno.readTextFile(timestamp).catch(() => null);
}
