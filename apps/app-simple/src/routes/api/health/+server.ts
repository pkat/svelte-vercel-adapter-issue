import { json } from '@sveltejs/kit';

export function GET() {
  return json({ status: 'ok', app: 'app-simple' });
}
