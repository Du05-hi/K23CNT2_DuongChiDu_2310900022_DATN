import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AuthUser } from '../middlewares/authMiddleware';

export async function canAccessProject(user: AuthUser, projectId: string): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return Boolean(await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }));
  }

  const scope: Prisma.ProjectWhereInput[] = [
    { createdById: user.id },
    { members: { some: { userId: user.id } } },
    { tasks: { some: { assigneeId: user.id } } },
  ];

  if (user.role === 'MANAGER' && user.departmentId) {
    scope.push({ departmentId: user.departmentId });
  }

  return Boolean(await prisma.project.findFirst({
    where: { id: projectId, OR: scope },
    select: { id: true },
  }));
}

export async function canManageProject(user: AuthUser, projectId: string): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return Boolean(await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }));
  }
  if (user.role !== 'MANAGER') return false;

  const scope: Prisma.ProjectWhereInput[] = [{ createdById: user.id }];
  if (user.departmentId) scope.push({ departmentId: user.departmentId });

  return Boolean(await prisma.project.findFirst({
    where: { id: projectId, OR: scope },
    select: { id: true },
  }));
}
