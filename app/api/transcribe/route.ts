import { transcribe } from '../../../server/transcribe.mjs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return transcribe(request, process.env); }
export function POST(request: Request) { return transcribe(request, process.env); }
