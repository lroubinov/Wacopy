import { latestForComputer } from '../../../lib/database';
import { authenticateWindowsComputer } from '../auth';

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(request: Request) {
  const computer = await authenticateWindowsComputer(request);
  if (!computer) {
    return Response.json({ error: 'Unauthorized device' }, { status: 401, headers });
  }
  const message = latestForComputer(computer.id);
  return Response.json(message ?? { id: null, text: '', updatedAt: null }, { headers });
}
