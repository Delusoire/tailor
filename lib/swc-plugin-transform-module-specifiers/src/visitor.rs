use crate::config::PluginConfig;

use swc_core::ecma::ast::{
    CallExpr, Callee, ExportAll, Expr, ExprOrSpread, ImportDecl, Lit, NamedExport, Str,
};
use swc_core::ecma::visit::{VisitMut, VisitMutWith};

pub struct TransformVisitor {
    pub config: PluginConfig,
}

impl TransformVisitor {
    fn rewrite_extension(&self, filename: &str) -> Option<String> {
        self.config
            .extensions
            .iter()
            .find_map(|(ext1, ext2)| Some(filename.strip_suffix(ext1)?.to_string() + ext2.as_str()))
    }

    fn rewrite_import_specifier(&self, specifier: &str) -> Option<String> {
        let source_specifier = specifier;

        let new_specifier = self.rewrite_extension(specifier)?;

        if new_specifier == source_specifier {
            return None;
        }

        Some(new_specifier)
    }
}

impl VisitMut for TransformVisitor {
    fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
        n.visit_mut_children_with(self);

        if let Some(remapped) = self.rewrite_import_specifier(n.src.value.as_str()) {
            n.src = Box::new(remapped.into());
        }
    }

    fn visit_mut_named_export(&mut self, n: &mut NamedExport) {
        n.visit_mut_children_with(self);

        if let Some(src) = &n.src {
            if let Some(remapped) = self.rewrite_import_specifier(src.value.as_str()) {
                n.src = Some(Box::new(remapped.into()));
            }
        }
    }

    fn visit_mut_export_all(&mut self, n: &mut ExportAll) {
        n.visit_mut_children_with(self);

        if let Some(remapped) = self.rewrite_import_specifier(n.src.value.as_str()) {
            n.src = Box::new(remapped.into());
        }
    }

    fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
        n.visit_mut_children_with(self);

        if let Callee::Import(_) = n.callee {
            if let Some(arg) = n.args.first() {
                if let Expr::Lit(Lit::Str(lit_str)) = *arg.expr.clone() {
                    let maybe_rewritten = self.rewrite_import_specifier(&lit_str.value);
                    if let Some(rewritten) = maybe_rewritten {
                        let replacer = Expr::Lit(Lit::Str(Str {
                            span: lit_str.span,
                            value: rewritten.into(),
                            raw: None,
                        }));
                        n.args[0] = ExprOrSpread {
                            spread: None,
                            expr: Box::new(replacer),
                        };
                    }
                }
            }
        }
    }
}
