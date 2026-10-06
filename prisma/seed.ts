import "dotenv/config"
import { PrismaClient }   from "@prisma/client"
import { PrismaNeon }     from "@prisma/adapter-neon"
import { neonConfig }     from "@neondatabase/serverless"
import ws from "ws"
import { DEFAULT_STAFF_PERMISSIONS } from "../lib/permissions"
import { hashPassword, isValidEmail, normalizeEmail, validatePassword } from "../lib/auth/password"

neonConfig.webSocketConstructor = ws

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) throw new Error("[seed] DATABASE_URL is not set - check your .env file.")
const adapter = new PrismaNeon({ connectionString })
const prisma  = new PrismaClient({ adapter })

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
    slug: "vest_sizes", name_fr: "Tailles de gilet", name_ar: "مقاسات الصدرية",
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
      { fr: "Vestes",      ar: "سترات"     },
    ],
  },
  {
    slug: "accessory_types", name_fr: "Types d'accessoires", name_ar: "أنواع الإكسسوارات",
    values: [
      { fr: "Cravate",      ar: "ربطة عنق"    }, { fr: "Nœud papillon", ar: "ربطة فراشة"      },
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
      { fr: "Gilet",      ar: "صدرية"   },
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
  {
    slug: "product_colors", name_fr: "Couleurs produits (Magazin)", name_ar: "ألوان المنتجات",
    values: [
      { fr: "Noir",    ar: "أسود"   }, { fr: "Blanc",   ar: "أبيض"  },
      { fr: "Bleu",    ar: "أزرق"   }, { fr: "Rouge",   ar: "أحمر"  },
      { fr: "Vert",    ar: "أخضر"   }, { fr: "Gris",    ar: "رمادي" },
      { fr: "Beige",   ar: "بيج"    }, { fr: "Marron",  ar: "بني"   },
      { fr: "Orange",  ar: "برتقالي" }, { fr: "Violet",  ar: "بنفسجي" },
    ],
  },
  {
    slug: "product_sizes", name_fr: "Tailles produits (Magazin)", name_ar: "مقاسات المنتجات",
    values: [
      { fr: "XS",  ar: "XS"  }, { fr: "S",   ar: "S"   },
      { fr: "M",   ar: "M"   }, { fr: "L",   ar: "L"   },
      { fr: "XL",  ar: "XL"  }, { fr: "XXL", ar: "XXL" },
    ],
  },
  {
    slug: "pants_sizes", name_fr: "Tailles de pantalon", name_ar: "مقاسات السروال",
    values: [
      { fr: "38", ar: "38" }, { fr: "40", ar: "40" }, { fr: "42", ar: "42" },
      { fr: "44", ar: "44" }, { fr: "46", ar: "46" }, { fr: "48", ar: "48" },
      { fr: "50", ar: "50" }, { fr: "52", ar: "52" },
    ],
  },
  {
    slug: "shirt_sizes", name_fr: "Tailles de chemise", name_ar: "مقاسات القميص",
    values: [
      { fr: "37", ar: "37" }, { fr: "38", ar: "38" }, { fr: "39", ar: "39" },
      { fr: "40", ar: "40" }, { fr: "41", ar: "41" }, { fr: "42", ar: "42" },
      { fr: "43", ar: "43" },
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
      defaultStaffPermissions: DEFAULT_STAFF_PERMISSIONS,
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
      console.log(`  -  ${cat.slug} already seeded, skipped`)
    }
  }

  // First accounts: created ONLY when credentials are provided through the environment.
  // Nothing is hardcoded: there is no default login.
  //   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME   -> the first admin
  //   SEED_GHOST_EMAIL / SEED_GHOST_PASSWORD                     -> the invisible maintenance account
  await seedAccount("admin", process.env.SEED_ADMIN_NAME ?? "Admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD)
  await seedAccount("ghost", "Ghost", process.env.SEED_GHOST_EMAIL, process.env.SEED_GHOST_PASSWORD)

  console.log("\n✅  Seed complete.")
}

async function seedAccount(role: "admin" | "ghost", name: string, emailRaw?: string, password?: string) {
  if (!emailRaw || !password) {
    console.log(`  -  ${role}: SEED_${role.toUpperCase()}_EMAIL / _PASSWORD not set, skipped`)
    return
  }
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) throw new Error(`[seed] invalid ${role} email`)
  if (validatePassword(password)) throw new Error(`[seed] ${role} password is too weak (min 8 characters)`)

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    console.log(`  -  ${role} ${email} already exists, skipped`)
    return
  }
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      isActive: true,
      portalAccess: ["magazin", "costumes", "lm3allem"],
      modulePermissions: {},
      mustChangePassword: role === "admin", // the ghost keeps its password; the admin picks a personal one at first login
    },
  })
  console.log(`  ✓  ${role} account created: ${email}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())