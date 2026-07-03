import { readFileSync, writeFileSync } from "fs"

const path = "messages/ar.json"
const ar = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""))

function ensure(obj, keyPath, value) {
  const parts = keyPath.split(".")
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  const last = parts[parts.length - 1]
  if (cur[last] === undefined) cur[last] = value
}

// costumes.clients — the one that keeps not landing
ensure(ar, "costumes.clients.title", "العملاء")
ensure(ar, "costumes.clients.addClient", "إضافة زبون")
ensure(ar, "costumes.clients.addFirst", "إضافة أول زبون")
ensure(ar, "costumes.clients.address", "العنوان")
ensure(ar, "costumes.clients.addressOptional", "العنوان (اختياري)")
ensure(ar, "costumes.clients.createSuccess", "تم إضافة الزبون بنجاح")
ensure(ar, "costumes.clients.createdAtLabel", "تاريخ الإضافة")
ensure(ar, "costumes.clients.editClient", "تعديل الزبون")
ensure(ar, "costumes.clients.name", "الاسم")
ensure(ar, "costumes.clients.nameColumn", "الاسم")
ensure(ar, "costumes.clients.noClients", "لا يوجد عملاء بعد")
ensure(ar, "costumes.clients.notesOptional", "ملاحظات (اختياري)")
ensure(ar, "costumes.clients.phone", "رقم الهاتف")
ensure(ar, "costumes.clients.phoneTaken", "رقم الهاتف مستخدم بالفعل")
ensure(ar, "costumes.clients.rentalCount", "عدد الإيجارات")

// magazin.inventory — missing keys found in your terminal paste, plus a few more the same screen needs
ensure(ar, "magazin.inventory.category", "الفئة")
ensure(ar, "magazin.inventory.stock", "المخزون")
ensure(ar, "magazin.inventory.sellingPrice", "سعر البيع")
ensure(ar, "magazin.inventory.buyingPrice", "سعر الشراء")
ensure(ar, "magazin.inventory.minSellingPrice", "الحد الأدنى للبيع")
ensure(ar, "magazin.inventory.addVariantRow", "إضافة نوع")
ensure(ar, "magazin.inventory.size", "المقاس")
ensure(ar, "magazin.inventory.color", "اللون")
ensure(ar, "magazin.inventory.zeroStock", "تصفير المخزون")
ensure(ar, "magazin.inventory.deactivate", "تعطيل")
ensure(ar, "magazin.inventory.activate", "تفعيل")
ensure(ar, "magazin.inventory.deactivateConfirm", "هل تريد تعطيل هذا المنتج؟")
ensure(ar, "magazin.inventory.activateConfirm", "هل تريد تفعيل هذا المنتج؟")
ensure(ar, "magazin.inventory.toggleSuccess", "تم التحديث")
ensure(ar, "magazin.inventory.stockBas", "مخزون منخفض")

// magazin.catalogue — missing keys found in your terminal paste, plus a few more the same screen needs
ensure(ar, "magazin.catalogue.title", "الكتالوج")
ensure(ar, "magazin.catalogue.allCategories", "كل الفئات")
ensure(ar, "magazin.catalogue.allSizes", "كل المقاسات")
ensure(ar, "magazin.catalogue.allColors", "كل الألوان")
ensure(ar, "magazin.catalogue.noProducts", "لا توجد منتجات")
ensure(ar, "magazin.catalogue.inStock", "متوفر")
ensure(ar, "magazin.catalogue.clearFilters", "مسح الفلاتر")

// magazin.credits — missing key found in your terminal paste
ensure(ar, "magazin.credits.filterAll", "الكل")

writeFileSync(path, JSON.stringify(ar, null, 2), "utf8")
console.log("ar.json patched successfully.")