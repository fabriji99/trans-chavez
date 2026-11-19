const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Necesario en un monorepo: Metro debe vigilar el workspace completo
// (el paquete @trans-chavez/shared vive fuera de apps/mobile) y resolver
// node_modules tanto locales como los hoisted en la raíz del workspace.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
