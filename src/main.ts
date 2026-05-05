import { GAME_HEIGHT, GAME_WIDTH, createBaseGameConfig } from "./game/config";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount element");
}

const config = createBaseGameConfig();

app.innerHTML = `
  <main class="app-shell">
    <section class="status-panel" aria-labelledby="wallball-title">
      <p class="eyebrow">Vite + TypeScript + Phaser + Vitest</p>
      <h1 id="wallball-title">Wallball</h1>
      <p>
        Baseline ready for a ${GAME_WIDTH}x${GAME_HEIGHT} Phaser game host.
      </p>
      <div
        id="${config.parent}"
        class="game-host"
        data-width="${String(config.width)}"
        data-height="${String(config.height)}"
      ></div>
    </section>
  </main>
`;
