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
}

/**
 * Xử lý ý định thông minh nội bộ (Smart Intent Matching & Graceful Fallback)
 * Đảm bảo 100% trả lời chính xác từ DB ngay cả khi không có kết nối Gemini API
 */
export function generateSmartFallbackResponse(query: string, context: LiveDataContext): string {
  const q = (query || '').toLowerCase().trim();

  // 1. Ý định: Task quá hạn / trễ hạn
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

  // 2. Ý định: Việc cần làm (TODO)
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

  // 3. Ý định: Việc khẩn cấp (URGENT / HIGH)
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

  // 4. Ý định: Tiến độ dự án / Báo cáo tổng quan
  if (q.includes('tiến độ') || q.includes('báo cáo') || q.includes('tổng quan') || q.includes('tỷ lệ') || q.includes('thống kê')) {
    const projectLines = context.projects.map((p) => {
      return `• **${p.name}**: Đạt **${p.progress}%** (${p.completedCount}/${p.taskCount} tasks hoàn thành - Trạng thái: *${p.status}*)`;
    });

    return `📊 **Báo cáo tiến độ tổng quan thời gian thực:**\n\n` +
      `- **Tổng số dự án:** ${context.stats.totalProjects} dự án\n` +
      `- **Tổng số công việc:** ${context.stats.totalTasks} tasks\n` +
      `- **Tỷ lệ hoàn thành toàn hệ thống:** **${context.stats.completionRate}%** (${context.stats.completedTasks}/${context.stats.totalTasks} tasks Done)\n` +
      `- **Đang thực hiện:** ${context.stats.inProgressTasks} | **Chờ kiểm thử:** ${context.stats.reviewTasks} | **Cần làm:** ${context.stats.todoTasks}\n` +
      `- **Công việc quá hạn:** **${context.stats.overdueTasks}** tasks\n\n` +
      `**Chi tiết tiến độ từng dự án:**\n${projectLines.join('\n')}\n\n` +
      `👉 *Bạn có thể truy cập phân hệ Bảng Kanban của từng dự án để xem luồng công việc trực quan.*`;
  }

  // 5. Ý định: Việc của tôi
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

  // 6. Tìm kiếm theo từ khóa tổng quát
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

  // Phản hồi mặc định khi không tìm thấy kết quả khớp
  return `Tôi đã đối chiếu dữ liệu live từ hệ thống gồm **${context.stats.totalTasks} công việc** thuộc **${context.stats.totalProjects} dự án**, nhưng chưa tìm thấy dữ liệu khớp chính xác với yêu cầu: *"${query}"*.\n\n` +
    `💡 **Gợi ý bạn có thể hỏi tôi:**\n` +
    `• *"Tìm các công việc đang quá hạn"* (hoặc click chip **⚠️ Việc quá hạn**)\n` +
    `• *"Danh sách việc cần làm"* (hoặc click chip **📋 Việc cần làm (TODO)**)\n` +
    `• *"Những việc khẩn cấp"* (hoặc click chip **🔥 Việc khẩn cấp (URGENT)**)\n` +
    `• *"Báo cáo tiến độ các dự án"* hoặc tìm theo tên người phụ trách!`;
}

/**
 * 6. Trò chuyện và phân tích dữ liệu dự án thời gian thực qua Gemini AI (Live Data-Aware Chat)
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

  try {
    const systemInstruction = `
Bạn là Trợ lý Dữ liệu Live nội bộ của TaskFlow AI trong hệ thống quản trị dự án & công việc doanh nghiệp.
Người dùng đang trò chuyện: ${context.user.name} (Email: ${context.user.email}, Quyền: ${context.user.role}).

DƯỚI ĐÂY LÀ BỘ DỮ LIỆU THỜI GIAN THỰC (LIVE DATA) ĐƯỢC TRÍCH XUẤT TRỰC TIẾP TỪ DATABASE PRISMA:
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

QUY TẮC PHẢN HỒI BẮT BUỘC:
1. Dựa vào bộ dữ liệu thời gian thực trên để trả lời câu hỏi của người dùng một cách chính xác, ngắn gọn, có cấu trúc bullet point rõ ràng. Tuyệt đối không tự suy đoán thông tin không có trong dữ liệu.
2. Nếu người dùng hỏi về task quá hạn, hãy liệt kê đúng tên task, deadline, tên người phụ trách và tên dự án.
3. Nếu người dùng hỏi về tiến độ, hãy trích dẫn đúng tỷ lệ % và số lượng task hoàn thành / tổng số.
4. ĐẶC BIỆT BẮT BUỘC: Bất cứ khi nào nhắc đến một công việc cụ thể, bạn PHẢI bọc trong cú pháp [TASK: <taskId> | <taskTitle>] (ví dụ: [TASK: 12345 | Thiết kế trang chủ]). Giao diện Frontend sẽ tự động chuyển cú pháp này thành một thẻ Badge tương tác để người dùng click mở modal chi tiết hoặc chuyển tới Kanban.
5. Sử dụng tiếng Việt thân thiện, chuyên nghiệp, rõ ràng.
`;

    const model = getModelForRequest('gemini-1.5-flash', {
      temperature: 0.2,
      maxOutputTokens: 1500,
    });

    const prompt = `${systemInstruction}\n\nCÂU HỎI CỦA NGƯỜI DÙNG: "${query}"\n\nHÃY TRẢ LỜI:`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
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
