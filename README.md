# 🏋️ IronMind — AI-Powered Gym Workout Tracker

IronMind is a modern, responsive web application for tracking gym workouts with an AI assistant that works both locally (using Ollama) and in the cloud (using Groq).

## 🚀 Quick Start (Local)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the server:**
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:3000`.

3. **AI Support:**
   - **Local:** Install [Ollama](https://ollama.com/) and run `ollama pull llama3`.
   - **Cloud:** Add `GROQ_API_KEY` to your `.env` file.

## ☁️ Deployment (Free on Render)

IronMind is designed to be easily deployable on **Render's free tier**.

### Step 1: Push to GitHub
Create a new repository on GitHub and push your code:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Go to [Render.com](https://render.com/) and log in.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Use the following settings:
   - **Name:** `ironmind`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`

### Step 3: Configure Environment Variables
In the **Environment** tab of your Render service, add:
- `GROQ_API_KEY`: Your key from [Groq Console](https://console.groq.com/) (Free).
- `NODE_VERSION`: `18.0.0` or higher.

### Step 4: Access your app
Once the build is complete, Render will provide a URL like `https://ironmind.onrender.com`.

## ✨ Features
- **AI Workout Generator:** Personalized plans based on your goals.
- **AI Coach Chat:** Real-time form tips and motivation.
- **Streak Tracking:** Stay consistent and earn achievements.
- **Progress Analytics:** Beautiful charts for calories and volume.
- **100% Private:** Your data stays in local storage.

---
Built with ❤️ for athletes.
