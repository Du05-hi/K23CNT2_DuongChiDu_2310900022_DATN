import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';

const DEFAULT_SETTINGS = [
  {
    key: 'COMPANY_NAME',
    value: 'TaskFlow AI Enterprise',
    description: 'Tên tổ chức / doanh nghiệp hiển thị trên toàn hệ thống',
  },
  {
    key: 'STANDARD_HOURLY_RATE',
    value: '100000',
    description: 'Đơn giá giờ công tiêu chuẩn cơ bản (VNĐ/giờ)',
  },
  {
    key: 'PROJECT_HOURLY_RATE',
    value: '180000',
    description: 'Đơn giá giờ dự án trọng điểm (VNĐ/giờ)',
  },
  {
    key: 'PROJECT_SCALE_FACTOR',
    value: '1.2',
    description: 'Hệ số nhân quy mô trách nhiệm dự án',
  },
  {
    key: 'MAX_RD_HOURS_PER_PERIOD',
    value: '500',
    description: 'Hạn mức trần giờ nghiên cứu phát triển R&D mỗi kỳ',
  },
  {
    key: 'DEFAULT_SPRINT_CAPACITY',
    value: '40',
    description: 'Định mức giờ làm việc tiêu chuẩn mỗi sprint (giờ)',
  },
  {
    key: 'KPI_A_THRESHOLD',
    value: '85',
    description: 'Điểm sàn xếp hạng KPI loại A (Xuất sắc)',
  },
  {
    key: 'KPI_B_THRESHOLD',
    value: '70',
    description: 'Điểm sàn xếp hạng KPI loại B (Khá)',
  },
  {
    key: 'KPI_C_THRESHOLD',
    value: '50',
    description: 'Điểm sàn xếp hạng KPI loại C (Đạt)',
  },
  {
    key: 'ENABLE_AI_VOICE_COMMANDS',
    value: 'true',
    description: 'Kích hoạt tính năng trợ lý giọng nói AI NLU Tiếng Việt',
  },
];

/**
 * Tự động tạo dữ liệu mẫu cấu hình nếu bảng SystemSetting rỗng
 */
async function autoSeedSettingsIfEmpty(): Promise<void> {
  try {
    const count = await prisma.systemSetting.count();
    if (count === 0) {
      for (const s of DEFAULT_SETTINGS) {
        await prisma.systemSetting.create({
          data: s,
        });
      }
    }
  } catch (error) {
    console.warn('Lỗi autoSeedSettingsIfEmpty:', error);
  }
}

/**
 * 1. Lấy danh sách toàn bộ cấu hình hệ thống
 */
export const getSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await autoSeedSettingsIfEmpty();

    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    res.status(200).json({
      success: true,
      message: 'Lấy cấu hình hệ thống thành công.',
      data: settings,
    });
  } catch (error: any) {
    console.error('Lỗi getSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải cấu hình hệ thống.',
      error: error.message,
    });
  }
};

/**
 * 2. Lấy chi tiết một cấu hình theo Key
 */
export const getSettingByKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const setting = await prisma.systemSetting.findUnique({
      where: { key: String(key).toUpperCase() },
    });

    if (!setting) {
      res.status(404).json({
        success: false,
        message: `Không tìm thấy cấu hình với mã "${key}".`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error: any) {
    console.error('Lỗi getSettingByKey:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy cấu hình.',
      error: error.message,
    });
  }
};

/**
 * 3. Cập nhật một cấu hình theo Key (Chỉ ADMIN)
 */
export const updateSetting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminUser = req.user;
    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined || value === null) {
      res.status(400).json({
        success: false,
        message: 'Giá trị cấu hình (value) không được để trống.',
      });
      return;
    }

    const uppercaseKey = String(key).toUpperCase();

    const existing = await prisma.systemSetting.findUnique({
      where: { key: uppercaseKey },
    });

    const updatedSetting = await prisma.systemSetting.upsert({
      where: { key: uppercaseKey },
      create: {
        key: uppercaseKey,
        value: String(value),
        description: description || null,
      },
      update: {
        value: String(value),
        ...(description !== undefined ? { description } : {}),
      },
    });

    if (adminUser) {
      await logActivity({
        userId: adminUser.id,
        action: 'UPDATE_SYSTEM_SETTING',
        entityType: 'SETTING',
        entityId: uppercaseKey,
        description: `Quản trị viên cập nhật cấu hình "${uppercaseKey}" từ "${existing?.value ?? ''}" thành "${value}"`,
        metadata: {
          key: uppercaseKey,
          oldValue: existing?.value ?? null,
          newValue: String(value),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã cập nhật cấu hình "${uppercaseKey}" thành công!`,
      data: updatedSetting,
    });
  } catch (error: any) {
    console.error('Lỗi updateSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật cấu hình hệ thống.',
      error: error.message,
    });
  }
};

/**
 * 4. Cập nhật hàng loạt cấu hình (Chỉ ADMIN)
 */
export const batchUpdateSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminUser = req.user;
    const settingsPayload = req.body; // { KEY1: 'val1', KEY2: 'val2' } hoặc Array<{ key: string, value: string, description?: string }>

    if (!settingsPayload) {
      res.status(400).json({
        success: false,
        message: 'Dữ liệu cấu hình không hợp lệ.',
      });
      return;
    }

    const items: Array<{ key: string; value: string; description?: string }> = [];

    if (Array.isArray(settingsPayload)) {
      for (const item of settingsPayload) {
        if (item && item.key && item.value !== undefined) {
          items.push({
            key: String(item.key).toUpperCase(),
            value: String(item.value),
            description: item.description,
          });
        }
      }
    } else if (typeof settingsPayload === 'object') {
      for (const [k, v] of Object.entries(settingsPayload)) {
        if (v !== undefined && v !== null) {
          items.push({
            key: String(k).toUpperCase(),
            value: String(v),
          });
        }
      }
    }

    if (items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Không tìm thấy cấu hình hợp lệ để cập nhật.',
      });
      return;
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.systemSetting.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            value: item.value,
            description: item.description || null,
          },
          update: {
            value: item.value,
            ...(item.description !== undefined ? { description: item.description } : {}),
          },
        })
      )
    );

    if (adminUser) {
      await logActivity({
        userId: adminUser.id,
        action: 'BATCH_UPDATE_SYSTEM_SETTINGS',
        entityType: 'SETTING',
        entityId: 'ALL',
        description: `Quản trị viên cập nhật hàng loạt ${items.length} tham số cấu hình hệ thống`,
        metadata: { updatedKeys: items.map((i) => i.key) },
      });
    }

    const refreshedSettings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    res.status(200).json({
      success: true,
      message: `Đã lưu thành công ${items.length} cấu hình hệ thống!`,
      data: refreshedSettings,
    });
  } catch (error: any) {
    console.error('Lỗi batchUpdateSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật danh sách cấu hình.',
      error: error.message,
    });
  }
};

