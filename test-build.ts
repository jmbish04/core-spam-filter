// @ts-ignore
import astroApp from "./dist/_worker.js/index.js";
export default {
  async fetch(req: any, env: any, ctx: any) {
    return astroApp.fetch(req, env, ctx);
  },
};
