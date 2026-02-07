---
description: How to deploy ClutchAI to Vercel
---

# Deploying ClutchAI

Follow these steps to deploy your pressure simulator to the cloud using Vercel.

## 1. Prepare your Repository
Make sure all your changes are committed to your local git repository.
```powershell
git add .
git commit -m "Optimize for Groq-only deployment"
```

## 2. Push to GitHub
If you haven't already, create a new repository on GitHub and push your code there.

## 3. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New** > **Project**.
3. Import your GitHub repository.
4. **CRITICAL STEP**: Under "Environment Variables", add the following:
   - **Key**: `VITE_GROQ_API_KEY`
   - **Value**: `<your_groq_api_key>`
5. Click **Deploy**.

## 4. Post-Deployment
Your app will be live at a `.vercel.app` URL. You can now share this with anyone!
