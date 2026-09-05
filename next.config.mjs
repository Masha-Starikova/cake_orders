/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Собирает минимальный самодостаточный сервер для Docker-образа.
  output: "standalone"
};

export default nextConfig;
