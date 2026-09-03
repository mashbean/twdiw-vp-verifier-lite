export interface PrivacyCategory {
  code: string;
  label: string;
  examples: string;
}

export interface PrivacyNotice {
  version: string;
  effectiveDate: string;
  controller: string;
  contact: string;
  lawfulBasis: string;
  period: string;
  region: string;
  recipients: string;
  method: string;
  rights: string;
  refusalEffect: string;
  processorBoundary: string;
  legalReferences: Array<{ label: string; url: string }>;
}

/**
 * The public demo's Article 8 notice. Forks must replace controller/contact and
 * review every purpose before offering their own verification service.
 */
export const PRIVACY_NOTICE: PrivacyNotice = {
  version: "2026-09-03-v1",
  effectiveDate: "2026-09-03",
  controller: "mashbean（請出示皮夾示範站）",
  contact: "security@mashbean.net",
  lawfulBasis: "本示範限使用者主動參與的技術測試，持卡人仍須於皮夾內自行選擇是否出示。自行部署者不得把本頁勾選或皮夾同意畫面直接當成全部法律依據，仍須依實際業務確認個資法第 19 條的合法事由。",
  period: "揭露資料只在單次查驗的執行記憶體與結果頁存在。伺服器送出結果後立即丟棄；未完成 session 的非揭露 metadata 最長保留 10 分鐘。結果頁資料於重新整理、離開或關閉頁面後消失。",
  region: "由 Cloudflare 全球網路依連線路由處理，節點可能位於臺灣境外。",
  recipients: "本示範站營運者，以及受託處理 HTTPS 與 Worker 執行的 Cloudflare。資料不提供行銷、廣告、側寫或其他第三人使用。",
  method: "透過 OIDC4VP 接收持卡人同意揭露的最少欄位，完成簽章、holder binding、issuer 信任、狀態與所選目的的判斷；不建立個人資料檔案。",
  rights: "可聯絡營運者行使查詢、閱覽、製給複製本、補充、更正、停止蒐集／處理／利用及刪除等權利。由於本服務不保存查驗資料，查驗完成後通常已無可供查詢、更正或刪除的伺服器紀錄。",
  refusalEffect: "可以不勾選、取消 QR 或在皮夾內拒絕出示；本次查驗將無法完成，示範站不會因此產生其他不利益。",
  processorBoundary: "這套模組協助呈現告知事項與落實零持久化，並不自動保證部署者的全部業務合規。自行部署者須換成自己的名稱、聯絡方式、目的、合法事由、利用範圍及事故應變流程。",
  legalReferences: [
    { label: "個人資料保護法", url: "https://law.pdpc.gov.tw/LawContent.aspx?id=FL010627" },
    { label: "特定目的及個人資料類別", url: "https://law.pdpc.gov.tw/LawContent.aspx?id=FL010631" },
  ],
};

const CATEGORY_BY_CLAIM: Record<string, PrivacyCategory> = {
  name: { code: "C001", label: "辨識個人者", examples: "姓名" },
  phonel5: { code: "C001", label: "辨識個人者", examples: "手機末五碼" },
  id_number: { code: "C003", label: "政府資料中之辨識者", examples: "國民身分證統一編號" },
  unifiedNo: { code: "C003", label: "政府資料中之辨識者", examples: "國民身分證統一編號" },
  over18AtIssuance: { code: "C011", label: "個人描述", examples: "發證時已滿 18 歲述詞" },
  nationality: { code: "C011", label: "個人描述", examples: "國籍" },
  license_type: { code: "C039", label: "執照或其他許可", examples: "駕照種類" },
};

const TECHNICAL_CATEGORY: PrivacyCategory = {
  code: "C001",
  label: "辨識個人者",
  examples: "電子簽章、憑證識別與本次身分驗證紀錄",
};

export function privacyCategoriesForClaims(claims: string[]): PrivacyCategory[] {
  const grouped = new Map<string, PrivacyCategory>();
  for (const category of [TECHNICAL_CATEGORY, ...claims.map((claim) => CATEGORY_BY_CLAIM[claim]).filter(Boolean)]) {
    const current = grouped.get(category.code);
    if (!current) grouped.set(category.code, { ...category });
    else if (!current.examples.includes(category.examples)) current.examples += `、${category.examples}`;
  }
  return [...grouped.values()];
}
