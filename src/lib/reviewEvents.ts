import { Response } from 'express';

// Map of professor_id → set of connected SSE response objects
const clients = new Map<number, Set<Response>>();

// Map of ip → set of connected SSE response objects (for per-IP cap)
const clientsByIp = new Map<string, Set<Response>>();

const MAX_CONNECTIONS_PER_IP = 5;

export function getIpConnectionCount(ip: string): number {
  return clientsByIp.get(ip)?.size ?? 0;
}

export function addClient(professorId: number, res: Response, ip?: string) {
  if (!clients.has(professorId)) clients.set(professorId, new Set());
  clients.get(professorId)!.add(res);

  if (ip) {
    if (!clientsByIp.has(ip)) clientsByIp.set(ip, new Set());
    clientsByIp.get(ip)!.add(res);
  }
}

export function removeClient(professorId: number, res: Response, ip?: string) {
  clients.get(professorId)?.delete(res);

  if (ip) {
    const ipSet = clientsByIp.get(ip);
    if (ipSet) {
      ipSet.delete(res);
      if (ipSet.size === 0) clientsByIp.delete(ip);
    }
  }
}

export { MAX_CONNECTIONS_PER_IP };

export function emitReviewApproved(professorId: number) {
  const subs = clients.get(professorId);
  if (!subs?.size) return;
  const payload = `event: review_approved\ndata: ${JSON.stringify({ professor_id: professorId })}\n\n`;
  for (const res of subs) {
    try { res.write(payload); } catch { /* client already gone */ }
  }
}
