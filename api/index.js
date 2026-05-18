import { createTrust402ExpressApp } from "../src/expressApp.js";

export const config = {
  api: {
    bodyParser: false
  }
};

const appPromise = createTrust402ExpressApp();

export default async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
