import { unstable_rethrow } from "next/navigation"

/**
 * Server actions must NOT throw for expected business errors: in production Next.js strips the
 * message of any error thrown by a server action, so the UI could only show a generic failure.
 * Mutating actions therefore return an ActionResult, and the UI shows `result.message`.
 */

export const ERROR_MESSAGES = {
  unauthorized:            "انتهت الجلسة، يرجى تسجيل الدخول من جديد",
  forbidden:               "ليست لديك صلاحية لتنفيذ هذا الإجراء",
  maintenance:             "النظام في وضع الصيانة حاليا",
  password_change_required:"يجب تغيير كلمة المرور قبل المتابعة",
  validation:              "بيانات غير صالحة، يرجى التحقق من الحقول",
  not_found:               "العنصر غير موجود",
  server_error:            "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى",

  invalid_credentials:     "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  account_locked:          "تم قفل الحساب مؤقتا بسبب محاولات خاطئة كثيرة",
  weak_password:           "كلمة المرور ضعيفة: 8 أحرف على الأقل",
  email_taken:             "هذا البريد الإلكتروني مستخدم بالفعل",
  phone_taken:             "رقم الهاتف مستخدم بالفعل",
  cannot_modify_user:      "لا يمكن تعديل هذا المستخدم",
  cannot_deactivate_self:  "لا يمكنك تعطيل حسابك الخاص",

  caisse_closed:           "الصندوق مغلق، يجب فتح الصندوق أولا",
  caisse_already_open:     "يوجد صندوق مفتوح بالفعل لهذا الباب",
  insufficient_stock:      "المخزون غير كافٍ لواحد أو أكثر من المنتجات",
  below_min_not_authorized:"البيع بسعر أقل من الحد الأدنى يتطلب تفويض مدير",
  invalid_amount:          "مبلغ غير صالح",
  total_mismatch:          "مجموع الفاتورة غير متطابق",
  amount_exceeds_balance:  "المبلغ أكبر من الرصيد المتبقي",
  nothing_to_pay:          "لا يوجد مبلغ متبقي",

  rental_closed:           "هذا الإيجار مغلق أو ملغى",
  invalid_status:          "لا يمكن تنفيذ هذا الإجراء في حالة الإيجار الحالية",
  balance_unpaid:          "يجب أداء الرصيد المتبقي قبل تسليم الإيجار",
  deposit_not_returned:    "يجب إرجاع الضمان قبل إغلاق الإيجار",
  deposit_state:           "حالة الضمان لا تسمح بهذه العملية",
  invalid_dates:           "تاريخ الإرجاع يجب أن يكون بعد أو يساوي تاريخ الاستلام",
  item_unavailable:        "قطعة غير متوفرة",

  option_exists:           "هذا الخيار موجود بالفعل",
} as const

export type ErrorCode = keyof typeof ERROR_MESSAGES

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string }

export class ActionError extends Error {
  constructor(public code: ErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code])
    this.name = "ActionError"
  }
}

export function fail(code: ErrorCode, message?: string): { ok: false; code: ErrorCode; message: string } {
  return { ok: false, code, message: message ?? ERROR_MESSAGES[code] }
}

export function ok(): ActionResult<void>
export function ok<T>(data: T): ActionResult<T>
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data }
}

/**
 * Runs an action body and converts ActionError (and unexpected errors) to a failed result.
 * Framework control-flow errors (redirect/notFound) are re-thrown untouched.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    if (err instanceof ActionError) return fail(err.code, err.message)
    unstable_rethrow(err)
    console.error("[action] unexpected error:", err)
    return fail("server_error")
  }
}
