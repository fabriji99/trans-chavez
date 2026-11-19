import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El paquete compartido se publica como código TypeScript, hay que compilarlo.
  transpilePackages: ["@trans-chavez/shared"],
};

export default nextConfig;
