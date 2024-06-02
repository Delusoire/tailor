mod config;
mod visitor;

use config::PluginConfig;
use swc_core::{
    common::SyntaxContext,
    ecma::{
        ast::Program,
        visit::{as_folder, FoldWith},
    },
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};
use visitor::TransformVisitor;

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let config = serde_json::from_str::<PluginConfig>(
        &metadata
            .get_transform_plugin_config()
            .expect("failed to get plugin config"),
    )
    .expect("invalid config");
    let unresolved_ctx = SyntaxContext::empty().apply_mark(metadata.unresolved_mark);
    program.fold_with(&mut as_folder(TransformVisitor {
        config,
        unresolved_ctx,
    }))
}
