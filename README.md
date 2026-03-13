<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1QL_tFqi0PVv2AoU99GZW72PM2UdycVO7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` and set your API keys:
   - `VITE_GEMINI_API_KEY=your_gemini_api_key`
   - `VITE_GROQ_API_KEY=your_groq_api_key` (optional, for Groq-based features)
   - `GEMINI_API_KEY=your_gemini_api_key` (optional compatibility key)
3. Run the app:
   `npm run dev`
