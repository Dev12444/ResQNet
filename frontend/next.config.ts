import type { NextConfig } from "next";

/**
 * Nothing in this app runs on a server.
 *
 * There are no route handlers, no middleware, no server actions and no dynamic
 * segments — every page is a client component that fetches the API from the
 * browser, and `next build` already prerenders all of them as static content.
 * So the app can ship as plain files, which frees it from needing a Node host
 * at all and, on a free tier, from that host falling asleep. A frontend that
 * takes a minute to wake would be worse than the API doing it, because the
 * person would not even see a page to explain why.
 *
 * Opt in with STATIC_EXPORT=true. It stays opt-in because `next start` cannot
 * serve an exported build, and that is the local workflow.
 *
 * The image optimiser is a server, so an exported build turns it off. Only the
 * logo uses next/image and it is already an SVG, so there is nothing to
 * optimise away.
 */
const staticExport = process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = staticExport
  ? { output: "export", images: { unoptimized: true } }
  : {};

export default nextConfig;
