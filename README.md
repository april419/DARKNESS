# DARKNESS

A multiplayer survival-horror office game built with Node.js and WebSockets.

## How to run locally

1. Install dependencies:
   npm install
2. Start the game:
   npm start
3. Open the browser:
   http://localhost:3000

If you want to match the current local play setup, run:
   PORT=3002 npm start

Then open:
   http://localhost:3002

## How to share it publicly

This project uses a Node WebSocket server, so the easiest public hosting options are Render or Railway.

### Render

- Push this repo to GitHub
- Import it into Render
- Use the following settings:
  - Build Command: npm install
  - Start Command: PORT=$PORT node server.js

A deploy config is already included at [render.yaml](render.yaml).

### Railway

- Connect the repo to Railway
- Use the default Node app settings
- Keep the app running with the existing start script

## Notes

- The server reads the port from the PORT environment variable.
- This is important for public hosting because most cloud services assign a dynamic port.
- The game is designed for a browser-based multiplayer experience and works best when it is hosted on a public URL instead of only localhost.

## Quick pitch

Darkness is a cooperative office-horror survival game where players navigate a dim building, avoid infected coworkers, and stay alive while the watcher waits in the dark.
