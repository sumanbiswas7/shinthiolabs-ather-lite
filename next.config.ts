import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  sassOptions: {
    includePaths: ['./src/styles'],
  },
  serverExternalPackages: ['chromadb', 'onnxruntime-node', 'chromadb-default-embed'],
}

export default nextConfig
