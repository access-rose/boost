import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript"

import { version } from "./package.json"
const year = new Date().getFullYear()
const banner = `/*!\nTurbo ${version}\nCopyright © ${year} 37signals LLC\n */`

export default [
  {
    input: "src/index.ts",
    output: [
      {
        name: "Turbo",
        file: "dist/turbo.es2017-umd.js",
        format: "umd",
        banner
      },
      {
        file: "dist/turbo.es2017-esm.js",
        format: "esm",
        banner
      }
    ],
    plugins: [
      resolve({ extensions: [".ts", ".js"] }),
      typescript({
        // Declarations are emitted by the separate `tsc` pass in the `build`
        // script; here TypeScript only strips types for the bundle.
        declaration: false,
        emitDeclarationOnly: false,
        outDir: undefined,
        outputToFilesystem: false
      })
    ],
    watch: {
      include: "src/**"
    }
  }
]
