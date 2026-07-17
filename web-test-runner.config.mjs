import { fileURLToPath } from 'url'
import { esbuildPlugin } from '@web/dev-server-esbuild'
import { playwrightLauncher } from '@web/test-runner-playwright'

/** @type {import("@web/test-runner").TestRunnerConfig} */
export default {
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: {
        timeout: 60000
      }
    }),
    playwrightLauncher({
      product: 'firefox',
      launchOptions: {
        timeout: 60000
      }
    }),
    playwrightLauncher({
      product: 'webkit',
      launchOptions: {
        timeout: 60000
      }
    })
  ],
  browserStartTimeout: 600000,
  nodeResolve: true,
  files: "./src/tests/unit/**/*_tests.js",
  testFramework: {
    config: {
      ui: "tdd"
    }
  },
  plugins: [
    // target must match tsconfig's `target`. At es2020 esbuild downlevels the
    // #private fields used across 19 source files into WeakMap shims, so the
    // unit tests would exercise different code from the shipped bundle.
    esbuildPlugin({
      ts: true,
      target: "es2022",
      tsconfig: fileURLToPath(new URL("./tsconfig.json", import.meta.url))
    })
  ]
}