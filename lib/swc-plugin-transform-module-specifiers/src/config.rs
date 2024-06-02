use serde::Deserialize;

type Extensions = Vec<(String, String)>;

#[derive(Clone, Debug, Deserialize)]
pub struct PluginConfig {
    #[serde(default)]
    pub extensions: Extensions,
}
