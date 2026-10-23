/** Arabic labels for activity-log action codes (unknown codes fall back to the raw code). */
const LABELS: Record<string, string> = {
  "sale.created":              "عملية بيع",
  "sale.returned":             "إرجاع سلع من عميل",
  "sale.corrected":            "تصحيح خطأ في بيع",
  "costume_sale.created":      "بيع بدلة",
  "credit.payment_added":      "أداء دين",
  "caisse.opened":             "فتح الصندوق",
  "caisse.closed":             "إغلاق الصندوق",
  "caisse.manual_entry":       "إدخال يدوي في الصندوق",
  "rental.created":            "إيجار جديد",
  "rental.updated":            "تعديل إيجار",
  "rental.cancelled":          "إلغاء إيجار",
  "rental.status_changed":     "تغيير حالة إيجار",
  "rental.payment_added":      "دفعة إيجار",
  "rental.item_returned":      "إرجاع قطعة",
  "rental.item_unreturned":    "التراجع عن إرجاع قطعة",
  "client.created":            "عميل جديد",
  "client.updated":            "تعديل عميل",
  "product.created":           "منتج جديد",
  "product.updated":           "تعديل منتج",
  "product.activated":         "تفعيل منتج",
  "product.deactivated":       "تعطيل منتج",
  "costume_item.created":      "قطعة بدلة جديدة",
  "costume_item.updated":      "تعديل قطعة بدلة",
  "costume_item.activated":    "تفعيل قطعة بدلة",
  "costume_item.deactivated":  "تعطيل قطعة بدلة",
  "expense.created":           "مصروف جديد",
  "expense.updated":           "تعديل مصروف",
  "expense.deleted":           "حذف مصروف",
  "user.created":              "مستخدم جديد",
  "user.updated":              "تعديل مستخدم",
  "user.activated":            "تفعيل مستخدم",
  "user.deactivated":          "تعطيل مستخدم",
  "user.password_reset":       "إعادة تعيين كلمة المرور",
  "user.password_changed":     "تغيير كلمة المرور",
  "settings.updated":          "تحديث الإعدادات",
  "lookup_value.created":      "إضافة خيار",
  "lookup_value.updated":      "تعديل خيار",
  "lookup_value.activated":    "تفعيل خيار",
  "lookup_value.deactivated":  "إزالة خيار",
  "lookup_values.reordered":   "إعادة ترتيب الخيارات",
  "request.pending":           "طلب منتج: قيد الانتظار",
  "request.reviewed":          "طلب منتج: تمت المراجعة",
  "request.ordered":           "طلب منتج: تم الطلب",
}

export function actionLabel(action: string): string {
  return LABELS[action] ?? action
}

/** Arabic names for the kinds of records in the activity log (unknown kinds fall back to the raw code). */
const ENTITIES: Record<string, string> = {
  sale:           "بيع",
  sale_return:    "إرجاع",
  costume_sale:   "بيع بدلة",
  credit:         "دين",
  caisse:         "صندوق",
  rental:         "إيجار",
  rental_payment: "دفعة إيجار",
  client:         "عميل",
  product:        "منتج",
  productRequest: "طلب منتج",
  costume_item:   "قطعة بدلة",
  expense:        "مصروف",
  user:           "مستخدم",
  settings:       "إعدادات",
  lookup_value:   "خيار",
}

export function entityLabel(entityType: string): string {
  return ENTITIES[entityType] ?? entityType
}
