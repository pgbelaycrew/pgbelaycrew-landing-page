/**
 * Minimal pass-through Worker for the pgBelayCrew landing page.
 *
 * Its only job is to hand every request to the static-assets binding. Because
 * `assets.run_worker_first` is true, this runs on every request, which is what
 * makes Workers Observability (wrangler `observability`) capture every page hit
 * — pure static-asset hits would otherwise bypass the Worker and log nothing.
 *
 * No cookies, no client-side state: observability here is entirely server-side.
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
