import { FIELD_NAMES, VALUE_MAPPINGS } from '@/utils/evidenceDictionary';

const TEXT_REPLACEMENTS: Record<string, string> = {
  "minutes": "phút",
  "minute": "phút",
  "hours": "giờ",
  "hour": "giờ",
  "days": "ngày",
  "day": "ngày",
  "seconds": "giây",
  "h": "giờ",
};

export default function formatEvidenceItem(key: string, value: any) {
  const label = FIELD_NAMES[key] || key;
  let formattedValue = value;

  if (value === null || value === undefined) {
    return { label, value: "N/A" };
  }

  // Xử lý Mảng
  if (Array.isArray(value)) {
    const mapping = VALUE_MAPPINGS[key];
    formattedValue = value.map(item => mapping?.[item] || translateText(item)).join(", ");
  } 
  // Xử lý Mapping cứng (Enum)
  else if (VALUE_MAPPINGS[key] && VALUE_MAPPINGS[key][value]) {
    formattedValue = VALUE_MAPPINGS[key][value];
  }
  // Xử lý CHUỖI VĂN BẢN
  else if (typeof value === 'string') {
    formattedValue = translateText(value);
  }
  // Xử lý Số %
  else if ((key.includes('probability') || key.includes('percent')) && typeof value === 'number') {
     const percent = value <= 1 ? value * 100 : value;
     formattedValue = `${percent.toFixed(1)}%`;
  }
  else if (typeof value === 'boolean') {
    formattedValue = value ? "Có" : "Không";
  }
  
  return { label, value: formattedValue };
}

// Tìm và thay thế các từ tiếng Anh trong chuỗi
function translateText(text: string): string {
  if (!text) return "";
  
  let result = text;
  Object.entries(TEXT_REPLACEMENTS).forEach(([eng, vie]) => {

    const regex = new RegExp(`\\b${eng}\\b|${eng}(?=\\d|$)`, 'gi');
    result = result.replace(regex, vie);
  });
  
  return result;
}