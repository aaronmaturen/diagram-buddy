import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");

// Build the plugin sandbox code (code.ts → dist/code.js)
// Figma's sandbox uses QuickJS which doesn't support ?? or ?. — target ES2015
const codeConfig = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2015",
  format: "iife",
  sourcemap: false,
};

// Build the UI as a self-contained HTML file.
// esbuild bundles the JS/CSS and inlines everything into a single HTML file.
const uiConfig = {
  entryPoints: ["src/ui.html"],
  bundle: true,
  outdir: "dist",
  target: "es2020",
  sourcemap: false,
  loader: {
    ".html": "copy",
  },
};

/**
 * Build the UI by:
 * 1. Bundling ui.ts → dist/ui.js
 * 2. Base64-encoding the JS
 * 3. Embedding it in the HTML via a script that decodes and evals it
 *
 * This avoids any escaping issues with large bundles inside <script> tags.
 */
function buildUI() {
  mkdirSync("dist", { recursive: true });

  const template = readFileSync("src/ui.html", "utf8");
  const uiJs = readFileSync("dist/ui.js", "utf8");

  // Base64-encode the JS to avoid any HTML parsing issues
  const b64 = Buffer.from(uiJs).toString("base64");

  const loaderScript = `<script>
    var s = document.createElement('script');
    s.textContent = atob("${b64}");
    document.body.appendChild(s);
  </script>`;

  const html = template.replace("<!-- INLINE_SCRIPT -->", loaderScript);

  writeFileSync("dist/ui.html", html);
  console.log("  dist/ui.html (base64 inlined)");
}

const uiBundleConfig = {
  entryPoints: ["src/ui.ts"],
  bundle: true,
  outfile: "dist/ui.js",
  target: "es2020",
  format: "iife",
  sourcemap: false,
};

async function build() {
  if (isWatch) {
    const codeCtx = await esbuild.context(codeConfig);
    const uiCtx = await esbuild.context({
      ...uiBundleConfig,
      plugins: [
        {
          name: "inline-ui-html",
          setup(build) {
            build.onEnd(() => {
              buildUI();
            });
          },
        },
      ],
    });

    await codeCtx.watch();
    await uiCtx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(codeConfig);
    console.log("  dist/code.js");

    await esbuild.build(uiBundleConfig);
    buildUI();

    console.log("Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
