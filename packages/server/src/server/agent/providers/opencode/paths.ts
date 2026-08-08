import path from "node:path";

import { resolveVincuHome } from "../../../vincu-home.js";

const OPENCODE_HOME_DIRNAME = "opencode-home";

export function resolveOpenCodeHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveVincuHome(env), OPENCODE_HOME_DIRNAME);
}
