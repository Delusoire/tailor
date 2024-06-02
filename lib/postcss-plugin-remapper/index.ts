/* Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type postcss from "npm:postcss@8.4.38";
import selectorParser from "npm:postcss-selector-parser@6.1.0";

// @ts-ignore recursive type
export type Mapping = Record<string, string | Mapping>;


export interface Options {
   mapping: Mapping;
}

export default function ({ mapping }: Options): postcss.AcceptedPlugin {
   return {
      postcssPlugin: "postcss-remapper",
      prepare() {
         function renameNode(node: selectorParser.ClassName) {
            const idents = node.value.split("__");
            let lastIdent = 0;
            const newName = idents.reduce((mapping, ident) => {
               if (mapping && ident in mapping) {
                  lastIdent++;
                  return mapping[ident];
               }
            }, mapping);

            if (!lastIdent) {
               return;
            }

            if (lastIdent !== idents.length) {
               const problematicIdent = idents.slice(0, lastIdent + 1).join("__");
               throw new Error(`${problematicIdent} isn't a node of the provided mapping`);
            }

            if (typeof newName !== "string") {
               const problematicIdent = idents.join("__");
               throw new Error(`${problematicIdent} isn't an ending node (leaf) of the provided mapping`);
            }

            node.value = newName;
         }

         const selectorProcessor = selectorParser(selectors => {
            selectors.walkClasses(renameNode);
         });

         return {
            Rule(ruleNode: any) {
               if (ruleNode.parent.type !== "atrule" || !ruleNode.parent.name.endsWith("keyframes")) {
                  selectorProcessor.process(ruleNode);
               }
            },
         };
      },
   };
}
