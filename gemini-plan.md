Wallball: Project Initialization & Dev Setup Plan📌 Phase 1: Repository InitializationSet up the fundamental project structure and Git controls.Initialize Git & Dolt:Create your local project folder, initialize a fresh Git repository for your source code, and set up Dolt to track game data (e.g., player high scores, match history).bashmkdir wallball && cd wallball
git init
dolt init
Use code with caution.Create Project Structure:Set up a clean directory layout optimized for a web-based game.bashmkdir src assets docs .gastown
touch src/index.html src/main.js src/style.css
Use code with caution.Add .gitignore:Prevent local environment files and agent temporary artifacts from cluttering the repo.text# .gitignore
node_modules/
dist/
.DS_Store
.gastown/sandboxes/
*.log
Use code with caution.🛠️ Phase 2: Web Tech Stack & Local Server SetupSince Wallball is a browser game, we need a lightweight bundle and serving strategy.Configure npm:Initialize your Node environment and install a fast development bundler (like Vite) to handle Hot Module Replacement (HMR).bashnpm init -y
npm install --save-dev vite
Use code with caution.Update package.json:Add simple scripts so both you and the AI agents can start the game locally.json"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
Use code with caution.Test the Baseline:Add a basic canvas element to index.html and a console log to main.js to confirm the local server works. Run:bashnpm run dev
Use code with caution.🤖 Phase 3: Gas Town Orchestration SetupPrepare your workspace so your Gas Town agents ("polecats") can begin writing code.Spin up the Mayor:Launch your central coordinator inside the root directory to monitor work.bashgt may at
Use code with caution.Launch the Crew:Spawn your fleet of worker agents in their tmux sessions.bashgt crew at
Use code with caution.Define Project Rules (.gastown/rules.md):Create a file that tells the agents exactly what Wallball is and how it should be built.markdown# Wallball Architecture Guidelines
- **Platform:** Browser-based (HTML5 Canvas, Vanilla JS/TS).
- **Rendering:** Use the 2D canvas context for rendering the wall, ball, and paddle/player.
- **Asset Strategy:** Purely programmatic graphics for now (no external sprites yet).
- **Physics:** Implement basic elastic collision for the ball bouncing off the wall and player.
Use code with caution.🚀 Next Steps: The First Task (Bead)To start development, your next action is feeding a Bead to the Mayor to build the core game loop.Would you like to write the first Bead file to program the basic ball physics and paddle controls for Wallball?
