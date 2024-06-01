export default function () {
   return import.meta.resolve("./target/wasm32-wasi/release/swc_remapper.wasm").slice(8);
}
