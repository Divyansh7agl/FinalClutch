import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localApiPlugin(): Plugin {
  return {
    name: 'local-api-handlers',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/retrieve') || url.startsWith('/api/interview') || url.startsWith('/api/tts')) {
          const apiFile = url.startsWith('/api/retrieve')
            ? '/api/retrieve.ts'
            : url.startsWith('/api/tts')
              ? '/api/tts.ts'
              : '/api/interview.ts';
          try {
            const module = await server.ssrLoadModule(apiFile);
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', async () => {
              try {
                (req as any).body = bodyStr ? JSON.parse(bodyStr) : {};
              } catch {
                (req as any).body = bodyStr;
              }
              await module.default(req, res);
            });
            return;
          } catch (e: any) {
            console.error(`[Local API Error] Failed to process ${url}:`, e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Local API server error', reasonCode: 'ERR_LOCAL_API_HANDLER' }));
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // Load server-only environment variables for local dev execution
  const env = loadEnv(mode, '.', '');
  process.env.GROQ_API_KEY = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      localApiPlugin()
    ],
    // Removed define block that leaked API keys into client bundles
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
