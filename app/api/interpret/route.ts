import { interpret } from '../../../server/interpret.mjs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) { return interpret(request, process.env); }
