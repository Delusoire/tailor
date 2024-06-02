use crate::config::{Mapping, PluginConfig};

use swc_core::common::SyntaxContext;
use swc_core::ecma::ast::{Expr, Lit, MemberProp};
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut, VisitMutWith};

pub struct TransformVisitor {
    pub config: PluginConfig,
    pub unresolved_ctx: SyntaxContext,
}

impl TransformVisitor {
    fn apply_mapping_recur_rtl(
        &self,
        expr: &Box<Expr>,
        idents: &mut Vec<String>,
    ) -> Result<Option<String>, String> {
        match &**expr {
            Expr::Ident(i) => {
                if i.span.ctxt != self.unresolved_ctx {
                    return Ok(None);
                }
                let mut last_ident = 0;
                idents.push(i.sym.to_string());
                let fcm = idents.iter().rev().fold(
                    Some(&self.config.mapping),
                    |omv: Option<&Mapping>, ident| {
                        if let Some(&Mapping::Map(map)) = omv.as_ref() {
                            let nomv = map.get(ident);
                            if nomv.is_some() {
                                last_ident += 1;
                            }
                            return nomv;
                        }
                        None
                    },
                );

                if last_ident == 0 {
                    return Ok(None);
                }

                if last_ident != idents.len() {
                    let problematic_ident = idents[..=last_ident].join(".");
                    return Err(format!(
                        "{} isn't a node of the provided mapping",
                        problematic_ident
                    ));
                }

                if let &Mapping::Str(s) = fcm.as_ref().unwrap() {
                    return Ok(Some(s.to_string()));
                }

                let problematic_ident = idents.join(".");
                return Err(format!(
                    "{} isn't an ending node (leaf) of the provided mapping",
                    problematic_ident
                ));
            }
            Expr::Member(m) => {
                if let MemberProp::Ident(i) = &m.prop {
                    idents.push(i.sym.to_string());
                    return self.apply_mapping_recur_rtl(&m.obj, idents);
                }
            }
            _ => {}
        }
        Ok(None)
    }

    fn apply_mapping(&self, expr: &Box<Expr>) -> Option<Box<Expr>> {
        let mut idents = Vec::new();
        self.apply_mapping_recur_rtl(expr, &mut idents)
            .unwrap()
            .map(|s| Box::new(Expr::Lit(Lit::Str(s.into()))))
    }
}

impl VisitMut for TransformVisitor {
    noop_visit_mut_type!();

    fn visit_mut_expr(&mut self, n: &mut Expr) {
        if let Some(e) = self.apply_mapping(&Box::new(n.clone())) {
            *n = *e
        } else {
            n.visit_mut_children_with(self)
        }
    }
}
