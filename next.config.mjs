/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The libSQL client loads a native module for local SQLite files; keep it out of the bundle.
    serverComponentsExternalPackages: ['@libsql/client', 'libsql'],
  },
};

export default nextConfig;
