import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createScheduleSchema, updateScheduleSchema } from '../shared/index.js';
import { requireAuth, requireRole, canAccessSite, canManageSchedules } from '../utils/permissions.js';
import { createAuditLog } from '../utils/audit.js';

export default async function scheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request, reply) => {
    await fastify.authenticate(request, reply);
  });

  // List schedules
  fastify.get('/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request);
    const { siteId } = request.query as { siteId?: string };
    const prisma = fastify.prisma;

    const where: any = {};
    if (siteId) {
      if (!canAccessSite(user, siteId)) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }
      where.siteId = siteId;
    } else if (user.role !== 'Admin' && user.role !== 'Manager') {
      where.siteId = { in: user.siteIds };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        asset: {
          include: { assetType: true },
        },
        site: true,
        checkTemplate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return schedules;
  });

  // Get schedule
  fastify.get('/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request);
    const { id } = request.params as { id: string };
    const prisma = fastify.prisma;
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        asset: true,
        site: true,
        checkTemplate: {
          include: { questions: true },
        },
        occurrences: {
          orderBy: { dueDate: 'asc' },
          take: 30,
        },
      },
    });
    if (!schedule) {
      reply.code(404).send({ error: 'Schedule not found' });
      return;
    }
    if (!canAccessSite(user, schedule.siteId)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
    return schedule;
  });

  // Create schedule
  fastify.post('/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request);
    if (!canManageSchedules(user)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
    const body = createScheduleSchema.parse(request.body);
    
    const prisma = fastify.prisma;
    
    // Derive siteId from asset (Schedule model requires siteId, but schema doesn't include it in request)
    const asset = await prisma.asset.findUnique({
      where: { id: body.assetId },
      select: { siteId: true },
    });
    
    if (!asset) {
      reply.code(404).send({ error: 'Asset not found' });
      return;
    }
    
    if (!canAccessSite(user, asset.siteId)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }

    const schedule = await prisma.schedule.create({
      data: {
        ...body,
        siteId: asset.siteId,
      },
      include: {
        asset: true,
        site: true,
        checkTemplate: true,
      },
    });
    await createAuditLog('CREATE', 'Schedule', schedule.id, user.userId, body);
    return schedule;
  });

  // Update schedule
  fastify.put('/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request);
    if (!canManageSchedules(user)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
    const { id } = request.params as { id: string };
    const body = updateScheduleSchema.parse(request.body);
    const prisma = fastify.prisma;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
    });
    if (!schedule) {
      reply.code(404).send({ error: 'Schedule not found' });
      return;
    }
    if (!canAccessSite(user, schedule.siteId)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data: body,
      include: {
        asset: true,
        site: true,
        checkTemplate: true,
      },
    });
    await createAuditLog('UPDATE', 'Schedule', schedule.id, user.userId, body);
    return updated;
  });

  // Generate occurrences (admin only, or via cron)
  fastify.post('/schedules/:id/generate-occurrences', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireRole(request, ['Admin']);
    const { id } = request.params as { id: string };
    const prisma = fastify.prisma;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
    });
    if (!schedule) {
      reply.code(404).send({ error: 'Schedule not found' });
      return;
    }

    const occurrences = await generateOccurrences(prisma, schedule.id, schedule);
    return { count: occurrences.length, occurrences };
  });
}


async function generateOccurrences(prisma: any, scheduleId: string, schedule: any) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 14); // Generate for next 14 days

  const occurrences: any[] = [];

  if (schedule.scheduleType === 'TimeBased' && schedule.intervalDays) {
    let currentDate = new Date(now);
    while (currentDate <= endDate) {
      const existing = await prisma.scheduleOccurrence.findFirst({
        where: {
          scheduleId,
          dueDate: currentDate,
        },
      });
      if (!existing) {
        const occurrence = await prisma.scheduleOccurrence.create({
          data: {
            scheduleId,
            dueDate: currentDate,
          },
        });
        occurrences.push(occurrence);
      }
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + schedule.intervalDays);
    }
  }

  return occurrences;
}

