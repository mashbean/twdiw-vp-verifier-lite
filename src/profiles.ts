import { findClaim } from "./age";

export type CredentialSource = "government" | "selfIssued";
export type DecisionStatus = "pass" | "not-established";

export interface VerificationVariant {
  source: CredentialSource;
  sourceLabel: string;
  claims: string[];
  credentialType?: string;
  claimLabels?: Record<string, string>;
}

export interface VerificationProfile {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  resultQuestion: string;
  variants: VerificationVariant[];
  privacyNote: string;
  policyNote: string;
}

export interface VerificationDecision {
  status: DecisionStatus;
  title: string;
  detail: string;
}

const GOVERNMENT = "數位憑證皮夾／有備而來收到的政府卡片";
const SELF_ISSUED = "有備而來自發證件";

export const VERIFICATION_PROFILES: VerificationProfile[] = [
  {
    id: "adult-18",
    label: "確認已滿 18 歲",
    shortLabel: "成年",
    description: "適合酒類、活動入場或分級服務。目前使用有備而來自發身分證上的發證時已成年述詞。",
    resultQuestion: "這張卡能否證明持有人已滿 18 歲？",
    variants: [
      { source: "selfIssued", sourceLabel: SELF_ISSUED, claims: ["over18AtIssuance"], credentialType: "NationalIDCredential" },
    ],
    privacyNote: "只揭露發證時已滿 18 歲的布林述詞，不揭露出生日期。",
    policyNote: "這是自發證件內的簽署述詞，不是零知識證明。持有人一旦成年，這個 true 述詞不會隨時間失效。",
  },
  {
    id: "identity-name",
    label: "核對姓名",
    shortLabel: "姓名",
    description: "只要求姓名，適合預約、報到或名單核對。",
    resultQuestion: "卡片簽章是否涵蓋持有人揭露的姓名？",
    variants: [
      { source: "government", sourceLabel: GOVERNMENT, claims: ["name"] },
      { source: "selfIssued", sourceLabel: SELF_ISSUED, claims: ["name"], credentialType: "NationalIDCredential" },
    ],
    privacyNote: "查驗端會看到完整姓名，不要求統一編號、生日或地址。",
    policyNote: "姓名相同不代表同一人；高風險流程仍需要另一個可核對的因素。",
  },
  {
    id: "telecom-pickup",
    label: "超商取貨姓名與門號末五碼",
    shortLabel: "門號卡",
    description: "重現統一超商取貨情境，只要求電信卡上的姓名與手機末五碼。",
    resultQuestion: "受信任電信卡是否簽署了姓名與手機末五碼？",
    variants: [
      { source: "government", sourceLabel: GOVERNMENT, claims: ["name", "phonel5"] },
    ],
    privacyNote: "查驗端會看到姓名與手機末五碼，不取得完整門號。",
    policyNote: "這能確認發卡內容與持有人金鑰綁定，不單獨證明 SIM 卡此刻仍由本人控制。",
  },
  {
    id: "driving-entitlement",
    label: "確認駕照種類與有效性",
    shortLabel: "駕照",
    description: "要求駕照種類；簽章、持有人綁定、憑證效期與撤銷狀態由查驗器另外檢查。",
    resultQuestion: "這是否為可驗證且仍有效的駕照電子卡？",
    variants: [
      { source: "government", sourceLabel: GOVERNMENT, claims: ["license_type"] },
    ],
    privacyNote: "不要求姓名、統一編號、生日、管轄編號或發證日期。",
    policyNote: "卡片種類須含 driverlicense 或 drivinglicense，並通過政府 issuer 信任檢查。",
  },
  {
    id: "national-id-number",
    label: "確認持有國民身分證統一編號",
    shortLabel: "統一編號",
    description: "確認卡片簽署了一個格式與檢查碼有效的國民身分證統一編號。",
    resultQuestion: "卡片能否證明持有人有有效格式的國民身分證統一編號？",
    variants: [
      { source: "government", sourceLabel: GOVERNMENT, claims: ["id_number"] },
      { source: "selfIssued", sourceLabel: SELF_ISSUED, claims: ["unifiedNo"], credentialType: "NationalIDCredential" },
    ],
    privacyNote: "查驗端會收到完整統一編號。若只需要成年或姓名，不應使用此情境。",
    policyNote: "有統一編號不應直接改寫成國籍、戶籍狀態或本人當下意願。",
  },
  {
    id: "roc-nationality-declaration",
    label: "檢查自發證件的國籍欄位",
    shortLabel: "國籍欄位",
    description: "讀取有備而來自發證件中的 nationality，確認卡片聲明為中華民國（臺灣）。",
    resultQuestion: "這張自發證件是否聲明中華民國國籍？",
    variants: [
      { source: "selfIssued", sourceLabel: SELF_ISSUED, claims: ["nationality"], credentialType: "NationalIDCredential" },
    ],
    privacyNote: "只揭露國籍欄位，不揭露姓名、統一編號、生日或地址。",
    policyNote: "這個欄位由持卡人從 MyData 資料建立並以自然人憑證簽署，不能冒充政府發卡機關直接出具的國籍證明。",
  },
];

