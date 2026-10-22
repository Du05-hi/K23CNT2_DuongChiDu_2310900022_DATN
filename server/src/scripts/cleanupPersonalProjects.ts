import { prisma } from '../config/prisma';

export async function cleanupPersonalProjects() {
  console.log('--- Bắt đầu quét & dọn dẹp dự án cá nhân rác ---');

  // Lấy toàn bộ các project có tên "Công việc cá nhân & Lịch hẹn"
  const personalProjects = await prisma.project.findMany({
    where: {
      OR: [
        { name: 'Công việc cá nhân & Lịch hẹn' },
        { name: { contains: 'Công việc cá nhân' } },
      ],
    },
    include: {
      tasks: true,
      members: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Tìm thấy ${personalProjects.length} dự án có tên Công việc cá nhân.`);

  // Nhóm theo createdById
  const projectsByUser = new Map<string, typeof personalProjects>();
  for (const p of personalProjects) {
    const list = projectsByUser.get(p.createdById) || [];
    list.push(p);
    projectsByUser.set(p.createdById, list);
  }

  for (const [userId, projects] of projectsByUser.entries()) {
    console.log(`User ${userId} có ${projects.length} dự án cá nhân.`);

    // Nếu chỉ có 1 dự án
    if (projects.length === 1) {
      const single = projects[0];
      // Nếu có endDate = 2027 hoặc bất kỳ endDate nào gây rác lịch, dọn endDate về null
      await prisma.project.update({
        where: { id: single.id },
        data: {
          startDate: null,
          endDate: null,
          name: 'Công việc cá nhân & Lịch hẹn',
        },
      });
      console.log(`- Đã chuẩn hóa ngày của dự án ${single.id} (endDate = null)`);
      continue;
    }

    // Nếu có nhiều hơn 1 dự án (bị nhân bản rác)
    // Chọn 1 dự án giữ lại (canonical), ưu tiên cái có nhiều tasks nhất hoặc cái đầu tiên
    projects.sort((a, b) => b.tasks.length - a.tasks.length);
    const canonical = projects[0];
    const duplicates = projects.slice(1);

    console.log(`- Giữ lại dự án canonical: ${canonical.id} (hiện có ${canonical.tasks.length} task)`);

    // Dọn endDate của canonical về null
    await prisma.project.update({
      where: { id: canonical.id },
      data: {
        startDate: null,
        endDate: null,
        name: 'Công việc cá nhân & Lịch hẹn',
      },
    });

    for (const dup of duplicates) {
      console.log(`- Đang gộp và xóa dự án trùng lặp: ${dup.id} (${dup.tasks.length} tasks)`);
      // 1. Chuyển toàn bộ task sang canonical
      if (dup.tasks.length > 0) {
        await prisma.task.updateMany({
          where: { projectId: dup.id },
          data: { projectId: canonical.id },
        });
      }
      // 2. Xóa project members của dup
      await prisma.projectMember.deleteMany({
        where: { projectId: dup.id },
      });
      // 3. Xóa dup project
      await prisma.project.delete({
        where: { id: dup.id },
      });
      console.log(`  -> Đã xóa dự án trùng: ${dup.id}`);
    }
  }

  console.log('--- Hoàn tất dọn dẹp dữ liệu rác! ---');
}

if (require.main === module) {
  cleanupPersonalProjects()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('Lỗi cleanup:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

