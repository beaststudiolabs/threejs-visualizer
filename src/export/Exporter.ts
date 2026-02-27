import { strToU8, zipSync } from "fflate";
import type { PresetV1 } from "../contracts/types";

const TEMPLATE_FILES: Record<string, string> = {
  "README.md": "# Exported PARTICLE WIZARD Project\n\nRun `pnpm install` and `pnpm dev`.\n",
  "package.json": JSON.stringify(
    {
      name: "particle-wizard-export",
      private: true,
      scripts: {
        dev: "echo 'Project exported from PARTICLE WIZARD'"
      }
    },
    null,
    2
  ),
  "src/preset.json": "__PRESET_JSON__"
};

export type ExportManifest = {
  files: string[];
  blob: Blob;
};

export class Exporter {
  exportProjectZip(preset: PresetV1): ExportManifest {
    const payload: Record<string, Uint8Array> = {};

    for (const [path, content] of Object.entries(TEMPLATE_FILES)) {
      const resolved = path === "src/preset.json" ? JSON.stringify(preset, null, 2) : content;
      payload[path] = strToU8(resolved);
    }

    const zipped = zipSync(payload, { level: 6 });
    return {
      files: Object.keys(payload),
      blob: new Blob([new Uint8Array(zipped)], { type: "application/zip" })
    };
  }

  exportEmbedHtml(preset: PresetV1): string {
    const payload = JSON.stringify(preset);
    return `<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>PARTICLE WIZARD Embed</title>
    <style>html,body{margin:0;height:100%;background:#08090f;color:#fff;font-family:ui-sans-serif}pre{padding:12px;white-space:pre-wrap;}</style>
  </head>
  <body>
    <pre id=\"payload\"></pre>
    <script>
      const preset = ${payload};
      document.getElementById('payload').textContent = JSON.stringify(preset, null, 2);
    </script>
  </body>
</html>`;
  }
}