export function getProfile(profileId: string): VerificationProfile | undefined {
  return VERIFICATION_PROFILES.find((profile) => profile.id === profileId);
}

export function getVariant(profile: VerificationProfile, source: CredentialSource): VerificationVariant | undefined {
  return profile.variants.find((variant) => variant.source === source);
}

export function publicProfiles(): VerificationProfile[] {
  return VERIFICATION_PROFILES.map((profile) => ({
    ...profile,
    variants: profile.variants.map((variant) => ({
      ...variant,
      claims: [...variant.claims],
      claimLabels: Object.fromEntries(variant.claims.map((name) => [name, claimLabel(name)])),
    })),
  }));
}

export function claimLabel(name: string): string {
  const labels: Record<string, string> = {
    name: "姓名",
    phonel5: "手機末五碼",
    roc_birthday: "出生日期（民國）",
    birthdate: "出生日期",
    over18AtIssuance: "發證時已滿 18 歲",
    license_type: "駕照種類",
    id_number: "國民身分證統一編號",
    unifiedNo: "國民身分證統一編號",
    nationality: "國籍",
  };
  return labels[name] ?? name;
}

function credentialTypeFromClaims(claims: unknown): string | undefined {
  if (!claims || typeof claims !== "object") return undefined;
  const object = claims as Record<string, unknown>;
  if (typeof object.vct === "string") return object.vct;
  const vc = object.vc;
  if (vc && typeof vc === "object" && !Array.isArray(vc)) {
    const type = (vc as Record<string, unknown>).type;
    if (Array.isArray(type)) return type.map(String).find((value) => value !== "VerifiableCredential") ?? type.map(String)[0];
    if (typeof type === "string") return type;
  }
  const type = object.type;
  if (Array.isArray(type)) return type.map(String).find((value) => value !== "VerifiableCredential") ?? type.map(String)[0];
  return typeof type === "string" ? type : undefined;
}

export function resolvedCredentialType(claims: unknown, verifiedType?: string): string | undefined {
  return verifiedType ?? credentialTypeFromClaims(claims);
}

export function selectedClaims(claims: unknown, names: string[]): Record<string, unknown> {
  const selected: Record<string, unknown> = {};
  for (const name of names) {
    const value = findClaim(claims, name);
    if (value !== undefined) selected[name] = value;
  }
  return selected;
}

function missingClaims(claims: Record<string, unknown>, names: string[]): string[] {
  return names.filter((name) => claims[name] === undefined || claims[name] === null || String(claims[name]).trim() === "");
}

function isTaiwanNationalId(value: unknown): boolean {
  const id = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z][12]\d{8}$/.test(id)) return false;
  const letters = "ABCDEFGHJKLMNPQRSTUVXYWZIO";
  const code = letters.indexOf(id[0]) + 10;
  if (code < 10) return false;
  let sum = Math.floor(code / 10) + (code % 10) * 9;
  for (let index = 1; index <= 8; index += 1) sum += Number(id[index]) * (9 - index);
  sum += Number(id[9]);
  return sum % 10 === 0;
}

