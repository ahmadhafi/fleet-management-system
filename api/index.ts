import type { Request, Response } from 'express';
import { createApp } from '../src/server/app.ts';

const app = createApp();

export default async function handler(req: Request, res: Response) {
  return app(req, res);
}
