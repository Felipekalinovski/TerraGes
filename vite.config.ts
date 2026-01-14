import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React e React DOM em um chunk separado
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Supabase em seu próprio chunk
            'supabase-vendor': ['@supabase/supabase-js'],
            // Google AI em seu próprio chunk (provavelmente o maior)
            'google-ai-vendor': ['@google/genai', '@google/generative-ai'],
            // Recharts (biblioteca de gráficos) separado
            'charts-vendor': ['recharts'],
            // Lucide Icons separado
            'icons-vendor': ['lucide-react'],
          },
        },
      },
      // Aumenta o limite de aviso para 1000kb (opcional)
      chunkSizeWarningLimit: 1000,
    },
  };
});
