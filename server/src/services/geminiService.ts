import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

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
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  const prompt = `
Bạn là một chuyên gia quản lý dự án công nghệ thông tin xuất sắc. 
Hãy phân tích công việc sau và phân tách thành từ 3 đến tối đa 8 công việc con (sub-tasks) cụ thể, thực tế và khả thi.

Tên công việc chính: "${taskTitle}"
Mô tả chi tiết: "${taskDescription || 'Không có mô tả chi tiết'}"

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

  try {
    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      responseMimeType: 'application/json',
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig,
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const subTasks = cleanAndParseJSON<SubTaskSuggestion[]>(responseText);

    if (!Array.isArray(subTasks)) {
      throw new Error('Định dạng phản hồi từ Gemini không phải là danh sách mảng.');
    }

    return subTasks.slice(0, 8);
  } catch (error: any) {
    console.error('Lỗi khi phân tách task với Gemini AI:', error?.message || error);
    throw new Error(`Không thể tự động phân tách công việc bằng AI: ${error?.message || 'Lỗi không xác định'}`);
  }
}

/**
 * 2. Phân tích danh sách tasks và sinh bản nhận xét tiến độ bằng tiếng Việt dạng Markdown
 */
export async function generateProgressSummary(
  projectName: string,
  tasks: TaskSummaryInput[]
): Promise<string> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'DONE').length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const review = tasks.filter((t) => t.status === 'REVIEW').length;
  const todo = tasks.filter((t) => t.status === 'TODO').length;
  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

  const prompt = `
Bạn là Giám đốc Dự án kiêm Chuyên gia Đánh giá Hiệu suất (KPI & Performance Lead).
Hãy phân tích dữ liệu công việc của dự án "${projectName}" và lập Báo Cáo Nhận Xét Tiến Độ toàn diện bằng tiếng Việt.

Thông số dự án:
- Tổng số công việc: ${total}
- Đã hoàn thành (DONE): ${completed} (${completionRate}%)
- Đang thực hiện (IN_PROGRESS): ${inProgress}
- Đang kiểm tra/duyệt (REVIEW): ${review}
- Chưa bắt đầu (TODO): ${todo}

Chi tiết danh sách các tasks:
${JSON.stringify(tasks, null, 2)}

Hãy trình bày báo cáo bằng định dạng Markdown hoàn chỉnh với cấu trúc chính xác các mục sau:
# BÁO CÁO TIẾN ĐỘ DỰ ÁN: ${projectName.toUpperCase()}

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

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.4,
      },
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    console.error('Lỗi khi sinh báo cáo tiến độ bằng Gemini AI:', error?.message || error);
    throw new Error(`Không thể sinh báo cáo tiến độ: ${error?.message || 'Lỗi kết nối Gemini'}`);
  }
}

/**
 * 3. Phân tích danh sách dự án và xác định rủi ro
 */
export async function detectProjectRisks(
  projects: ProjectRiskInput[]
): Promise<RiskWarning[]> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  const prompt = `
Bạn là Chuyên gia Quản trị Rủi ro Dự án (Project Risk Auditor).
Hãy phân tích danh sách dữ liệu các dự án sau và xác định mức độ rủi ro, nguyên nhân và biện pháp khắc phục.

Danh sách dự án:
${JSON.stringify(projects, null, 2)}

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

  try {
    const generationConfig: GenerationConfig = {
      temperature: 0.2,
      responseMimeType: 'application/json',
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig,
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const risks = cleanAndParseJSON<RiskWarning[]>(responseText);

    if (!Array.isArray(risks)) {
      throw new Error('Dữ liệu rủi ro trả về không đúng định dạng danh sách mảng.');
    }

    return risks;
  } catch (error: any) {
    console.error('Lỗi khi phân tích rủi ro dự án bằng Gemini AI:', error?.message || error);
    throw new Error(`Không thể phân tích rủi ro dự án: ${error?.message || 'Lỗi không xác định'}`);
  }
}

/**
 * 4. Parse câu truy vấn ngôn ngữ tự nhiên thành bộ lọc tìm kiếm công việc có cấu trúc
 */
export async function parseNaturalLanguageSearch(
  query: string
): Promise<ParsedNLQuery> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường hệ thống.');
  }

  const prompt = `
Bạn là trợ lý AI thông minh phân tích câu truy vấn tìm kiếm công việc của người dùng bằng tiếng Việt.
Hãy phân tích câu sau: "${query}"

Trích xuất thành đối tượng JSON có các trường sau (nếu câu nói không đề cập trường nào thì để null):
{
  "assigneeName": string hoặc null (ví dụ: "Nguyễn Văn A", "Du", "tôi", "Dương Chí Dự"),
  "status": "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" hoặc null,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" hoặc null,
  "isPastDue": boolean hoặc null (true nếu người dùng tìm việc trễ hạn, quá hạn, trễ deadline),
  "keyword": string hoặc null (từ khóa chính cần tìm trong tiêu đề hoặc mô tả task)
}
`;

  try {
    const generationConfig: GenerationConfig = {
      temperature: 0.1,
      responseMimeType: 'application/json',
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig,
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return cleanAndParseJSON<ParsedNLQuery>(responseText);
  } catch (error: any) {
    console.error('Lỗi khi parse câu tìm kiếm tự nhiên:', error?.message || error);
    return {
      keyword: query,
    };
  }
}
