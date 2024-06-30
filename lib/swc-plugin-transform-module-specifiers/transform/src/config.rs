use serde::Deserialize;
use swc_cached::regex::CachedRegex;

type Rules = Vec<(CachedRegex, String)>;

#[derive(Clone, Debug, Deserialize)]
pub struct PluginConfig {
    #[serde(default)]
    pub rules: Rules,
}