function isRocNationality(value: unknown): boolean {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s（）()]/g, "")
    .toLowerCase();
  return ["中華民國臺灣", "中華民國台灣", "中華民國", "roc", "taiwan", "tw"].includes(normalized);
}

export function evaluateProfile(
  profileId: string,
  source: CredentialSource,
  claims: Record<string, unknown>,
  verifiedType: string | undefined,
  credentialStatus?: string,
  nowMs = Date.now(),
): VerificationDecision {
  const profile = getProfile(profileId);
  const variant = profile && getVariant(profile, source);
  if (!profile || !variant) {
    return { status: "not-established", title: "無法套用驗證規則", detail: "查驗情境或卡片來源不受支援。" };
  }
  const missing = missingClaims(claims, variant.claims);
  if (missing.length) {
    return {
      status: "not-established",
      title: "資料不足",
      detail: `卡片沒有揭露 ${missing.map(claimLabel).join("、")}。`,
    };
  }

  switch (profileId) {
    case "adult-18": {
      const adult = String(claims.over18AtIssuance).toLowerCase() === "true";
      return adult
        ? { status: "pass", title: "已證明發證時滿 18 歲", detail: "此述詞已包含在自然人憑證簽署的自發證件中。" }
        : { status: "not-established", title: "未能證明已滿 18 歲", detail: "述詞不是 true；這個結果不應解讀為目前仍未成年。" };
    }
    case "identity-name":
      return { status: "pass", title: "姓名欄位簽章有效", detail: "卡片簽章、持有人綁定與揭露承諾均已通過。" };
    case "telecom-pickup": {
      const type = resolvedCredentialType(claims, verifiedType)?.toLowerCase() ?? "";
      const known = ["twmdiwvc_postpaid", "name_phonel5_phonel3", "fet_vc_prod"].some((part) => type.includes(part));
      return known
        ? { status: "pass", title: "門號卡資料驗證通過", detail: "姓名與手機末五碼均由相符的電信卡揭露。" }
        : { status: "not-established", title: "卡片種類不符", detail: "欄位存在，但卡片種類不在已實測的電信卡範圍。" };
    }
    case "driving-entitlement": {
      if (credentialStatus !== "valid") {
        return {
          status: "not-established",
          title: "無法確認駕照仍有效",
          detail: "憑證簽章有效，但撤銷狀態不是可確認的 valid。",
        };
      }
      const type = resolvedCredentialType(claims, verifiedType)?.toLowerCase() ?? "";
      const known = ["driverlicense", "drivinglicense"].some((part) => type.includes(part));
      return known
        ? { status: "pass", title: "駕照電子卡驗證通過", detail: `卡片揭露的駕照種類為「${String(claims.license_type)}」。` }
        : { status: "not-established", title: "卡片種類不符", detail: "欄位存在，但憑證類型不是已辨識的駕照電子卡。" };
    }
    case "national-id-number": {
      const value = source === "government" ? claims.id_number : claims.unifiedNo;
      return isTaiwanNationalId(value)
        ? { status: "pass", title: "統一編號欄位驗證通過", detail: "格式與檢查碼有效，且位於已通過簽章驗證的卡片中。" }
        : { status: "not-established", title: "統一編號格式無效", detail: "卡片有揭露欄位，但格式或檢查碼不符合國民身分證統一編號規則。" };
    }
    case "roc-nationality-declaration":
      return isRocNationality(claims.nationality)
        ? { status: "pass", title: "卡片聲明中華民國國籍", detail: "這是持卡人以自然人憑證簽署的自發證件欄位。" }
        : { status: "not-established", title: "國籍條件未成立", detail: "揭露值不在本情境接受的中華民國（臺灣）表示法中。" };
    default:
      return { status: "not-established", title: "沒有判斷規則", detail: "卡片通過密碼學驗證，但此情境尚未定義業務判斷。" };
  }
}
