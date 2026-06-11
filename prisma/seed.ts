import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const PEPPER    = process.env.PIN_HASH_PEPPER ?? ""
const SALT_ROUNDS = 12

async function hashPin(pin: string) {
  return bcrypt.hash(pin + PEPPER, SALT_ROUNDS)
}

// ── Lookup data ──────────────────────────────────────────

const LOOKUP_DATA = [
  {
    slug: "suit_sizes", name_fr: "Tailles de costume", name_ar: "مقاسات البدلة",
    values: [
      { fr: "38", ar: "38" }, { fr: "40", ar: "40" }, { fr: "42", ar: "42" },
      { fr: "44", ar: "44" }, { fr: "46", ar: "46" }, { fr: "48", ar: "48" },
      { fr: "50", ar: "50" }, { fr: "52", ar: "52" },
    ],
  },
  {
    slug: "vest_sizes", name_fr: "Tailles de gilet", name_ar: "مقاسات الصديري",
    values: [
      { fr: "XS", ar: "XS" }, { fr: "S", ar: "S" }, { fr: "M", ar: "M" },
      { fr: "L", ar: "L" },   { fr: "XL", ar: "XL" }, { fr: "XXL", ar: "XXL" },
    ],
  },
  {
    slug: "shoe_sizes", name_fr: "Pointures", name_ar: "مقاسات الأحذية",
    values: [
      { fr: "38", ar: "38" }, { fr: "39", ar: "39" }, { fr: "40", ar: "40" },
      { fr: "41", ar: "41" }, { fr: "42", ar: "42" }, { fr: "43", ar: "43" },
      { fr: "44", ar: "44" }, { fr: "45", ar: "45" },
    ],
  },
  {
    slug: "suit_colors", name_fr: "Couleurs de costume", name_ar: "ألوان البدلة",
    values: [
      { fr: "Noir",     ar: "أسود"  }, { fr: "Marine",   ar: "كحلي"  },
      { fr: "Gris",     ar: "رمادي" }, { fr: "Bordeaux", ar: "بوردو" },
      { fr: "Beige",    ar: "بيج"   }, { fr: "Blanc",    ar: "أبيض"  },
    ],
  },
  {
    slug: "product_categories", name_fr: "Catégories produits", name_ar: "فئات المنتجات",
    values: [
      { fr: "Vêtements",   ar: "ملابس"       }, { fr: "Chaussures", ar: "أحذية"     },
      { fr: "Accessoires", ar: "إكسسوارات"   }, { fr: "Hoodies",   ar: "هودي"      },
      { fr: "Vestes",      ar: "جاكيطات"     },
    ],
  },
  {
    slug: "accessory_types", name_fr: "Types d'accessoires", name_ar: "أنواع الإكسسوارات",
    values: [
      { fr: "Cravate",      ar: "ربطة عنق"    }, { fr: "Nœud papillon", ar: "فراشة"      },
      { fr: "Ceinture",     ar: "حزام"         }, { fr: "Pochette",      ar: "منديل جيب"  },
      { fr: "Boutonnière",  ar: "زهرة العروة"  },
    ],
  },
  {
    slug: "measurement_categories", name_fr: "Catégories de mesures", name_ar: "فئات القياسات",
    values: [
      { fr: "Poitrine",       ar: "الصدر"        }, { fr: "Taille",         ar: "الخصر"   },
      { fr: "Épaules",        ar: "الأكتاف"       }, { fr: "Longueur veste", ar: "طول الجاكيت" },
      { fr: "Entrejambe",     ar: "طول الفخذ"     }, { fr: "Pointure",       ar: "مقاس الحذاء" },
    ],
  },
  {
    slug: "expense_categories", name_fr: "Catégories de dépenses", name_ar: "فئات المصاريف",
    values: [
      { fr: "Loyer",        ar: "إيجار"  }, { fr: "Électricité", ar: "كهرباء" },
      { fr: "Fournitures",  ar: "لوازم"  }, { fr: "Entretien",   ar: "صيانة"  },
      { fr: "Autre",        ar: "أخرى"   },
    ],
  },
  {
    slug: "costume_item_types", name_fr: "Types d'articles costumes", name_ar: "أنواع عناصر البدلات",
    values: [
      { fr: "Costume",    ar: "بدلة"    },
      { fr: "Gilet",      ar: "صديري"   },
      { fr: "Chaussures", ar: "أحذية"   },
      { fr: "Accessoire", ar: "إكسسوار" },
    ],
  },
  {
    slug: "guarantee_types", name_fr: "Types de garantie", name_ar: "أنواع الضمان",
    values: [
      { fr: "Dépôt en espèces",   ar: "وديعة نقدية"              },
      { fr: "CIN",                ar: "بطاقة التعريف الوطنية"     },
      { fr: "Passeport",          ar: "جواز السفر"                },
      { fr: "Permis de conduire", ar: "رخصة السياقة"              },
    ],
  },
] as const

// ── Main ─────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting seed…")

  // System settings (idempotent)
  await prisma.systemSettings.upsert({
    where:  { id: "system" },
    update: {},
    create: {
      id: "system",
      maintenanceMode: false,
      defaultStaffPermissions: {
        magazin:  { pos: true, inventory: false, caisse: false, credits: true, produits_demandes: true },
        costumes: { pos: true, inventory: false, caisse: false, clients: true, rentals: true, rental_inventory: false },
      },
    },
  })

  // Lookup categories + values
  for (const cat of LOOKUP_DATA) {
    const category = await prisma.lookupCategory.upsert({
      where:  { slug: cat.slug },
      update: {},
      create: { slug: cat.slug, name_fr: cat.name_fr, name_ar: cat.name_ar },
    })

    // Only seed values if this category has none yet
    const existing = await prisma.lookupValue.count({ where: { categoryId: category.id } })
    if (existing === 0) {
      await prisma.lookupValue.createMany({
        data: cat.values.map((v, i) => ({
          categoryId: category.id,
          label_fr:   v.fr,
          label_ar:   v.ar,
          order:      i,
        })),
      })
      console.log(`  ✓  ${cat.slug} (${cat.values.length} values)`)
    } else {
      console.log(`  –  ${cat.slug} already seeded, skipped`)
    }
  }

  // Superadmin user
  const pinHash = await hashPin("880826")
  await prisma.user.upsert({
    where:  { id: "seed_superadmin" },
    update: {},
    create: {
      id:           "seed_superadmin",
      name:         "Amine",
      pin:          pinHash,
      role:         "superadmin",
      isActive:     true,
      portalAccess: ["magazin", "costumes", "lm3allem"],
    },
  })

  console.log("\n✅  Seed complete.")
  console.log("👤  Superadmin: Amine  |  PIN: 880826  ← CHANGE THIS BEFORE PRODUCTION")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())