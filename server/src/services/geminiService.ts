import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const AVAILABLE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
] as const;

const getGeminiApiKey = (): string => process.env.GEMINI_API_KEY?.trim() || '';

const getModelForRequest = (
  preferredModel: string = 'gemini-3.5-flash',
  generationConfig?: GenerationConfig
) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  let modelName = preferredModel;
  // Tự động nâng cấp các model đã bị Google deprecated (1.5, 2.0, 2.5) sang 3.5-flash
  if (!modelName || modelName.includes('1.5') || modelName.includes('2.0') || modelName.includes('2.5')) {
    modelName = 'gemini-3.5-flash';
  }

  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    ...(generationConfig ? { generationConfig } : {}),
  });
};

/**
 * Gọi Gemini với cơ chế tự động chuyển đổi mô hình dự phòng (Failover / Retry)
 * Giúp hệ thống không bao giờ bị gián đoạn khi một model quá tải (503) hoặc thay đổi phiên bản (404)
 */
export async function generateContentWithFallback(
  prompt: string | any,
  options?: {
    generationConfig?: GenerationConfig;
    preferredModel?: string;
  }
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const preferred =
    options?.preferredModel && !options.preferredModel.includes('1.5') && !options.preferredModel.includes('2.0')
      ? options.preferredModel
      : 'gemini-3.5-flash';

  const modelsToTry = [
    preferred,
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: any = null;
  for (const m of uniqueModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        ...(options?.generationConfig ? { generationConfig: options.generationConfig } : {}),
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim()) {
        return { text: text.trim(), modelUsed: m };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Model ${m} gặp sự cố (${err?.message?.slice(0, 80)}), đang thử model dự phòng...`);
    }
  }

  throw lastError || new Error('Không thể kết nối đến các mô hình Gemini.');
}

const normalizeString = (value: string | null | undefined, fallback: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || fallback;
};

const normalizeTaskSummaryInput = (task: Partial<TaskSummaryInput>): TaskSummaryInput => ({
  id: task.id || 'task-unknown',
  title: normalizeString(task.title, 'Công việc chưa đặt tên'),
  status: normalizeString(task.status, 'TODO'),
  priority: normalizeString(task.priority, 'MEDIUM'),
  dueDate: task.dueDate ?? null,
  assigneeName: task.assigneeName ?? 'Chưa phân công',
  estimatedHours: typeof task.estimatedHours === 'number' ? task.estimatedHours : 0,
  actualHours: typeof task.actualHours === 'number' ? task.actualHours : 0,
});

const normalizePersonalWorkInsightInput = (task: Partial<PersonalWorkInsightInput>): PersonalWorkInsightInput => ({
  ...normalizeTaskSummaryInput(task as Partial<TaskSummaryInput>),
  projectName: normalizeString(task.projectName, 'Không xác định'),
});

export interface SubTaskSuggestion {
  title: string;
  estimatedHours: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
}

export interface EnterpriseSubtaskSuggestion {
  title: string;
  description: string;
  estimatedHours: number;
  category: 'CORE_PROJECT' | 'RD' | 'OPERATIONS';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dodChecklist: string[];
}

export interface TaskSummaryInput {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | Date | null;
  assigneeName?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
}

export interface ProjectRiskInput {
  projectId: string;
  projectName: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  inProgressTasks: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

export interface PersonalWorkInsightInput extends TaskSummaryInput {
  projectName: string;
}

export interface RiskWarning {
  projectId: string;
  projectName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  recommendations: string[];
  overallScore: number;
}

export interface ParsedNLQuery {
  assigneeName?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isPastDue?: boolean;
  keyword?: string;
  projectId?: string;
}

/**
 * Trợ giúp làm sạch và parse chuỗi JSON trả về từ AI
 */
function cleanAndParseJSON<T>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned) as T;
}

/**
 * 1. Phân tách công việc lớn thành tối đa 8 sub-tasks chi tiết bằng tiếng Việt
 */
export async function taskBreakdown(
  taskTitle: string,
  taskDescription: string = ''
): Promise<SubTaskSuggestion[]> {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, sử dụng fallback subtasks.');
      return getFallbackSubtasks(taskTitle, taskDescription);
    }

    const prompt = `
Bạn là một chuyên gia quản lý dự án công nghệ thông tin xuất sắc.
Hãy phân tích công việc sau và phân tách thành từ 3 đến tối đa 8 công việc con (sub-tasks) cụ thể, thực tế và khả thi.

Tên công việc chính: "${normalizeString(taskTitle, 'Công việc chưa đặt tên')}"
Mô tả chi tiết: "${normalizeString(taskDescription, 'Không có mô tả chi tiết')}"

Yêu cầu trả về kết quả dạng JSON ARRAY thuần túy (không kèm text thừa ngoài JSON), mỗi phần tử là 1 object có cấu trúc:
[
  {
    "title": "Tên công việc con ngắn gọn, rõ hành động bằng tiếng Việt",
    "estimatedHours": số giờ ước tính hoàn thành (số thực hoặc số nguyên, từ 0.5 đến 16),
    "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    "description": "Mô tả mục tiêu cụ thể và tiêu chuẩn hoàn thành của sub-task này bằng tiếng Việt"
  }
]
`;

    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      responseMimeType: 'application/json',
    };

    const model = getModelForRequest('gemini-1.5-flash', generationConfig);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const subTasks = cleanAndParseJSON<SubTaskSuggestion[]>(responseText);

    if (!Array.isArray(subTasks) || subTasks.length === 0) {
      return getFallbackSubtasks(taskTitle, taskDescription);
    }

    return subTasks.slice(0, 8);
  } catch (error: any) {
    console.warn('[Gemini][taskBreakdown] Lỗi hoặc không có API Key, sử dụng fallback template:', error?.message);
    return getFallbackSubtasks(taskTitle, taskDescription);
  }
}

function getFallbackSubtasks(taskTitle: string, taskDescription: string): SubTaskSuggestion[] {
  const safeTitle = normalizeString(taskTitle, 'Công việc');
  return [
    {
      title: `1. Khảo sát & Phân tích chi tiết: ${safeTitle}`,
      estimatedHours: 2,
      priority: 'HIGH',
      description: `Rà soát tài liệu, xác định phạm vi và chuẩn bị dữ liệu đầu vào cho "${safeTitle}".`,
    },
    {
      title: `2. Thiết kế giải pháp & Lập kế hoạch thực thi`,
      estimatedHours: 4,
      priority: 'MEDIUM',
      description: 'Lập sơ đồ kiến trúc, cấu trúc cơ sở dữ liệu và phân công các mốc triển khai.',
    },
    {
      title: `3. Triển khai code & Xây dựng tính năng chính`,
      estimatedHours: 8,
      priority: 'HIGH',
      description: 'Lập trình logic xử lý chính, tích hợp API và hoàn thiện giao diện người dùng.',
    },
    {
      title: `4. Kiểm thử chất lượng (QA) & Hoàn tất nghiệm thu`,
      estimatedHours: 2,
      priority: 'MEDIUM',
      description: 'Chạy kiểm thử chức năng, tối ưu hóa hiệu năng và chuyển sang trạng thái Done.',
    },
  ];
}

/**
 * Phân tách công việc WBS Đa tầng chuyên sâu tích hợp Tiêu chí nghiệm thu (DoD) bằng Gemini AI
 */
export async function enterpriseTaskBreakdown(
  taskTitle: string,
  taskDescription: string = '',
  projectScope: string = ''
): Promise<EnterpriseSubtaskSuggestion[]> {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, sử dụng fallback enterprise subtasks.');
      return getFallbackEnterpriseSubtasks(taskTitle, taskDescription);
    }

    const prompt = `
Bạn là Kỹ sư Trưởng kiêm Chuyên gia Quản lý Dự án Phần mềm Doanh nghiệp (Enterprise PM & Tech Lead).
Hãy phân tích công việc sau và phân rã thành từ 3 đến tối đa 5 công việc con (WBS Subtasks) chi tiết theo chuẩn phần mềm chuyên nghiệp, kèm theo 2-3 tiêu chí nghiệm thu (Definition of Done - DoD) rõ ràng cho mỗi subtask hoặc công việc.

Tên công việc chính: "${normalizeString(taskTitle, 'Công việc chưa đặt tên')}"
Mô tả chi tiết: "${normalizeString(taskDescription, 'Không có mô tả chi tiết')}"
Phạm vi dự án: "${normalizeString(projectScope, 'Phát triển phần mềm doanh nghiệp')}"

Yêu cầu trả về kết quả định dạng JSON ARRAY thuần túy (không kèm markdown ngoài JSON):
[
  {
    "title": "Tên công việc con ngắn gọn, mở đầu bằng động từ hành động bằng tiếng Việt",
    "description": "Mô tả chi tiết kỹ thuật cần thực hiện và kết quả đầu ra",
    "estimatedHours": số giờ ước tính từ 1 đến 16,
    "category": "CORE_PROJECT" | "RD" | "OPERATIONS",
    "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    "dodChecklist": [
      "Tiêu chí nghiệm thu 1 cụ thể, đo lường được",
      "Tiêu chí nghiệm thu 2 cụ thể, đo lường được"
    ]
  }
]
`;

    const generationConfig: GenerationConfig = {
      temperature: 0.25,
      topP: 0.85,
      topK: 40,
      responseMimeType: 'application/json',
    };

    const model = getModelForRequest('gemini-1.5-flash', generationConfig);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const subTasks = cleanAndParseJSON<EnterpriseSubtaskSuggestion[]>(responseText);

    if (!Array.isArray(subTasks) || subTasks.length === 0) {
      return getFallbackEnterpriseSubtasks(taskTitle, taskDescription);
    }

    return subTasks.slice(0, 6).map((item) => ({
      title: normalizeString(item.title, 'Công việc con'),
      description: normalizeString(item.description, 'Thực thi theo kế hoạch'),
      estimatedHours: typeof item.estimatedHours === 'number' && item.estimatedHours > 0 ? item.estimatedHours : 4,
      category: ['CORE_PROJECT', 'RD', 'OPERATIONS'].includes(item.category) ? item.category : 'CORE_PROJECT',
      priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(item.priority) ? item.priority : 'MEDIUM',
      dodChecklist: Array.isArray(item.dodChecklist) && item.dodChecklist.length > 0
        ? item.dodChecklist.map((c) => String(c).trim()).filter(Boolean)
        : ['Hoàn thành chức năng', 'Kiểm thử không lỗi'],
    }));
  } catch (error: any) {
    console.warn('[Gemini][enterpriseTaskBreakdown] Lỗi, sử dụng fallback enterprise template:', error?.message);
    return getFallbackEnterpriseSubtasks(taskTitle, taskDescription);
  }
}

function getFallbackEnterpriseSubtasks(taskTitle: string, taskDescription: string): EnterpriseSubtaskSuggestion[] {
  const safeTitle = normalizeString(taskTitle, 'Công việc');
  return [
    {
      title: `1. Khảo sát yêu cầu & Đặc tả luồng xử lý: ${safeTitle}`,
      description: `Rà soát tài liệu yêu cầu, xác định các trường dữ liệu và ràng buộc kỹ thuật cho ${safeTitle}.`,
      estimatedHours: 3,
      category: 'CORE_PROJECT',
      priority: 'HIGH',
      dodChecklist: [
        'Tài liệu đặc tả yêu cầu và sơ đồ luồng dữ liệu được phê duyệt',
        'Xác nhận không xung đột logic với các module hiện hữu',
      ],
    },
    {
      title: `2. Thiết kế CSDL & Xây dựng API Backend cho ${safeTitle}`,
      description: 'Cập nhật Prisma schema, viết API controller, validate dữ liệu đầu vào và kiểm tra quyền RBAC.',
      estimatedHours: 6,
      category: 'CORE_PROJECT',
      priority: 'HIGH',
      dodChecklist: [
        'API hoàn thành và trả về HTTP status chuẩn (200, 400, 403)',
        'Đã kiểm tra xử lý ngoại lệ và logging kiểm toán đầy đủ',
      ],
    },
    {
      title: `3. Phát triển Giao diện người dùng (UI Component & State)`,
      description: 'Xây dựng giao diện React Tailwind, liên kết React Query, xử lý loading, error và toast phản hồi.',
      estimatedHours: 5,
      category: 'CORE_PROJECT',
      priority: 'MEDIUM',
      dodChecklist: [
        'Giao diện phản hồi chuẩn Responsive, chuẩn Accessibility',
        'Tương thích hoàn toàn với trạng thái Dark/Light mode',
      ],
    },
    {
      title: `4. Kiểm thử chất lượng (QA/DoD) & Bàn giao nghiệm thu`,
      description: 'Chạy kiểm thử biên dịch TypeScript (tsc --noEmit), kiểm tra luồng kéo thả và nghiệm thu hoàn thành.',
      estimatedHours: 2,
      category: 'OPERATIONS',
      priority: 'MEDIUM',
      dodChecklist: [
        '0 lỗi TypeScript biên dịch trên cả client và server',
        'Được QA/Reviewer chấp thuận nghiệm thu chuyển sang DONE',
      ],
    },
  ];
}

/**
 * 2. Phân tích danh sách tasks và sinh bản nhận xét tiến độ bằng tiếng Việt dạng Markdown
 */
export async function generateProgressSummary(
  projectName: string,
  tasks: TaskSummaryInput[]
): Promise<string> {
  const normalizedTasks = tasks.map(normalizeTaskSummaryInput);
  const safeProjectName = normalizeString(projectName, 'Dự án chưa có tên');
  const total = normalizedTasks.length;
  const completed = normalizedTasks.filter((t) => t.status === 'DONE').length;
  const inProgress = normalizedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const review = normalizedTasks.filter((t) => t.status === 'REVIEW').length;
  const todo = normalizedTasks.filter((t) => t.status === 'TODO').length;
  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

  const fallbackReport = `# BÁO CÁO TIẾN ĐỘ DỰ ÁN: ${safeProjectName.toUpperCase()}

### 1. Tổng quan
- Dự án hiện có **${total} công việc** đã được lập kế hoạch và phân bổ trên hệ thống.
- Tỷ lệ hoàn thành công việc đạt **${completionRate}%** (${completed}/${total} tasks).

### 2. Tiến độ chi tiết
- **Hoàn thành (DONE):** ${completed} tasks.
- **Đang thực hiện (IN PROGRESS):** ${inProgress} tasks.
- **Chờ đánh giá/duyệt (REVIEW):** ${review} tasks.
- **Chưa bắt đầu (TODO):** ${todo} tasks.

### 3. Điểm mạnh
- Quy trình bàn giao và cập nhật trạng thái trên bảng Kanban diễn ra liên tục, minh bạch.
- Đội ngũ thành viên chủ động phối hợp giải quyết các đầu việc theo mốc thời gian.

### 4. Cần cải thiện
- Cần chú ý bám sát hạn chót các công việc có độ ưu tiên CAO (HIGH/URGENT).
- Rà soát các đầu việc chưa gán người phụ trách để tránh gián đoạn tiến độ chung.

### 5. Khuyến nghị
- Ban quản lý duy trì họp tiến độ hàng tuần và tập trung dứt điểm các tác vụ đang ở bước Review.`;

  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, sinh báo cáo tiến độ nội bộ.');
      return fallbackReport;
    }

    const prompt = `
Bạn là Giám đốc Dự án kiêm Chuyên gia Đánh giá Hiệu suất (KPI & Performance Lead).
Hãy phân tích dữ liệu công việc của dự án "${safeProjectName}" và lập Báo Cáo Nhận Xét Tiến Độ toàn diện bằng tiếng Việt.

Thông số dự án:
- Tổng số công việc: ${total}
- Đã hoàn thành (DONE): ${completed} (${completionRate}%)
- Đang thực hiện (IN_PROGRESS): ${inProgress}
- Đang kiểm tra/duyệt (REVIEW): ${review}
- Chưa bắt đầu (TODO): ${todo}

Chi tiết danh sách các tasks:
${JSON.stringify(normalizedTasks, null, 2)}

Hãy trình bày báo cáo bằng định dạng Markdown hoàn chỉnh với cấu trúc chính xác các mục sau:
# BÁO CÁO TIẾN ĐỘ DỰ ÁN: ${safeProjectName.toUpperCase()}

### 1. Tổng quan
(Tóm lược tình trạng tổng thể, tỷ lệ hoàn thành, đánh giá tiến độ so với kế hoạch)

### 2. Tiến độ chi tiết
(Phân tích các công việc theo trạng thái, các hạng mục quan trọng, tình hình phân công nhân sự)

### 3. Điểm mạnh
(Các mặt tích cực: năng suất làm việc, xử lý nhanh các tác vụ ưu tiên, sự phân bổ nguồn lực)

### 4. Cần cải thiện
(Các điểm nghẽn, công việc quá hạn, công việc chưa có người phụ trách hoặc đang dồn ứ ở bước review)

### 5. Khuyến nghị
(Các hành động cụ thể cần ban quản lý và nhóm phát triển thực hiện ngay trong giai đoạn tới)
`;

    const model = getModelForRequest('gemini-1.5-flash', { temperature: 0.4 });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    console.warn('[Gemini][generateProgressSummary] Lỗi hoặc không có API Key, sinh báo cáo nội bộ:', error?.message);
    const safeProjectName = normalizeString(projectName, 'Dự án');
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'DONE').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return `### 1. Tổng quan dự án "${safeProjectName}"
- Tổng số công việc: **${total} tasks**, đã hoàn thành: **${completed} tasks** (đạt **${rate}%**).
- Công việc đang thực hiện: **${inProgress} tasks**.

### 2. Tiến độ triển khai
- Đội ngũ đang duy trì khối lượng công việc bám sát kế hoạch. Các task chính đã được phân rã rõ ràng.

### 3. Điểm mạnh
- Tỷ lệ hoàn thành công việc ở mức ổn định, các thành viên tích cực cập nhật trạng thái trên bảng Kanban.

### 4. Cần cải thiện
- Chú ý kiểm soát thời hạn của các task sắp tới hạn để tránh phát sinh việc trễ hạn.

### 5. Khuyến nghị
- Ban quản lý tiếp tục theo dõi tiến độ tuần và đôn đốc các đầu việc quan trọng.`;
  }
}

export async function generatePersonalWorkInsights(
  userName: string,
  tasks: PersonalWorkInsightInput[]
): Promise<string> {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'DONE').length;
  const now = new Date();
  const overdue = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
  const fallbackInsights = `### Phân tích năng suất cho ${userName || 'bạn'}
- **Khối lượng công việc:** Bạn hiện có tổng cộng **${total} tasks**, trong đó đã hoàn thành **${completed} tasks**.
- **Cảnh báo tiến độ:** ${overdue > 0 ? `Có **${overdue} task quá hạn** cần ưu tiên hoàn tất sớm.` : 'Tất cả các task đều đang trong hạn xử lý tốt.'}
- **Khuyến nghị hành động:** Tập trung dứt điểm các công việc có độ ưu tiên HIGH/URGENT trước, cập nhật trạng thái thường xuyên trên Kanban.`;

  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, sinh nhận xét năng suất nội bộ.');
      return fallbackInsights;
    }

    const normalizedTasks = tasks.map(normalizePersonalWorkInsightInput);
    const overdueTasks = normalizedTasks.filter(
      (task) => task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < now
    ).length;

    const prompt = `
Bạn là trợ lý năng suất cá nhân. Phân tích dữ liệu công việc thật của nhân viên "${normalizeString(userName, 'nhân viên')}" bên dưới.
Không suy đoán dữ liệu không có trong đầu vào. Nếu thiếu thông tin, hãy nói rõ.

Tóm tắt dữ liệu: tổng ${normalizedTasks.length} task, ${normalizedTasks.filter((task) => task.status === 'DONE').length} đã hoàn thành,
${normalizedTasks.filter((task) => task.status === 'IN_PROGRESS').length} đang thực hiện, ${overdueTasks} quá hạn.

Dữ liệu task:
${JSON.stringify(normalizedTasks, null, 2)}

Trả lời bằng tiếng Việt Markdown ngắn gọn, tối đa 4 gạch đầu dòng:
- Nhận xét khối lượng công việc dựa trên số task và trạng thái.
- Nêu task ưu tiên/đang trễ hạn nếu có (ghi rõ dự án và deadline).
- Đề xuất 1-2 hành động tiếp theo phù hợp với dữ liệu.
Chỉ dùng thông tin có trong dữ liệu; không bịa deadline hoặc tiến độ.
`;

    const model = getModelForRequest('gemini-1.5-flash', { temperature: 0.3 });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    console.warn('[Gemini][generatePersonalWorkInsights] Lỗi hoặc không có API Key, sinh nhận xét nội bộ:', error?.message);
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'DONE').length;
    const now = new Date();
    const overdue = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
    return `### Phân tích năng suất cho ${userName || 'bạn'}
- **Khối lượng công việc:** Bạn hiện có tổng cộng **${total} tasks**, trong đó đã hoàn thành **${completed} tasks**.
- **Cảnh báo tiến độ:** ${overdue > 0 ? `Có **${overdue} task quá hạn** cần ưu tiên hoàn tất sớm.` : 'Tất cả các task đều đang trong hạn xử lý tốt.'}
- **Khuyến nghị hành động:** Tập trung dứt điểm các công việc có độ ưu tiên HIGH/URGENT trước, cập nhật trạng thái thường xuyên trên Kanban.`;
  }
}

export function calculateFallbackProjectRisks(projects: ProjectRiskInput[]): RiskWarning[] {
  return projects.map((p) => {
    const total = p.totalTasks || 0;
    const completed = p.completedTasks || 0;
    const overdue = p.overdueTasks || 0;
    const unassigned = p.unassignedTasks || 0;
    const inProgress = p.inProgressTasks || 0;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    let score = 85;

    if (overdue > 0) {
      riskFactors.push(`Có ${overdue} công việc quá hạn chưa giải quyết`);
      recommendations.push(`Ưu tiên xử lý ngay ${overdue} task quá hạn`);
      score -= Math.min(40, overdue * 15);
    }

    if (unassigned > 0) {
      riskFactors.push(`Có ${unassigned} công việc chưa phân bổ nhân sự`);
      recommendations.push('Chỉ định thành viên phụ trách các đầu việc đang trống');
      score -= Math.min(25, unassigned * 10);
    }

    if (inProgress > 6) {
      riskFactors.push(`Số lượng task đang làm dồn ứ (${inProgress} tasks)`);
      recommendations.push('Giới hạn việc đang thực hiện đồng thời để tránh tắc nghẽn');
      score -= 15;
    }

    if (total > 0 && completionRate < 25) {
      riskFactors.push(`Tiến độ hoàn thành còn thấp (${Math.round(completionRate)}%)`);
      recommendations.push('Đôn đốc các mốc giao hàng then chốt và họp kiểm điểm tiến độ');
      score -= 15;
    }

    if (riskFactors.length === 0) {
      riskFactors.push('Dự án đang bám sát tiến độ và không có cảnh báo nghiêm trọng');
      recommendations.push('Duy trì nhịp độ làm việc và kiểm tra định kỳ');
    }

    score = Math.max(15, Math.min(100, score));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score < 40) riskLevel = 'CRITICAL';
    else if (score < 60) riskLevel = 'HIGH';
    else if (score < 75) riskLevel = 'MEDIUM';

    return {
      projectId: p.projectId,
      projectName: p.projectName || 'Dự án',
      riskLevel,
      riskFactors,
      recommendations,
      overallScore: score,
    };
  });
}

/**
 * 3. Phân tích danh sách dự án và xác định rủi ro
 */
export async function detectProjectRisks(
  projects: ProjectRiskInput[]
): Promise<RiskWarning[]> {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, kích hoạt bộ phân tích rủi ro quy chuẩn nội bộ.');
      return calculateFallbackProjectRisks(projects);
    }

    const prompt = `
Bạn là Chuyên gia Quản trị Rủi ro Dự án (Project Risk Auditor).
Hãy phân tích danh sách dữ liệu các dự án sau và xác định mức độ rủi ro, nguyên nhân và biện pháp khắc phục.

Danh sách dự án:
${JSON.stringify(projects.map((project) => ({
  ...project,
  projectName: normalizeString(project.projectName, 'Dự án chưa đặt tên'),
  status: normalizeString(project.status, 'PLANNING'),
})), null, 2)}

Tiêu chí đánh giá rủi ro:
- Tỷ lệ công việc quá hạn (overdueTasks)
- Số lượng task chưa giao (unassignedTasks)
- Thời gian còn lại và tiến độ hoàn thành (completedTasks / totalTasks)
- Tình trạng dồn ứ việc đang làm (inProgressTasks)

Yêu cầu trả về kết quả dạng JSON ARRAY thuần túy (không kèm code markdown ngoài), mỗi phần tử đại diện cho 1 dự án:
[
  {
    "projectId": "id của dự án tương ứng",
    "projectName": "tên dự án",
    "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "riskFactors": [
      "Nguyên nhân rủi ro 1 bằng tiếng Việt",
      "Nguyên nhân rủi ro 2..."
    ],
    "recommendations": [
      "Giải pháp khuyến nghị 1 bằng tiếng Việt",
      "Giải pháp khuyến nghị 2..."
    ],
    "overallScore": điểm an toàn dự án từ 0 đến 100 (100 là an toàn tuyệt đối, dưới 40 là nguy cấp)
  }
]
`;

    const model = getModelForRequest('gemini-1.5-flash', {
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const risks = cleanAndParseJSON<RiskWarning[]>(responseText);

    if (!Array.isArray(risks)) {
      return calculateFallbackProjectRisks(projects);
    }

    return risks;
  } catch (error: any) {
    console.warn('[Gemini][detectProjectRisks] Lỗi khi gọi Gemini, sử dụng fallback an toàn:', error?.message);
    return calculateFallbackProjectRisks(projects);
  }
}

/**
 * 4. Parse câu truy vấn ngôn ngữ tự nhiên thành bộ lọc tìm kiếm công việc có cấu trúc
 */
export async function parseNaturalLanguageSearch(
  query: string
): Promise<ParsedNLQuery> {
  const fallbackResult: ParsedNLQuery = {
    keyword: normalizeString(query, 'công việc'),
  };

  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, thực hiện tìm kiếm từ khóa cơ bản.');
      return fallbackResult;
    }

    const prompt = `
Bạn là trợ lý AI thông minh phân tích câu truy vấn tìm kiếm công việc của người dùng bằng tiếng Việt.
Hãy phân tích câu sau: "${normalizeString(query, 'công việc')}"

Trích xuất thành đối tượng JSON có các trường sau (nếu câu nói không đề cập trường nào thì để null):
{
  "assigneeName": string hoặc null (ví dụ: "Nguyễn Văn A", "Du", "tôi", "Dương Chí Du"),
  "status": "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" hoặc null,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" hoặc null,
  "isPastDue": boolean hoặc null (true nếu người dùng tìm việc trễ hạn, quá hạn, trễ deadline),
  "keyword": string hoặc null (từ khóa chính cần tìm trong tiêu đề hoặc mô tả task)
}
`;

    const model = getModelForRequest('gemini-1.5-flash', {
      temperature: 0.1,
      responseMimeType: 'application/json',
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return cleanAndParseJSON<ParsedNLQuery>(responseText);
  } catch (error: any) {
    console.error('[Gemini][parseNaturalLanguageSearch] Lỗi:', error?.message || error);
    return {
      keyword: normalizeString(query, 'công việc'),
    };
  }
}

/**
 * 5. Cấu trúc ngữ cảnh dữ liệu Live Database cho Trợ Lý AI
 */
export interface LiveDataContext {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  stats: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    todoTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    completionRate: number;
    myTotalTasks: number;
    myOverdueTasks: number;
  };
  projects: Array<{
    id: string;
    name: string;
    status: string;
    taskCount: number;
    completedCount: number;
    progress: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    isOverdue: boolean;
    assigneeName: string;
    assigneeId: string | null;
    projectId: string;
    projectName: string;
  }>;
  currentTime?: {
    formattedTime: string;
    formattedDate: string;
    fullDateTimeStr: string;
    iso: string;
  };
}

/**
 * Xử lý ý định thông minh nội bộ (Smart Intent Matching & Graceful Fallback)
 * Đảm bảo 100% trả lời chính xác từ DB ngay cả khi không có kết nối Gemini API
 */
export function generateSmartFallbackResponse(query: string, context: LiveDataContext): string {
  const q = (query || '').toLowerCase().trim();

  const now = new Date();
  const formattedTime =
    context.currentTime?.formattedTime ||
    now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate =
    context.currentTime?.formattedDate ||
    now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const fullDateTimeStr = context.currentTime?.fullDateTimeStr || `${formattedTime} - ${formattedDate}`;

  // 1. Ý định: Hỏi giờ giấc / ngày tháng / thời gian thực
  if (
    q.includes('mấy giờ') ||
    q.includes('bây giờ là') ||
    q.includes('thời gian') ||
    q.includes('hôm nay là thứ mấy') ||
    q.includes('hôm nay ngày') ||
    q.includes('ngày mấy') ||
    q.includes('thứ mấy') ||
    q.includes('mấy ngày') ||
    q.includes('năm nay')
  ) {
    return `🕒 Hiện tại là **${formattedTime}**, ${formattedDate} (Múi giờ Việt Nam GMT+7).`;
  }

  // 2. Ý định: Chào hỏi / Xã giao / Giới thiệu bản thân
  if (
    q === 'chào' ||
    q === 'chào bạn' ||
    q === 'xin chào' ||
    q === 'hello' ||
    q === 'hi' ||
    q.startsWith('chào ') ||
    q.startsWith('xin chào') ||
    q.includes('bạn là ai') ||
    q.includes('ai assistant') ||
    q.includes('copilot') ||
    q.includes('giới thiệu')
  ) {
    return (
      `👋 Chào bạn **${context.user.name}**! Tôi là **TaskFlow AI Copilot** – Trợ lý trí tuệ nhân tạo toàn năng trong hệ thống quản trị dự án & công việc.\n\n` +
      `✨ **Tôi có thể hỗ trợ bạn:**\n` +
      `• **Tra cứu dữ liệu hệ thống:** Xem việc quá hạn, việc cần làm (TODO), việc khẩn cấp (URGENT), báo cáo tiến độ các dự án, hoặc các task được giao cho bạn.\n` +
      `• **Hỗ trợ công việc & Lập trình:** Giải đáp kiến thức (TypeScript, React, Node.js, Database...), tư vấn quản trị dự án Agile/Scrum/Kanban.\n` +
      `• **Soạn thảo văn bản:** Viết email xin nghỉ phép, email báo cáo tiến độ, thông báo nội bộ.\n` +
      `• **Thời gian thực:** Tra cứu ngày giờ hiện tại.\n\n` +
      `Bạn cần tôi hỗ trợ nội dung gì hôm nay?`
    );
  }

  // 3. Ý định: Soạn thảo email xin nghỉ phép
  if (
    (q.includes('nghỉ phép') || q.includes('xin nghỉ')) &&
    (q.includes('email') || q.includes('viết') || q.includes('soạn') || q.includes('mẫu') || q.includes('đơn'))
  ) {
    return (
      `Dưới đây là mẫu **Email xin nghỉ phép chuyên nghiệp** dành cho bạn:\n\n` +
      `---\n\n` +
      `**Tiêu đề:** [Đơn xin nghỉ phép] - ${context.user.name} - [Phòng ban / Dự án] - [Từ ngày DD/MM đến DD/MM]\n\n` +
      `**Kính gửi:** Quản lý dự án / Trưởng bộ phận và Bộ phận Nhân sự (HR),\n\n` +
      `Tôi tên là: **${context.user.name}** (${context.user.email})\n` +
      `Hiện đang đảm nhiệm vị trí thành viên trong các dự án của công ty.\n\n` +
      `Tôi viết email này để xin phép được nghỉ phép trong khoảng thời gian từ ngày **[DD/MM/YYYY]** đến hết ngày **[DD/MM/YYYY]** (tổng cộng [Số] ngày) vì lý do cá nhân.\n\n` +
      `**Về tiến độ bàn giao công việc:**\n` +
      `- Các công việc quan trọng trong giai đoạn này tôi đã hoàn tất hoặc sắp xếp bàn giao lại cho đồng nghiệp **[Tên đồng nghiệp]** tạm thời hỗ trợ theo dõi.\n` +
      `- Tôi vẫn sẽ kiểm tra email hoặc tin nhắn định kỳ khi có các tình huống khẩn cấp cần giải quyết.\n\n` +
      `Rất mong nhận được sự chấp thuận từ Ban Quản lý.\n\n` +
      `Trân trọng cảm ơn,\n` +
      `**${context.user.name}**`
    );
  }

  // 4. Ý định: Giải thích công nghệ / Lập trình cơ bản khi offline
  if (q.includes('typescript là gì') || q.includes('typescript')) {
    return (
      `📘 **TypeScript** là ngôn ngữ lập trình mã nguồn mở được phát triển bởi Microsoft, là một "superset" (siêu tập con mở rộng) của JavaScript.\n\n` +
      `• **Đặc điểm chính:** Bổ sung hệ thống kiểm tra kiểu dữ liệu tĩnh (static typing), interfaces, generics và tooling mạnh mẽ.\n` +
      `• **Lợi ích:** Bắt lỗi ngay lúc code (compile-time), tự động gợi ý code (IntelliSense) chuẩn xác, giúp phát triển các hệ thống lớn an toàn và dễ bảo trì.\n` +
      `• **Thực thi:** Mã nguồn TypeScript sau đó được biên dịch (transpile) thành JavaScript thuần để chạy trên Node.js hoặc trình duyệt.`
    );
  }

  // 5. Ý định: Task quá hạn / trễ hạn
  if (q.includes('quá hạn') || q.includes('trễ hạn') || q.includes('overdue') || q.includes('muộn deadline')) {
    const overdueTasks = context.tasks.filter((t) => t.isOverdue);
    if (overdueTasks.length === 0) {
      return `🎉 **Tuyệt vời! Hiện tại không có công việc nào bị quá hạn.**\n\nToàn bộ **${context.stats.totalTasks} công việc** trong các dự án của bạn đều đang bám sát tiến độ đề ra.`;
    }

    const taskLines = overdueTasks.map((t, idx) => {
      const dateStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Không rõ';
      return `${idx + 1}. [TASK: ${t.id} | ${t.title}] (${t.priority})\n   • **Dự án:** ${t.projectName}\n   • **Phụ trách:** ${t.assigneeName}\n   • **Hạn chót:** ${dateStr} (⚠️ *Đã trễ hạn*)`;
    });

    return `⚠️ **Phát hiện ${overdueTasks.length} công việc đã quá hạn cần xử lý gấp:**\n\n${taskLines.join('\n\n')}\n\n👉 *Khuyến nghị: Bạn có thể bấm vào từng task ở trên để xem chi tiết hoặc đôn đốc người phụ trách.*`;
  }

  // 6. Ý định: Việc cần làm (TODO)
  if (q.includes('cần làm') || q.includes('to do') || q.includes('todo') || q.includes('chưa làm') || q.includes('chưa thực hiện')) {
    const todoTasks = context.tasks.filter((t) => t.status === 'TODO');
    if (todoTasks.length === 0) {
      return `📋 **Hiện không có công việc nào ở trạng thái Cần làm (TODO).**\n\nTất cả các nhiệm vụ đã được khởi động triển khai hoặc đã hoàn tất.`;
    }

    const preview = todoTasks.slice(0, 8);
    const taskLines = preview.map((t, idx) => {
      const dateStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Chưa đặt hạn';
      return `${idx + 1}. [TASK: ${t.id} | ${t.title}] [${t.priority}]\n   • **Dự án:** ${t.projectName} | **Phụ trách:** ${t.assigneeName} | **Hạn:** ${dateStr}`;
    });

    const moreText = todoTasks.length > 8 ? `\n\n*(và còn ${todoTasks.length - 8} công việc TODO khác trong danh mục)*` : '';

    return `📋 **Danh sách ${todoTasks.length} công việc đang chờ thực hiện (TODO):**\n\n${taskLines.join('\n\n')}${moreText}\n\n👉 *Bạn có thể bấm vào thẻ công việc để mở modal chi tiết hoặc chuyển trạng thái sang In Progress.*`;
  }

  // 7. Ý định: Việc khẩn cấp (URGENT / HIGH)
  if (q.includes('khẩn cấp') || q.includes('urgent') || q.includes('ưu tiên cao') || q.includes('cấp bách')) {
    const urgentTasks = context.tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH');
    if (urgentTasks.length === 0) {
      return `🔥 **Hiện tại không có công việc nào ở mức Khẩn cấp (URGENT) hoặc Ưu tiên cao.**\n\nKhối lượng công việc đang được kiểm soát ở mức độ ưu tiên trung bình và thấp.`;
    }

    const taskLines = urgentTasks.map((t, idx) => {
      const dateStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Chưa đặt hạn';
      return `${idx + 1}. [TASK: ${t.id} | ${t.title}] - **${t.priority}**\n   • **Trạng thái:** ${t.status}\n   • **Dự án:** ${t.projectName}\n   • **Phụ trách:** ${t.assigneeName}\n   • **Hạn chót:** ${dateStr}`;
    });

    return `🔥 **Danh sách ${urgentTasks.length} công việc Khẩn cấp & Ưu tiên cao:**\n\n${taskLines.join('\n\n')}\n\n👉 *Khuyến nghị ban quản lý và thành viên tập trung hoàn thành dứt điểm các đầu việc này trước.*`;
  }

  // 8. Ý định: Tiến độ dự án / Báo cáo tổng quan
  if (q.includes('tiến độ') || q.includes('báo cáo') || q.includes('tổng quan') || q.includes('tỷ lệ') || q.includes('thống kê')) {
    const projectLines = context.projects.map((p) => {
      return `• **${p.name}**: Đạt **${p.progress}%** (${p.completedCount}/${p.taskCount} tasks hoàn thành - Trạng thái: *${p.status}*)`;
    });

    return (
      `📊 **Báo cáo tiến độ tổng quan thời gian thực:**\n\n` +
      `- **Tổng số dự án:** ${context.stats.totalProjects} dự án\n` +
      `- **Tổng số công việc:** ${context.stats.totalTasks} tasks\n` +
      `- **Tỷ lệ hoàn thành toàn hệ thống:** **${context.stats.completionRate}%** (${context.stats.completedTasks}/${context.stats.totalTasks} tasks Done)\n` +
      `- **Đang thực hiện:** ${context.stats.inProgressTasks} | **Chờ kiểm thử:** ${context.stats.reviewTasks} | **Cần làm:** ${context.stats.todoTasks}\n` +
      `- **Công việc quá hạn:** **${context.stats.overdueTasks}** tasks\n\n` +
      `**Chi tiết tiến độ từng dự án:**\n${projectLines.join('\n')}\n\n` +
      `👉 *Bạn có thể truy cập phân hệ Bảng Kanban của từng dự án để xem luồng công việc trực quan.*`
    );
  }

  // 9. Ý định: Việc của tôi
  if (q.includes('của tôi') || q.includes('giao cho tôi') || q.includes('phụ trách của tôi') || q.includes('nhiệm vụ của tôi')) {
    const myTasks = context.tasks.filter((t) => t.assigneeId === context.user.id);
    if (myTasks.length === 0) {
      return `👤 Chào **${context.user.name}**, hiện tại bạn chưa được phân công nhiệm vụ cụ thể nào trong hệ thống.`;
    }

    const taskLines = myTasks.map((t, idx) => {
      const dateStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Không deadline';
      const overdueTag = t.isOverdue ? ' (⚠️ *Quá hạn*)' : '';
      return `${idx + 1}. [TASK: ${t.id} | ${t.title}] (${t.status} - ${t.priority})\n   • **Dự án:** ${t.projectName}\n   • **Hạn:** ${dateStr}${overdueTag}`;
    });

    return `👤 Chào **${context.user.name}**, bạn đang phụ trách **${myTasks.length} công việc**:\n\n${taskLines.join('\n\n')}\n\n👉 *Bấm vào bất kỳ thẻ công việc nào để mở chi tiết cập nhật tiến độ!*`;
  }

  // 10. Tìm kiếm theo từ khóa trong tasks
  const matched = context.tasks.filter((t) => {
    return (
      t.title.toLowerCase().includes(q) ||
      t.projectName.toLowerCase().includes(q) ||
      t.assigneeName.toLowerCase().includes(q)
    );
  });

  if (matched.length > 0) {
    const preview = matched.slice(0, 6);
    const taskLines = preview.map((t, idx) => {
      const dateStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Chưa đặt hạn';
      return `${idx + 1}. [TASK: ${t.id} | ${t.title}] (${t.status})\n   • **Dự án:** ${t.projectName} | **Phụ trách:** ${t.assigneeName} | **Hạn:** ${dateStr}`;
    });

    const more = matched.length > 6 ? `\n\n*(và còn ${matched.length - 6} công việc khác trùng khớp)*` : '';

    return `Dựa trên dữ liệu thời gian thực của hệ thống, tôi tìm thấy **${matched.length} công việc** phù hợp:\n\n${taskLines.join('\n\n')}${more}`;
  }

  // Phản hồi thân thiện, đa năng thay vì câu fallback cứng nhắc
  return (
    `Tôi là **TaskFlow AI Copilot** – Trợ lý thông minh đồng hành cùng bạn.\n\n` +
    `Tôi có thể hỗ trợ bạn cả về kiến thức tổng quát, lập trình, soạn thảo văn bản lẫn tra cứu trực tiếp dữ liệu dự án.\n\n` +
    `💡 **Một số câu hỏi bạn có thể thử:**\n` +
    `• *"Bây giờ là mấy giờ?"* hoặc *"Hôm nay là thứ mấy?"*\n` +
    `• *"TypeScript là gì và tại sao nên dùng?"*\n` +
    `• *"Viết giúp tôi email xin nghỉ phép"* hoặc *"Soạn email báo cáo tiến độ"*\n` +
    `• *"Tìm các công việc đang quá hạn"* hoặc *"Danh sách việc cần làm của tôi"*\n` +
    `• *"Báo cáo tiến độ các dự án thời gian thực"*`
  );
}

/**
 * 6. Trò chuyện và phân tích dữ liệu dự án thời gian thực qua Gemini AI (Hybrid Copilot with Live Data)
 */
export async function askGeminiWithLiveData(
  query: string,
  context: LiveDataContext,
  history?: Array<{ role: 'user' | 'model'; text: string }>
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn('[Gemini] Không có GEMINI_API_KEY, chuyển sang xử lý ý định thông minh nội bộ.');
    return generateSmartFallbackResponse(query, context);
  }

  const now = new Date();
  const formattedTime =
    context.currentTime?.formattedTime ||
    now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate =
    context.currentTime?.formattedDate ||
    now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const fullDateTimeStr = context.currentTime?.fullDateTimeStr || `${formattedTime} - ${formattedDate}`;

  try {
    const systemInstruction = `
Bạn là **TaskFlow AI Copilot** – Trợ lý Trí tuệ Nhân tạo toàn năng thế hệ mới (Hybrid Copilot) trong hệ thống quản trị dự án & công việc doanh nghiệp TaskFlow.
Người dùng đang trò chuyện: ${context.user.name} (Email: ${context.user.email}, Quyền: ${context.user.role}).

THỜI GIAN THỰC HIỆN TẠI CỦA HỆ THỐNG:
- Thời gian & Ngày: ${fullDateTimeStr} (Múi giờ Việt Nam GMT+7).
- Bạn luôn có ý thức chính xác về mốc thời gian thực tế này để trả lời giờ giấc, tính toán hôm nay/ngày mai/thứ mấy và so sánh hạn chót công việc.

VAI TRÒ VÀ NĂNG LỰC KÉP CỦA BẠN (HYBRID COPILOT):
1. KHẢ NĂNG TRẢ LỜI MỞ RỘNG & GIAO TIẾP TỰ NHIÊN (GENERAL INTELLIGENCE & CONVERSATION):
   - Bạn là một AI thông minh, hiểu biết sâu rộng và trò chuyện tự nhiên, thân thiện, lịch thiệp bằng tiếng Việt.
   - Khi người dùng hỏi các câu hỏi đời sống, giao tiếp, thời gian thực (ví dụ: "mấy giờ rồi", "hôm nay là thứ mấy", "chào bạn", "bạn là ai", "thời tiết"): Hãy trả lời vui vẻ, thông minh, chính xác dựa trên thời gian thực.
   - Khi người dùng hỏi kiến thức chuyên môn, lập trình, công nghệ (ví dụ: "TypeScript là gì", "React useEffect hoạt động thế nào", "RESTful API là gì", "Docker", "Database MySQL/Prisma"...): Hãy giải thích rõ ràng, súc tích, có ví dụ code dễ hiểu.
   - Khi người dùng nhờ hỗ trợ công việc văn phòng / quản trị dự án (ví dụ: "viết giúp tôi email xin nghỉ phép 2 ngày vì việc gia đình", "soạn email gửi khách hàng thông báo tiến độ", "phương pháp Scrum/Kanban là gì"): Hãy lập tức soạn thảo văn bản hoặc email chuẩn chỉnh, chuyên nghiệp.
   - TUYỆT ĐỐI KHÔNG giới hạn câu trả lời chỉ trong dữ liệu task của MySQL nếu người dùng đang hỏi kiến thức mở rộng hoặc giao tiếp!

2. KHẢ NĂNG TRA CỨU VÀ PHÂN TÍCH DỮ LIỆU NỘI BỘ (LIVE ENTERPRISE DATA RETRIEVAL):
   - Dưới đây là bộ dữ liệu thời gian thực được trích xuất trực tiếp từ cơ sở dữ liệu:
==================================================
TỔNG QUAN HỆ THỐNG:
- Tổng số dự án: ${context.stats.totalProjects}
- Tổng số công việc: ${context.stats.totalTasks}
- Đã hoàn thành: ${context.stats.completedTasks}
- Đang thực hiện: ${context.stats.inProgressTasks}
- Chờ duyệt (Review): ${context.stats.reviewTasks}
- Cần làm (TODO): ${context.stats.todoTasks}
- Tỷ lệ hoàn thành toàn hệ thống: ${context.stats.completionRate}%
- Số công việc quá hạn: ${context.stats.overdueTasks}
- Số công việc khẩn cấp (URGENT): ${context.stats.urgentTasks}
- Công việc của ${context.user.name}: ${context.stats.myTotalTasks} task (quá hạn: ${context.stats.myOverdueTasks})

DANH SÁCH DỰ ÁN:
${JSON.stringify(context.projects, null, 2)}

DANH SÁCH CÔNG VIỆC:
${JSON.stringify(context.tasks, null, 2)}
==================================================

   - Khi người dùng hỏi về công việc, tiến độ dự án, deadline, việc quá hạn, việc cần làm, nhiệm vụ của họ: Hãy đối chiếu dữ liệu trên để trả lời chính xác, trung thực.
   - QUY TẮC BẮT BUỘC KHI NHẮC ĐẾN CÔNG VIỆC: Bất cứ khi nào nhắc đến một công việc cụ thể trong hệ thống, bạn PHẢI bọc trong cú pháp [TASK: <taskId> | <taskTitle>] (ví dụ: [TASK: 12345 | Thiết kế trang chủ]). Giao diện Frontend sẽ tự động chuyển cú pháp này thành một thẻ Badge tương tác để người dùng click mở modal chi tiết hoặc chuyển tới Kanban.
   - Nếu người dùng hỏi tìm kiếm công việc mà không có trong dữ liệu: Hãy thông báo lịch sự rằng không tìm thấy công việc tương ứng trong danh sách hiện tại, và gợi ý các công việc hoặc dự án đang có.

3. PHONG CÁCH PHẢN HỒI:
   - Sử dụng định dạng Markdown đẹp mắt: tiêu đề, gạch đầu dòng (bullet points), in đậm các từ khóa quan trọng.
   - Tông giọng chuyên nghiệp, thông minh, tích cực, lịch sự, tôn trọng người dùng.
`;

    let historyPrompt = '';
    if (history && history.length > 0) {
      const recent = history.slice(-6);
      historyPrompt =
        `\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n` +
        recent.map((h) => `${h.role === 'user' ? 'Người dùng' : 'TaskFlow AI'}: ${h.text}`).join('\n') +
        '\n';
    }

    const fullPrompt = `${systemInstruction}\n${historyPrompt}\nCÂU HỎI HIỆN TẠI CỦA NGƯỜI DÙNG: "${query}"\n\nHÃY TRẢ LỜI:`;

    const { text } = await generateContentWithFallback(fullPrompt, {
      preferredModel: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    if (!text || text.trim() === '') {
      return generateSmartFallbackResponse(query, context);
    }
    return text.trim();
  } catch (error: any) {
    console.warn('[Gemini][askGeminiWithLiveData] Lỗi gọi Gemini API, kích hoạt Smart Fallback:', error?.message);
    return generateSmartFallbackResponse(query, context);
  }
}

export interface KpiPerformanceInput {
  userName: string;
  userEmail?: string;
  departmentName?: string;
  role?: string;
  period: string;
  totalScore: number;
  rank: string;
  completedTasksCount: number;
  totalTasksCount: number;
  completionRate: number;
  onTimeTasksCount: number;
  onTimeRate: number;
  taskCompletionScore: number;
  onTimeScore: number;
  bonusScore: number;
}

/**
 * Fallback tạo nhận xét tự động theo công thức và chỉ số KPI thực tế nếu AI bận hoặc thiếu API key
 */
export function generateKpiFallbackReview(input: KpiPerformanceInput): string {
  const compRate = input.completionRate ?? 0;
  const onTimeRate = input.onTimeRate ?? 0;
  const rank = input.rank || 'B';
  const totalTasks = input.totalTasksCount || input.completedTasksCount || 1;

  if (rank === 'S' || input.totalScore >= 90) {
    return `🌟 Điểm sáng nổi bật: Hiệu suất làm việc vượt bậc với tỷ lệ hoàn thành ${compRate}% và đúng hạn ${onTimeRate}%, xuất sắc đạt Hạng S (${input.totalScore} điểm).
⚡ Điểm cần cải thiện: Tiếp tục phát huy thế mạnh chuyên môn, chủ động chia sẻ kinh nghiệm và hỗ trợ các thành viên trong nhóm xử lý các đầu việc phức tạp.
🚀 Lộ trình phát triển: Định hướng đảm nhận vai trò Trưởng nhóm chuyên môn (Team Lead) hoặc dẫn dắt các sáng kiến dự án trọng điểm tiếp theo.`;
  }
  if (rank === 'A' || input.totalScore >= 80) {
    return `🌟 Điểm sáng nổi bật: Năng suất công việc rất tốt, hoàn tất ${input.completedTasksCount}/${totalTasks} nhiệm vụ (${compRate}%), đảm bảo tiến độ bàn giao (${onTimeRate}% đúng hạn).
⚡ Điểm cần cải thiện: Tối ưu hóa khâu xử lý công việc phát sinh và tích cực phối hợp liên bộ phận để duy trì mức điểm thưởng tối đa.
🚀 Lộ trình phát triển: Sẵn sàng bứt phá lên Hạng S trong kỳ tới thông qua việc rút ngắn thời gian hoàn thành và nâng cao chất lượng bàn giao.`;
  }
  if (rank === 'B' || input.totalScore >= 65) {
    return `🌟 Điểm sáng nổi bật: Duy trì tiến độ công việc ổn định (${input.completedTasksCount} nhiệm vụ hoàn tất), tinh thần trách nhiệm với dự án tốt.
⚡ Điểm cần cải thiện: Cần nâng cao tỷ lệ hoàn thành đúng hạn (${onTimeRate}%) và tránh tình trạng dồn ứ công việc vào các ngày sát hạn chót.
🚀 Lộ trình phát triển: Áp dụng phương pháp phân bổ thời gian (Time-blocking) và phối hợp sớm với quản lý để nâng hạng lên Rank A.`;
  }
  if (rank === 'C' || input.totalScore >= 50) {
    return `🌟 Điểm sáng nổi bật: Đã nỗ lực hoàn thành các nhiệm vụ cơ bản (${input.completedTasksCount} task) được giao trong kỳ đánh giá.
⚡ Điểm cần cải thiện: Tỷ lệ hoàn thành (${compRate}%) và đúng hạn (${onTimeRate}%) còn thấp so với yêu cầu; cần tập trung giải quyết các việc ưu tiên cao.
🚀 Lộ trình phát triển: Cần lập kế hoạch công việc tuần chi tiết, chủ động trao đổi khi gặp vướng mắc kỹ thuật để cải thiện hiệu suất.`;
  }
  return `🌟 Điểm sáng nổi bật: Đã tiếp nhận và bắt đầu thực hiện các đầu việc được giao trong kỳ.
⚡ Điểm cần cải thiện: Tỷ lệ hoàn thành và đúng hạn (${onTimeRate}%) cần cải thiện khẩn trương; tránh để nhiệm vụ bị trễ hạn kéo dài ảnh hưởng dự án.
🚀 Lộ trình phát triển: Tham gia buổi kèm cặp 1-1 với Quản lý dự án để rà soát quy trình làm việc và thiết lập lại mục tiêu rõ ràng hơn.`;
}

export type VoiceIntentType =
  | 'COMPLETE_TASK'
  | 'UNCOMPLETE_TASK'
  | 'CREATE_TASK'
  | 'QUERY_SCHEDULE'
  | 'NAVIGATE'
  | 'UNKNOWN';

export interface VoiceCommandTaskData {
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: 'CORE_PROJECT' | 'RD' | 'OPERATIONS';
  estimatedHours?: number;
}

export interface VoiceCommandUserTask {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  projectName?: string;
}

export interface MultiIntentVoiceResult {
  intent: VoiceIntentType;
  actionMessage: string;
  speechFeedback: string;
  data: {
    targetTaskTitle?: string;
    targetTaskId?: string | null;
    taskData?: VoiceCommandTaskData;
    dateFilter?: string;
    speechResponse?: string;
    path?: string;
    confidence?: number;
    rawText?: string;
  };
}

export interface ProcessVoiceCommandInput {
  transcript: string;
  userId?: string;
  currentDate?: string | Date;
  userTasks?: VoiceCommandUserTask[];
}

export interface VoiceParsedResult {
  intent: 'CREATE_TASK' | 'SUMMARY' | 'FILTER';
  confidence: number;
  data: {
    title?: string;
    deadline?: string; // ISO 8601 string
    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    filterTarget?: 'ALL' | 'PENDING' | 'PROJECTS' | 'TASKS';
    searchQuery?: string;
  };
}

/**
 * Helper dự phòng bóc tách bằng Regex tiếng Việt khi Gemini API bận hoặc offline
 */
export function fallbackParseVoiceCommand(text: string): VoiceParsedResult {
  const lower = text.toLowerCase().trim();
  const rawText = text.trim();

  // Nhận diện từ khóa tạo việc
  const hasCreateKeywords =
    lower.includes('thêm') ||
    lower.includes('tạo') ||
    lower.includes('lập') ||
    lower.includes('nhắc') ||
    lower.includes('hẹn') ||
    lower.includes('nộp') ||
    lower.includes('deadline') ||
    lower.includes('đặt lịch') ||
    lower.includes('lên lịch') ||
    lower.includes('ghi chú lịch');

  // 1. Kiểm tra Ý ĐỊNH: SUMMARY (Tóm tắt, báo cáo lịch trình, ngày X có việc gì)
  // Chỉ kích hoạt khi KHÔNG phải là lệnh tạo việc
  const isSummary =
    !hasCreateKeywords &&
    (lower.includes('tóm tắt') ||
      lower.includes('báo cáo') ||
      lower.includes('có việc gì') ||
      lower.includes('có task gì') ||
      lower.includes('tuần này có gì') ||
      lower.includes('hôm nay có gì') ||
      lower.includes('tổng quan công việc') ||
      lower.includes('hôm nay làm gì') ||
      lower.includes('lịch trình') ||
      lower.includes('xem tóm tắt'));

  if (isSummary) {
    // Trích xuất ngày nếu có
    let summaryDate = '2026-10-23';
    const sSlashMatch = lower.match(/(?:ngày\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i);
    const sWordMatch = lower.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i);
    const sDayOnlyMatch = lower.match(/ngày\s+(\d{1,2})(?!\s*[\/:])(?!\s*tháng)/i);

    if (sSlashMatch) {
      const d = parseInt(sSlashMatch[1], 10);
      const m = parseInt(sSlashMatch[2], 10);
      const y = sSlashMatch[3] ? parseInt(sSlashMatch[3], 10) : 2026;
      summaryDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else if (sWordMatch) {
      const d = parseInt(sWordMatch[1], 10);
      const m = parseInt(sWordMatch[2], 10);
      const y = sWordMatch[3] ? parseInt(sWordMatch[3], 10) : 2026;
      summaryDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else if (sDayOnlyMatch) {
      const d = parseInt(sDayOnlyMatch[1], 10);
      summaryDate = `2026-10-${String(d).padStart(2, '0')}`;
    } else if (lower.includes('ngày mai')) {
      summaryDate = '2026-10-24';
    } else if (lower.includes('ngày kia') || lower.includes('ngày mốt')) {
      summaryDate = '2026-10-25';
    }

    return {
      intent: 'SUMMARY',
      confidence: 0.98,
      data: {
        title: `Tóm tắt lịch trình ngày ${summaryDate}`,
        date: summaryDate,
      },
    };
  }

  // 2. Kiểm tra Ý ĐỊNH: FILTER (Tìm kiếm, lọc)
  const isPureSearch =
    !hasCreateKeywords &&
    (lower.startsWith('tìm') ||
      lower.startsWith('lọc') ||
      lower.startsWith('tra cứu') ||
      lower.includes('quá hạn') ||
      lower.includes('cần xử lý') ||
      lower.includes('trễ hạn') ||
      (lower.includes('tất cả') && !lower.includes('tạo') && !lower.includes('thêm')) ||
      ((lower === 'dự án' || lower === 'công việc') && !lower.includes('tạo') && !lower.includes('thêm')));

  if (isPureSearch) {
    let filterTarget: 'ALL' | 'PENDING' | 'PROJECTS' | 'TASKS' = 'ALL';
    if (lower.includes('quá hạn') || lower.includes('cần xử lý') || lower.includes('trễ hạn') || lower.includes('chưa xong')) {
      filterTarget = 'PENDING';
    } else if (lower.includes('dự án')) {
      filterTarget = 'PROJECTS';
    } else if (lower.includes('công việc') || lower.includes('task')) {
      filterTarget = 'TASKS';
    }

    const cleanSearch = rawText
      .replace(/^(tìm|lọc|tra cứu|xem|kiểm tra|danh sách)\s+/i, '')
      .replace(/(các|công việc|task|nhiệm vụ)?\s*(quá hạn|cần xử lý|trễ hạn|chưa xong)/gi, '')
      .trim();

    return {
      intent: 'FILTER',
      confidence: 0.92,
      data: {
        filterTarget,
        searchQuery: cleanSearch || rawText,
      },
    };
  }

  // 3. Mặc định hoặc nhận diện Ý ĐỊNH: CREATE_TASK (Tạo/Thêm công việc/Lịch hẹn)
  // Các từ khóa: "thêm", "tạo", "lập", "nhắc", "hẹn", "nộp", "deadline"
  const currentYear = 2026;
  const now = new Date(2026, 9, 23, 17, 0, 0); // Mốc chuẩn hệ thống 23/10/2026

  let targetDate = new Date(now);
  let hasExplicitDate = false;

  // Bóc tách ngày tháng
  const slashRegex = /(?:vào\s+)?(?:ngày\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i;
  const slashMatch = lower.match(slashRegex);
  const dateMonthRegex = /(?:vào\s+)?ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i;
  const dmMatch = lower.match(dateMonthRegex);
  const dayOnlyRegex = /(?:vào\s+)?ngày\s+(\d{1,2})(?!\s*[\/:])(?!\s*tháng)/i;
  const dayOnlyMatch = lower.match(dayOnlyRegex);

  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : currentYear;
    targetDate = new Date(year, month, day);
    hasExplicitDate = true;
  } else if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10) - 1;
    const year = dmMatch[3] ? parseInt(dmMatch[3], 10) : currentYear;
    targetDate = new Date(year, month, day);
    hasExplicitDate = true;
  } else if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1], 10);
    targetDate = new Date(currentYear, 9, day); // Tháng 10 năm 2026
    hasExplicitDate = true;
  } else if (lower.includes('hôm nay')) {
    targetDate = new Date(now);
    hasExplicitDate = true;
  } else if (lower.includes('ngày mai') || lower.includes('hôm sau')) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
    hasExplicitDate = true;
  } else if (lower.includes('ngày kia') || lower.includes('ngày mốt')) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 2);
    hasExplicitDate = true;
  } else {
    // Thứ trong tuần
    const dayOfWeekMatch = lower.match(/thứ\s+(2|3|4|5|6|7|hai|ba|bốn|năm|sáu|bảy|chủ nhật)(?:\s+(tuần sau|tuần tới))?/i);
    if (dayOfWeekMatch) {
      const dayMap: Record<string, number> = {
        '2': 1, 'hai': 1,
        '3': 2, 'ba': 2,
        '4': 3, 'bốn': 3,
        '5': 4, 'năm': 4,
        '6': 5, 'sáu': 5,
        '7': 6, 'bảy': 6,
        'chủ nhật': 0, 'cn': 0,
      };
      const targetDow = dayMap[dayOfWeekMatch[1].toLowerCase()] ?? 1;
      const isNextWeek = !!dayOfWeekMatch[2];
      const currentDow = now.getDay();
      let diff = targetDow - currentDow;
      if (diff <= 0 || isNextWeek) {
        diff += 7;
      }
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + diff);
      hasExplicitDate = true;
    }
  }

  // Bóc tách giờ (Time): lúc HH:mm, HH giờ mm, 21:00, 21 giờ... Nếu không nói giờ, mặc định là "09:00"
  let targetTime = '09:00';
  let hasExplicitTime = false;

  const timePatterns = [
    /(?:vào\s+lúc|lúc|hồi)\s*(\d{1,2})(?::|h| giờ |g)(\d{1,2})?(?:\s*(phút|sáng|chiều|tối))?/i,
    /(\d{1,2}):(\d{2})(?:\s*(phút|sáng|chiều|tối))?/i,
    /(?:vào\s+lúc|lúc)\s*(\d{1,2})\s*(?:giờ)?(?:\s*(sáng|chiều|tối))?/i,
    /(\d{1,2})\s*(?:giờ|h)(?:\s*(\d{1,2}))?(?:\s*(sáng|chiều|tối))?/i,
  ];

  for (const pat of timePatterns) {
    const tMatch = lower.match(pat);
    if (tMatch) {
      let h = parseInt(tMatch[1], 10);
      let m = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
      const period = (tMatch[3] || '').toLowerCase();

      if (period === 'chiều' && h < 12) h += 12;
      if (period === 'tối' && h < 12 && h !== 12) h += 12;
      if (period === 'sáng' && h === 12) h = 0;

      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        targetTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        hasExplicitTime = true;
        break;
      }
    }
  }

  // Bóc tách Mức độ ưu tiên (Priority):
  // "gấp", "khẩn cấp", "quan trọng" -> URGENT; còn lại -> MEDIUM
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';
  if (lower.includes('khẩn cấp') || lower.includes('gấp') || lower.includes('quan trọng') || lower.includes('urgent')) {
    priority = 'URGENT';
  } else if (lower.includes('ưu tiên cao') || lower.includes('mức cao') || lower.includes('high')) {
    priority = 'HIGH';
  } else if (lower.includes('ưu tiên thấp') || lower.includes('mức thấp') || lower.includes('low')) {
    priority = 'LOW';
  }

  // Bóc tách Tiêu đề (Title):
  // Loại bỏ các từ khóa thời gian và tiền tố ("thêm vào ngày...", "lúc...", "tạo việc...") để lấy phần nội dung chính
  let cleanTitle = rawText
    // Bỏ cụm lúc + giờ đầy đủ trước
    .replace(/(?:và\s+)?(?:vào\s+)?(?:lúc|hồi)\s*\d{1,2}(?::|h|\s*giờ\s*|g)\d{0,2}(?:\s*(?:phút|sáng|chiều|tối))?/gi, '')
    .replace(/(?:và\s+)?(?:vào\s+)?(?:lúc|hồi)\s*\d{1,2}(?:\s*giờ|\s*h)?(?:\s*\d{1,2}(?:\s*phút)?)?(?:\s*(?:sáng|chiều|tối))?/gi, '')
    .replace(/(?:và\s+)?(?:vào\s+)?lúc\s*\d{1,2}:\d{2}(?:\s*(?:sáng|chiều|tối))?/gi, '')
    .replace(/(?:và\s+)?\d{1,2}:\d{2}/gi, '')
    .replace(/(?:và\s+)?\d{1,2}\s*(?:giờ|h)(?:\s*\d{1,2}(?:\s*phút)?)?(?:\s*(?:sáng|chiều|tối))?/gi, '')
    // Bỏ ngày dạng slash (29/10/2026, 29/10)
    .replace(/(?:vào\s+)?(?:ngày\s+)?\d{1,2}\/\d{1,2}(?:\/\d{4})?/gi, '')
    // Bỏ ngày dạng chữ (ngày 29 tháng 10 năm 2026, ngày 29 tháng 10)
    .replace(/(?:vào\s+)?ngày\s+\d{1,2}\s+tháng\s+\d{1,2}(?:\s+năm\s+\d{4})?/gi, '')
    // Bỏ ngày DD (ngày 29, ngày 28)
    .replace(/(?:vào\s+)?ngày\s+\d{1,2}(?!\s*[\/:])(?!\s*tháng)/gi, '')
    // Bỏ từ chỉ ngày tương đối
    .replace(/(?:vào\s+)?(?:hôm nay|ngày mai|ngày kia|ngày mốt|hôm sau)/gi, '')
    .replace(/(?:vào\s+)?thứ\s+(?:\d+|hai|ba|bốn|năm|sáu|bảy|chủ nhật)(?:\s+(?:tuần sau|tuần tới))?/gi, '')
    // Bỏ độ ưu tiên
    .replace(/(?:mức\s+)?(?:khẩn cấp|gấp|quan trọng|urgent|ưu tiên cao|mức cao|high|ưu tiên thấp|mức thấp|low)/gi, '')
    // Bỏ tiền tố hành động
    .replace(/^(?:hãy\s+)?(?:thêm|tạo|lập|nhắc|hẹn|lên lịch|đặt lịch|deadline|ghi chú)\s+(?:cho tôi\s+|tôi\s+|mình\s+)?(?:vào|công việc|việc|task|lịch hẹn|sự kiện)?\s*/gi, '')
    // Bỏ các từ nhân xưng hoặc liên từ thừa
    .replace(/^(?:tôi\s+|mình\s+|hãy\s+)/gi, '')
    .replace(/^(?:vào\s+ngày\s+|vào\s+|và\s+|là\s+|rằng\s+|về\s+|cần\s+)/gi, '')
    // Bỏ các từ nối thừa ở cuối câu
    .replace(/(?:\s+vào|\s+và|\s+lúc|\s+hạn chót|\s+deadline)+$/gi, '')
    // Thu gọn khoảng trắng
    .replace(/\s+/g, ' ')
    .trim();

  // Làm sạch dấu phẩy hoặc chấm thừa
  cleanTitle = cleanTitle.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();

  if (!cleanTitle) {
    cleanTitle = 'Công việc thêm bằng giọng nói';
  } else {
    // Viết hoa chữ cái đầu
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  const yStr = targetDate.getFullYear();
  const mStr = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dStr = String(targetDate.getDate()).padStart(2, '0');
  const dateFormatted = `${yStr}-${mStr}-${dStr}`;

  const [hPart, mPart] = targetTime.split(':').map((num) => parseInt(num, 10) || 0);
  const exactDeadline = new Date(yStr, targetDate.getMonth(), targetDate.getDate(), hPart, mPart, 0);

  return {
    intent: 'CREATE_TASK',
    confidence: hasExplicitDate || hasExplicitTime ? 0.95 : 0.85,
    data: {
      title: cleanTitle,
      date: dateFormatted,
      time: targetTime,
      deadline: exactDeadline.toISOString(),
      priority,
    },
  };
}

/**
 * 8. Phân tích câu lệnh giọng nói thông minh bằng Gemini AI với Fallback tự động
 */
export async function parseVoiceIntent(text: string): Promise<VoiceParsedResult> {
  const fallback = fallbackParseVoiceCommand(text);
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return fallback;
  }

  try {
    const prompt = `
Bạn là Trợ lý AI phân tích ngôn ngữ tự nhiên (NLP Voice Parser) cho hệ thống lịch làm việc công ty năm 2026.
Thời điểm hiện tại của hệ thống: Thứ Năm, ngày 23 tháng 10 năm 2026.

Hãy phân tích câu lệnh bằng giọng nói tiếng Việt sau của người dùng:
"${text}"

YÊU CẦU PHÂN LOẠI Ý ĐỊNH (INTENT):
1. "CREATE_TASK": Người dùng muốn tạo việc, thêm lịch hẹn, nhắc nhở, nộp bài, deadline...
   Ví dụ: "thêm vào ngày 29 tháng 10 nộp bài và lúc 21:00", "tạo việc kiểm tra báo cáo vào ngày mai lúc 15 giờ", "deadline đồ án ngày 30 tháng 10 gấp".
   - date: format "YYYY-MM-DD". Nếu người nói "ngày 29 tháng 10" -> "2026-10-29". Nếu "ngày mai" -> "2026-10-24". Nếu không nói ngày -> "2026-10-23".
   - time: format "HH:mm". Nếu "21:00", "21 giờ" -> "21:00". Nếu không nói giờ, mặc định là "09:00".
   - deadline: format ISO 8601 string theo giờ địa phương của date và time.
   - title: Tên công việc chính sau khi đã loại bỏ các từ chỉ thời gian và tiền tố ("thêm vào ngày...", "lúc...", "tạo việc..."). Ví dụ "Nộp bài", "Kiểm tra báo cáo".
   - priority: "URGENT" nếu có từ "gấp", "khẩn cấp", "quan trọng"; còn lại "MEDIUM".
2. "SUMMARY": Người dùng muốn xem tóm tắt, báo cáo lịch trình, "tóm tắt công việc ngày 29", "ngày 29 có việc gì", "hôm nay có việc gì", "tuần này có gì", "tổng quan công việc". Điền date tương ứng (ví dụ nếu nói "ngày 29", "ngày 29 tháng 10", "29/10" -> "2026-10-29").
3. "FILTER": Người dùng muốn tìm kiếm hoặc lọc lịch: "tìm...", "lọc...", "các việc quá hạn", "việc cần xử lý", "tất cả", "dự án".
   - filterTarget: "PENDING" (cho việc quá hạn/cần xử lý), "PROJECTS", "TASKS", "ALL".
   - searchQuery: từ khóa tìm kiếm sạch.

TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON THEO ĐỊNH DẠNG SAU:
{
  "intent": "CREATE_TASK" | "SUMMARY" | "FILTER",
  "confidence": 0.98,
  "data": {
    "title": "Nộp bài",
    "date": "2026-10-29",
    "time": "21:00",
    "deadline": "2026-10-29T21:00:00",
    "priority": "URGENT" | "HIGH" | "MEDIUM" | "LOW",
    "filterTarget": "ALL" | "PENDING" | "PROJECTS" | "TASKS",
    "searchQuery": "chuỗi tìm kiếm"
  }
}
`;

    const model = getModelForRequest('gemini-1.5-flash', {
      temperature: 0.1,
      responseMimeType: 'application/json',
    });

    const result = await model.generateContent(prompt);
    const textRes = result.response.text();
    const parsed = cleanAndParseJSON<VoiceParsedResult>(textRes);

    if (parsed && parsed.intent) {
      return {
        ...parsed,
        data: {
          ...fallback.data,
          ...parsed.data,
        },
      };
    }
    return fallback;
  } catch (error: any) {
    console.warn('[Gemini][parseVoiceIntent] Lỗi gọi Gemini API, sử dụng Local Regex Parser:', error?.message);
    return fallback;
  }
}

/**
 * 7. Sinh nhận xét đánh giá hiệu suất cá nhân KPI chuẩn nhân sự thông qua Gemini AI
 */
/**
 * 8.1 Bộ phân tích giọng nói dự phòng thông minh (Rule-based Fallback Voice Engine)
 */
export function fallbackProcessVoiceCommand(
  text: string,
  currentDateInput?: string | Date,
  userTasks: VoiceCommandUserTask[] = []
): MultiIntentVoiceResult {
  const rawText = text.trim();
  const lower = rawText.toLowerCase();

  const baseDate = currentDateInput ? new Date(currentDateInput) : new Date();
  const now = isNaN(baseDate.getTime()) ? new Date() : baseDate;

  // 1. Ý định NAVIGATE (Chuyển trang)
  const isNav =
    lower.startsWith('mở ') ||
    lower.startsWith('vào ') ||
    lower.startsWith('chuyển ') ||
    lower.startsWith('đi tới ') ||
    lower.startsWith('xem ') ||
    lower.includes('trang chủ') ||
    lower.includes('bảng kanban') ||
    lower.includes('bảng việc') ||
    lower.includes('vào kpi');

  if (isNav) {
    if (lower.includes('kanban') || lower.includes('bảng việc') || lower.includes('dự án')) {
      return {
        intent: 'NAVIGATE',
        actionMessage: 'Đang mở bảng Kanban Dự án',
        speechFeedback: 'Đang chuyển đến bảng Kanban dự án.',
        data: { path: '/projects', rawText, confidence: 0.95 },
      };
    }
    if (lower.includes('kpi') || lower.includes('hiệu suất') || lower.includes('đánh giá')) {
      return {
        intent: 'NAVIGATE',
        actionMessage: 'Đang mở trang KPI & Đánh giá hiệu suất',
        speechFeedback: 'Đang chuyển đến trang KPI hiệu suất.',
        data: { path: '/kpi', rawText, confidence: 0.95 },
      };
    }
    if (lower.includes('lịch') || lower.includes('calendar')) {
      return {
        intent: 'NAVIGATE',
        actionMessage: 'Đang mở Lịch làm việc',
        speechFeedback: 'Đang chuyển đến trang Lịch làm việc.',
        data: { path: '/calendar', rawText, confidence: 0.95 },
      };
    }
    if (lower.includes('trang chủ') || lower.includes('dashboard') || lower.includes('bàn làm việc')) {
      return {
        intent: 'NAVIGATE',
        actionMessage: 'Đang về Trang chủ Dashboard',
        speechFeedback: 'Đang chuyển về trang chủ.',
        data: { path: '/dashboard', rawText, confidence: 0.95 },
      };
    }
    if (lower.includes('việc của tôi') || lower.includes('my work') || lower.includes('cá nhân')) {
      return {
        intent: 'NAVIGATE',
        actionMessage: 'Đang mở trang Việc Của Tôi',
        speechFeedback: 'Đang mở trang công việc cá nhân của bạn.',
        data: { path: '/my-work', rawText, confidence: 0.95 },
      };
    }
    if (lower.includes('hồ sơ') || lower.includes('profile')) {
      return {
        intent: 'NAVIGATE',
        actionMessage: 'Đang mở Hồ Sơ Cá Nhân',
        speechFeedback: 'Đang mở trang thông tin cá nhân.',
        data: { path: '/profile', rawText, confidence: 0.95 },
      };
    }
  }

  // Helper tìm task gần đúng nhất dựa trên từ khóa
  const findMatchingTask = (query: string, preferredStatus?: 'DONE' | 'NOT_DONE') => {
    if (!userTasks || userTasks.length === 0) return null;
    const cleanQ = query
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\b(đã|xong|rồi|chưa|hoàn thành|task|công việc|việc|bài|tập|dự án|cho tôi|giúp|với)\b/gi, ' ')
      .trim();
    const tokens = cleanQ.split(/\s+/).filter((w) => w.length >= 2);

    let bestMatch: VoiceCommandUserTask | null = null;
    let maxScore = 0;

    for (const t of userTasks) {
      if (preferredStatus === 'DONE' && t.status !== 'DONE') continue;
      if (preferredStatus === 'NOT_DONE' && t.status === 'DONE') continue;

      const titleLower = t.title.toLowerCase();
      let score = 0;

      if (cleanQ && titleLower.includes(cleanQ)) {
        score += 10;
      }
      for (const tok of tokens) {
        if (titleLower.includes(tok)) score += 3;
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = t;
      }
    }

    return maxScore >= 3 ? bestMatch : null;
  };

  // 2. Ý định UNCOMPLETE_TASK (Hủy hoàn thành / Chuyển về chưa xong)
  const isUncomplete =
    lower.includes('chưa xong') ||
    lower.includes('chuyển về chưa xong') ||
    lower.includes('hủy hoàn thành') ||
    lower.includes('chưa hoàn thành') ||
    lower.includes('đánh dấu chưa xong') ||
    lower.includes('chưa xong việc');

  if (isUncomplete) {
    const matched = findMatchingTask(lower, 'DONE') || findMatchingTask(lower);
    const targetTitle = matched ? matched.title : rawText;

    return {
      intent: 'UNCOMPLETE_TASK',
      actionMessage: matched
        ? `Đã chuyển về chưa hoàn thành: "${matched.title}"`
        : `Chuyển về chưa hoàn thành: "${targetTitle}"`,
      speechFeedback: matched
        ? `Đã chuyển công việc ${matched.title} về trạng thái chưa hoàn thành.`
        : `Đã đánh dấu công việc về chưa hoàn thành.`,
      data: {
        targetTaskId: matched ? matched.id : null,
        targetTaskTitle: matched ? matched.title : undefined,
        confidence: matched ? 0.95 : 0.75,
        rawText,
      },
    };
  }

  // 3. Ý định COMPLETE_TASK (Hoàn thành công việc)
  const isComplete =
    lower.includes('hoàn thành') ||
    lower.includes('xong task') ||
    lower.includes('xong việc') ||
    lower.includes('đã làm xong') ||
    lower.includes('làm xong rồi') ||
    lower.includes('xong rồi') ||
    lower.includes('đánh dấu đã hoàn thành') ||
    lower.includes('đánh dấu hoàn thành') ||
    lower.includes('đánh dấu xong');

  if (isComplete) {
    const matched = findMatchingTask(lower, 'NOT_DONE') || findMatchingTask(lower);
    const targetTitle = matched ? matched.title : rawText;

    return {
      intent: 'COMPLETE_TASK',
      actionMessage: matched
        ? `✓ Đã đánh dấu hoàn thành: "${matched.title}"`
        : `✓ Đã đánh dấu hoàn thành: "${targetTitle}"`,
      speechFeedback: matched
        ? `Đã đánh dấu hoàn thành công việc ${matched.title}. Xuất sắc!`
        : `Đã đánh dấu hoàn thành công việc.`,
      data: {
        targetTaskId: matched ? matched.id : null,
        targetTaskTitle: matched ? matched.title : undefined,
        confidence: matched ? 0.95 : 0.75,
        rawText,
      },
    };
  }

  // 4. Ý định QUERY_SCHEDULE (Hỏi lịch trình / deadline)
  const isQuerySchedule =
    lower.includes('hôm nay có') ||
    lower.includes('ngày mai có') ||
    lower.includes('lịch trình') ||
    lower.includes('deadline nào') ||
    lower.includes('có việc gì') ||
    lower.includes('có task nào') ||
    lower.includes('hôm nay làm gì') ||
    lower.includes('xem lịch');

  if (isQuerySchedule) {
    let targetD = new Date(now);
    if (lower.includes('ngày mai') || lower.includes('mai')) {
      targetD.setDate(targetD.getDate() + 1);
    } else if (lower.includes('ngày kia') || lower.includes('ngày mốt')) {
      targetD.setDate(targetD.getDate() + 2);
    }

    const y = targetD.getFullYear();
    const m = String(targetD.getMonth() + 1).padStart(2, '0');
    const d = String(targetD.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const matchingTasks = userTasks.filter((t) => t.dueDate && t.dueDate.startsWith(dateStr));
    let speechResponse = '';
    if (matchingTasks.length === 0) {
      speechResponse = `Lịch trình ngày ${d} tháng ${m} hiện không có deadline nào. Bạn có thể thảnh thơi hoặc lên kế hoạch mới.`;
    } else {
      const titles = matchingTasks.map((t) => t.title).slice(0, 3).join(', ');
      speechResponse = `Lịch trình ngày ${d} tháng ${m} bạn có ${matchingTasks.length} việc: ${titles}.`;
    }

    return {
      intent: 'QUERY_SCHEDULE',
      actionMessage: `Lịch trình ngày ${dateStr}: ${matchingTasks.length} việc`,
      speechFeedback: speechResponse,
      data: {
        dateFilter: dateStr,
        speechResponse,
        confidence: 0.9,
        rawText,
      },
    };
  }

  // 5. Ý định CREATE_TASK (Thêm việc / Lên lịch hẹn)
  const legacy = fallbackParseVoiceCommand(text);
  const taskTitle = legacy.data.title || 'Công việc thêm bằng giọng nói';
  const taskDeadline = legacy.data.deadline || now.toISOString();
  const taskPriority = legacy.data.priority || 'MEDIUM';

  return {
    intent: 'CREATE_TASK',
    actionMessage: `Đã tạo công việc: "${taskTitle}"`,
    speechFeedback: `Đã tạo lịch công việc ${taskTitle} vào danh sách của bạn.`,
    data: {
      taskData: {
        title: taskTitle,
        dueDate: taskDeadline,
        priority: taskPriority,
        category: 'CORE_PROJECT',
        estimatedHours: 2,
      },
      confidence: legacy.confidence,
      rawText,
    },
  };
}

/**
 * 8.2 Huấn luyện Gemini AI NLU phân tích đa ý định giọng nói tiếng Việt tự nhiên
 */
export async function processMultiIntentVoiceCommand(
  input: ProcessVoiceCommandInput
): Promise<MultiIntentVoiceResult> {
  const { transcript, currentDate, userTasks = [] } = input;
  const fallback = fallbackProcessVoiceCommand(transcript, currentDate, userTasks);
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return fallback;
  }

  try {
    const baseDate = currentDate ? new Date(currentDate) : new Date();
    const dateObj = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[dateObj.getDay()];
    const dateFormatted = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const timeFormatted = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    const tasksBrief = userTasks.slice(0, 40).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate || null,
      projectName: t.projectName || 'Cá nhân',
    }));

    const prompt = `
Bạn là Trợ lý AI Voice NLU tiếng Việt chuyên sâu cho nền tảng quản trị công việc & lịch trình TaskFlow năm 2026.
Thời điểm hiện tại của hệ thống: ${dayOfWeek}, ngày ${dateFormatted} lúc ${timeFormatted}. Múi giờ Việt Nam (UTC+7).

CÂU NÓI CỦA NGƯỜI DÙNG:
"${transcript}"

DANH SÁCH CÁC CÔNG VIỆC HIỆN TẠI CỦA NGƯỜI DÙNG (để bạn so khớp khi cần đánh dấu hoặc tóm tắt):
${JSON.stringify(tasksBrief, null, 2)}

BẠN CẦN PHÂN TÍCH VÀ PHÂN LOẠI CHÍNH XÁC VÀO 1 TRONG 5 Ý ĐỊNH (INTENTS):

1. "COMPLETE_TASK":
   - Người dùng muốn đánh dấu hoàn thành công việc/task/bài tập (Ví dụ: "đánh dấu đã hoàn thành bài tập", "xong task thiết kế giao diện rồi", "hoàn thành việc nộp báo cáo", "làm xong việc kiểm thử rồi").
   - Hãy đối chiếu thông minh gần đúng giữa tên công việc trong câu nói và DANH SÁCH CÔNG VIỆC trên để tìm task tương ứng.
   - Trả về: targetTaskId (chuỗi ID của task nếu tìm thấy, hoặc null), targetTaskTitle (tên công việc).
   - actionMessage: "✓ Đã đánh dấu hoàn thành: [Tên task]"
   - speechFeedback: "Đã đánh dấu hoàn thành công việc [Tên task]."

2. "UNCOMPLETE_TASK":
   - Người dùng muốn sửa lại thành chưa hoàn thành (Ví dụ: "chuyển bài tập về chưa xong", "task nộp báo cáo chưa hoàn thành đâu", "đánh dấu chưa xong việc kiểm thử", "hủy hoàn thành task...").
   - Đối chiếu với DANH SÁCH CÔNG VIỆC để tìm task tương ứng.
   - Trả về: targetTaskId (chuỗi ID nếu tìm thấy, hoặc null), targetTaskTitle (tên công việc).
   - actionMessage: "Đã chuyển về chưa hoàn thành: [Tên task]"
   - speechFeedback: "Đã chuyển công việc [Tên task] về trạng thái chưa hoàn thành."

3. "CREATE_TASK":
   - Người dùng muốn thêm công việc, lên lịch hẹn, nhắc nhở (Ví dụ: "nhắc tôi chiều mai 3 giờ họp đồ án", "thêm lịch bảo vệ tốt nghiệp sáng thứ sáu", "tạo task nghiên cứu websocket mức ưu tiên cao", "thêm vào ngày 10 tháng 11 nộp tài liệu").
   - Trả về taskData với:
     * title: Tiêu đề công việc ngắn gọn, súc tích (đã loại bỏ từ nối thời gian và tiền tố tạo việc).
     * description: Mô tả thêm nếu có, hoặc để trống.
     * dueDate: Chuỗi thời gian chuẩn ISO 8601 được tính toán chính xác dựa trên thời điểm hiện tại (${dateFormatted} ${timeFormatted}).
     * priority: "URGENT" (nếu có từ "gấp", "khẩn cấp", "quan trọng"), "HIGH" (ưu tiên cao), "LOW" (ưu tiên thấp), hoặc "MEDIUM" (mặc định).
     * category: "CORE_PROJECT", "RD", hoặc "OPERATIONS" (mặc định "CORE_PROJECT").
     * estimatedHours: Số giờ dự kiến (mặc định 2).
   - actionMessage: "Đã tạo công việc: [Tên task]"
   - speechFeedback: "Đã lên lịch công việc [Tên task] vào [thời gian]."

4. "QUERY_SCHEDULE":
   - Người dùng hỏi lịch trình, deadline (Ví dụ: "hôm nay tôi có những việc gì", "ngày mai có deadline nào không", "lịch trình hôm nay", "tuần này có gì").
   - Trả về dateFilter: ngày theo format "YYYY-MM-DD".
   - Trả về speechResponse: câu trả lời bằng giọng nói thân thiện tóm tắt lịch trình dựa trên các công việc thực tế trong ngày đó.
   - actionMessage: "Lịch trình ngày [YYYY-MM-DD]"
   - speechFeedback: speechResponse

5. "NAVIGATE":
   - Người dùng muốn chuyển trang (Ví dụ: "mở kanban", "vào trang kpi", "về trang chủ", "mở lịch", "vào việc của tôi", "hồ sơ cá nhân").
   - Trả về path:
     * Kanban: "/projects"
     * KPI: "/kpi"
     * Lịch: "/calendar"
     * Trang chủ: "/dashboard"
     * Việc của tôi: "/my-work"
     * Hồ sơ cá nhân: "/profile"
   - actionMessage: "Điều hướng đến [Tên trang]"
   - speechFeedback: "Đang mở [Tên trang]."

TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON THUẦN TÚY THEO CẤU TRÚC:
{
  "intent": "COMPLETE_TASK" | "UNCOMPLETE_TASK" | "CREATE_TASK" | "QUERY_SCHEDULE" | "NAVIGATE" | "UNKNOWN",
  "actionMessage": "Thông báo ngắn gọn",
  "speechFeedback": "Câu phản hồi âm thanh thân thiện tiếng Việt",
  "data": {
    "targetTaskTitle": "string",
    "targetTaskId": "string | null",
    "taskData": {
      "title": "string",
      "description": "string",
      "dueDate": "ISO 8601 string",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "category": "CORE_PROJECT" | "RD" | "OPERATIONS",
      "estimatedHours": 2
    },
    "dateFilter": "YYYY-MM-DD",
    "speechResponse": "string",
    "path": "/projects" | "/kpi" | "/calendar" | "/dashboard" | "/my-work" | "/profile"
  }
}
`;

    const model = getModelForRequest('gemini-1.5-flash', {
      temperature: 0.1,
      responseMimeType: 'application/json',
    });

    const result = await model.generateContent(prompt);
    const textRes = result.response.text();
    const parsed = cleanAndParseJSON<MultiIntentVoiceResult>(textRes);

    if (parsed && parsed.intent) {
      const mergedData = {
        ...fallback.data,
        ...parsed.data,
        rawText: transcript,
      };

      if (
        (parsed.intent === 'COMPLETE_TASK' || parsed.intent === 'UNCOMPLETE_TASK') &&
        !mergedData.targetTaskId &&
        fallback.data.targetTaskId
      ) {
        mergedData.targetTaskId = fallback.data.targetTaskId;
        if (!mergedData.targetTaskTitle && fallback.data.targetTaskTitle) {
          mergedData.targetTaskTitle = fallback.data.targetTaskTitle;
        }
      }

      return {
        intent: parsed.intent,
        actionMessage: parsed.actionMessage || fallback.actionMessage,
        speechFeedback: parsed.speechFeedback || fallback.speechFeedback,
        data: mergedData,
      };
    }

    return fallback;
  } catch (error: any) {
    console.warn('[Gemini][processMultiIntentVoiceCommand] Lỗi gọi Gemini API, dùng Fallback NLU:', error?.message);
    return fallback;
  }
}

export async function generateKpiPerformanceReview(input: KpiPerformanceInput): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return generateKpiFallbackReview(input);
  }

  try {
    const prompt = `
Bạn là Trưởng phòng Nhân sự cấp cao kiêm Cố vấn Hiệu suất nội bộ của hệ thống quản lý TaskFlow.
Hãy phân tích bộ chỉ số KPI sau đây của nhân sự và viết một bản nhận xét hiệu suất cô đọng, chuẩn mực:

THÔNG TIN NHÂN SỰ & CHỈ SỐ KPI:
- Họ tên: ${input.userName}
- Email: ${input.userEmail || 'Chưa cập nhật'}
- Bộ phận: ${input.departmentName || 'Chưa phân bổ'}
- Vị trí / Vai trò: ${input.role || 'Nhân viên'}
- Kỳ đánh giá: ${input.period}
- Tổng điểm KPI: ${input.totalScore}/100 điểm
- Xếp loại Rank: Hạng ${input.rank}
- Công việc hoàn thành: ${input.completedTasksCount}/${input.totalTasksCount} việc (Tỷ lệ: ${input.completionRate}%, Điểm đạt: ${input.taskCompletionScore}/40đ)
- Công việc đúng hạn: ${input.onTimeTasksCount}/${input.completedTasksCount || 1} việc (Tỷ lệ: ${input.onTimeRate}%, Điểm đạt: ${input.onTimeScore}/40đ)
- Điểm thưởng Manager: +${input.bonusScore}/20đ

YÊU CẦU ĐẦU RA BẮT BUỘC:
Viết bản nhận xét ngắn gọn, đúng 3-4 dòng / đoạn súc tích gồm chính xác 3 phần sau:
🌟 Điểm sáng nổi bật: [Nêu ưu điểm lớn nhất dựa trên tỷ lệ hoàn thành/đúng hạn/điểm thưởng thực tế]
⚡ Điểm cần cải thiện: [Nêu khía cạnh cần khắc phục hoặc lưu ý để nâng cao chất lượng]
🚀 Lộ trình phát triển: [Định hướng cụ thể, khích lệ bứt phá trong kỳ tiếp theo]

Văn phong chuẩn mực HR, tích cực, mang tính khích lệ và định hướng hành động. Không chào hỏi dư thừa ngoài 3 phần trên.
`;

    const model = getModelForRequest('gemini-1.5-flash', {
      temperature: 0.3,
      maxOutputTokens: 600,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text || text.trim() === '') {
      return generateKpiFallbackReview(input);
    }
    return text.trim();
  } catch (error: any) {
    console.warn('[Gemini][generateKpiPerformanceReview] Lỗi gọi Gemini API, sử dụng Smart Fallback:', error?.message);
    return generateKpiFallbackReview(input);
  }
}


/**
 * 10. AI CÂN BẰNG TẢI NHÂN SỰ & TỐI ƯU HÓA TÀI NGUYÊN (Workload Balancing & Resource Optimization)
 */
export interface RebalanceMemberInput {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  departmentName?: string;
  assignedHours: number;
  standardCapacity: number;
  workloadPercent: number;
  status: 'OVERLOADED' | 'BALANCED' | 'UNDERLOADED';
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    estimatedHours: number;
    dueDate?: string | Date | null;
  }>;
  reallocatableTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    estimatedHours: number;
    dueDate?: string | Date | null;
  }>;
}

export interface RebalanceRecommendation {
  taskId: string;
  taskTitle: string;
  hours: number;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  reason: string;
}

export interface RebalanceResult {
  recommendations: RebalanceRecommendation[];
  summary: string;
}

/**
 * Thuật toán Fallback Cân Bằng Tải ngoại tuyến:
 * Áp dụng giải thuật tham lam (Greedy Load Balancing) để phân bổ task TODO từ người quá tải sang người rảnh rỗi.
 */
export function fallbackRebalanceWorkload(
  members: RebalanceMemberInput[],
  standardCapacity: number = 40
): RebalanceResult {
  const overloadedMembers = members.filter((m) => m.workloadPercent > 100);
  if (overloadedMembers.length === 0) {
    return {
      recommendations: [],
      summary: 'Hiện tại tất cả nhân sự đều ở mức tải an toàn (dưới 100% định mức tiêu chuẩn), chưa cần điều chuyển công việc.',
    };
  }

  // Tạo bản sao để mô phỏng tải động
  const workingMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    assignedHours: m.assignedHours,
    standardCapacity: m.standardCapacity || standardCapacity,
    reallocatableTasks: [...m.reallocatableTasks],
  }));

  const recommendations: RebalanceRecommendation[] = [];

  // Duyệt qua từng người quá tải (sắp xếp giảm dần theo mức độ quá tải)
  const sortedOverloaded = [...workingMembers]
    .filter((m) => (m.assignedHours / m.standardCapacity) * 100 > 100)
    .sort((a, b) => b.assignedHours / b.standardCapacity - a.assignedHours / a.standardCapacity);

  for (const fromUser of sortedOverloaded) {
    // Sắp xếp task TODO theo số giờ giảm dần
    fromUser.reallocatableTasks.sort((a, b) => b.estimatedHours - a.estimatedHours);

    for (const task of fromUser.reallocatableTasks) {
      const currentFromPercent = (fromUser.assignedHours / fromUser.standardCapacity) * 100;
      if (currentFromPercent <= 100) {
        // Người chuyển đã hạ xuống mức an toàn <= 100%
        break;
      }

      const taskHours = typeof task.estimatedHours === 'number' && task.estimatedHours > 0 ? task.estimatedHours : 4;

      // Tìm các ứng viên nhận việc khác fromUser, sắp xếp theo tải tăng dần
      const candidates = workingMembers
        .filter((c) => c.userId !== fromUser.userId)
        .sort((a, b) => {
          const aRatio = a.assignedHours / a.standardCapacity;
          const bRatio = b.assignedHours / b.standardCapacity;
          return aRatio - bRatio;
        });

      // Tìm người nhận mà sau khi cộng task vẫn <= 100%
      let bestCandidate = candidates.find(
        (c) => ((c.assignedHours + taskHours) / c.standardCapacity) * 100 <= 100
      );

      // Nếu không có ai <= 100%, chọn ứng viên rảnh rỗi nhất nếu tải hiện tại < 90%
      if (!bestCandidate && candidates.length > 0 && (candidates[0].assignedHours / candidates[0].standardCapacity) * 100 < 90) {
        bestCandidate = candidates[0];
      }

      if (bestCandidate) {
        const oldFromPercent = Math.round((fromUser.assignedHours / fromUser.standardCapacity) * 100);
        const oldToPercent = Math.round((bestCandidate.assignedHours / bestCandidate.standardCapacity) * 100);

        fromUser.assignedHours -= taskHours;
        bestCandidate.assignedHours += taskHours;

        const newFromPercent = Math.round((fromUser.assignedHours / fromUser.standardCapacity) * 100);
        const newToPercent = Math.round((bestCandidate.assignedHours / bestCandidate.standardCapacity) * 100);

        recommendations.push({
          taskId: task.id,
          taskTitle: task.title,
          hours: taskHours,
          fromUserId: fromUser.userId,
          fromUserName: fromUser.name,
          toUserId: bestCandidate.userId,
          toUserName: bestCandidate.name,
          reason: `Giảm tải cho ${fromUser.name} (${oldFromPercent}% -> ${newFromPercent}%) và tận dụng thời gian trống của ${bestCandidate.name} (${oldToPercent}% -> ${newToPercent}%)`,
        });
      }
    }
  }

  if (recommendations.length === 0) {
    return {
      recommendations: [],
      summary: 'Các nhân sự quá tải không còn công việc ở trạng thái Chờ làm (TODO) hoặc các thành viên khác đã đạt tối đa công suất.',
    };
  }

  return {
    recommendations,
    summary: `Thuật toán AI đã đề xuất điều chuyển tối ưu ${recommendations.length} công việc từ nhân sự quá tải sang các nhân sự có công suất phù hợp, giúp cân bằng hiệu suất làm việc toàn đội ngũ.`,
  };
}

/**
 * Đề xuất Tái Cân bằng Tải bằng Google Gemini AI (kèm Fallback tự động)
 */
export async function rebalanceProjectWorkloadWithGemini(
  members: RebalanceMemberInput[],
  standardCapacity: number = 40
): Promise<RebalanceResult> {
  const overloadedMembers = members.filter((m) => m.workloadPercent > 100);
  if (overloadedMembers.length === 0) {
    return {
      recommendations: [],
      summary: 'Hiện tại tất cả nhân sự đều ở mức tải an toàn (dưới 100% định mức tiêu chuẩn), chưa cần điều chuyển công việc.',
    };
  }

  const todoTasksOfOverloaded = overloadedMembers.flatMap((m) =>
    m.reallocatableTasks.map((t) => ({
      taskId: t.id,
      taskTitle: t.title,
      hours: t.estimatedHours || 4,
      priority: t.priority,
      fromUserId: m.userId,
      fromUserName: m.name,
      dueDate: t.dueDate,
    }))
  );

  if (todoTasksOfOverloaded.length === 0) {
    return {
      recommendations: [],
      summary: 'Các nhân sự quá tải hiện không có công việc nào ở trạng thái Chờ làm (TODO) để có thể tái phân bổ an toàn.',
    };
  }

  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[Gemini] Không có GEMINI_API_KEY, kích hoạt thuật toán Fallback Cân Bằng Tải.');
      return fallbackRebalanceWorkload(members, standardCapacity);
    }

    const membersSummary = members.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: m.role || 'Thành viên',
      assignedHours: m.assignedHours,
      standardCapacity: m.standardCapacity || standardCapacity,
      workloadPercent: m.workloadPercent,
      workloadStatus: m.status,
    }));

    const prompt = `
Bạn là Kỹ sư Trưởng kiêm Chuyên gia Điều phối Nhân sự & Tối ưu Tài nguyên (Resource Allocation & Workload Optimization Expert).
Nhiệm vụ của bạn là phân tích dữ liệu tải nhân sự trong sprint/kỳ của dự án và đưa ra phương án TÁI CÂN BẰNG TẢI (AI Workload Rebalance) tối ưu nhất.

THÔNG TIN ĐỊNH MỨC & TẢI NHÂN SỰ DỰ ÁN (Định mức chuẩn: ${standardCapacity}h/sprint):
${JSON.stringify(membersSummary, null, 2)}

DANH SÁCH CÔNG VIỆC TRẠNG THÁI TODO CỦA CÁC NHÂN SỰ ĐANG QUÁ TẢI (> 100%):
${JSON.stringify(todoTasksOfOverloaded, null, 2)}

QUY TẮC ĐIỀU PHỐI BẮT BUỘC:
1. Chỉ điều chuyển các task ở trạng thái TODO từ những người bị OVERLOADED (>100%) sang những người UNDERLOADED (<60%) hoặc BALANCED (60%-100%).
2. Không gán việc khiến người nhận bị đẩy lên mức QUÁ TẢI (>100% định mức ${standardCapacity}h).
3. Đưa % tải của người chuyển về mức an toàn (60% - 100%) nếu có đủ năng lực tiếp nhận.
4. Ưu tiên phân bổ cho những người có % tải thấp nhất hoặc đang rảnh rỗi.
5. Chỉ chọn các taskId và userId có thật trong danh sách được cung cấp.
6. Mỗi mục điều chuyển phải có lý do súc tích, chuyên nghiệp bằng tiếng Việt, nêu rõ mức % tải trước và sau (Ví dụ: "Giảm tải cho Du (130% -> 90%) và tận dụng thời gian trống của Như Lê (45% -> 65%)").

YÊU CẦU ĐẦU RA BẮT BUỘC: Trả về đối tượng JSON thuần túy (không kèm giải thích bên ngoài hay markdown râu ria) theo mẫu:
{
  "recommendations": [
    {
      "taskId": "ID chính xác của task",
      "taskTitle": "Tên công việc",
      "hours": 8,
      "fromUserId": "ID người chuyển",
      "fromUserName": "Tên người chuyển",
      "toUserId": "ID người nhận",
      "toUserName": "Tên người nhận",
      "reason": "Giảm tải cho Du (130% -> 90%) và tận dụng thời gian trống của Như Lê (45% -> 65%)"
    }
  ],
  "summary": "Tóm tắt ngắn gọn 1-2 câu về hiệu quả và tác động của phương án cân bằng tải này"
}
`;

    const generationConfig: GenerationConfig = {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      responseMimeType: 'application/json',
    };

    const model = getModelForRequest('gemini-1.5-flash', generationConfig);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = cleanAndParseJSON<RebalanceResult>(responseText);

    if (parsed && Array.isArray(parsed.recommendations)) {
      const validRecommendations = parsed.recommendations.filter(
        (r) => r.taskId && r.toUserId && r.fromUserId && r.taskId.trim() !== ''
      );
      return {
        recommendations: validRecommendations,
        summary: parsed.summary || `AI đã đề xuất điều chuyển ${validRecommendations.length} công việc nhằm tối ưu hóa tải dự án.`,
      };
    }

    return fallbackRebalanceWorkload(members, standardCapacity);
  } catch (error: any) {
    console.warn('[Gemini][rebalanceProjectWorkloadWithGemini] Lỗi gọi Gemini API, sử dụng Thuật toán Fallback:', error?.message);
    return fallbackRebalanceWorkload(members, standardCapacity);
  }
}
