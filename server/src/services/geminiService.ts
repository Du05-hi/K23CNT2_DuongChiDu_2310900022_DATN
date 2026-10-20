import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const AVAILABLE_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'] as const;

const getGeminiApiKey = (): string => process.env.GEMINI_API_KEY?.trim() || '';

const getModelForRequest = (
  preferredModel: string = 'gemini-1.5-flash',
  generationConfig?: GenerationConfig
) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  const modelName = AVAILABLE_MODELS.includes(preferredModel as (typeof AVAILABLE_MODELS)[number])
    ? preferredModel
    : 'gemini-1.5-flash';

  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    ...(generationConfig ? { generationConfig } : {}),
  });
};

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
 * 2. Phân tích danh sách tasks và sinh bản nhận xét tiến độ bằng tiếng Việt dạng Markdown
 */
export async function generateProgressSummary(
  projectName: string,
  tasks: TaskSummaryInput[]
): Promise<string> {
  try {
    const normalizedTasks = tasks.map(normalizeTaskSummaryInput);
    const safeProjectName = normalizeString(projectName, 'Dự án chưa có tên');
    const total = normalizedTasks.length;
    const completed = normalizedTasks.filter((t) => t.status === 'DONE').length;
    const inProgress = normalizedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const review = normalizedTasks.filter((t) => t.status === 'REVIEW').length;
    const todo = normalizedTasks.filter((t) => t.status === 'TODO').length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

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
  try {
    const normalizedTasks = tasks.map(normalizePersonalWorkInsightInput);
    const now = new Date();
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
  try {
    const prompt = `
Bạn là trợ lý AI thông minh phân tích câu truy vấn tìm kiếm công việc của người dùng bằng tiếng Việt.
Hãy phân tích câu sau: "${normalizeString(query, 'công việc')}"

Trích xuất thành đối tượng JSON có các trường sau (nếu câu nói không đề cập trường nào thì để null):
{
  "assigneeName": string hoặc null (ví dụ: "Nguyễn Văn A", "Du", "tôi", "Dương Chí Dự"),
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
