use std::collections::HashMap;

use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub enum Mapping {
    Str(String),
    Map(HashMap<String, Mapping>),
}

impl Default for Mapping {
    fn default() -> Self {
        Mapping::Map(Default::default())
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct PluginConfig {
    #[serde(default)]
    pub mapping: Mapping,
}
