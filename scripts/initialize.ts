import "dotenv/config";
import { db } from "../src/lib/db";
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
async function main() {
  await db.storeSettings.upsert({ where: { id: "store" }, update: {}, create: {
    brandName: "AutoCare Store", domain: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    description: "Avtomobilinizə qayğı, hər detalda.", heroTitle: "Hər detalda\nmükəmməl qayğı.",
    heroSubtitle: "Avtomobiliniz üçün təmizlik, rahatlıq və qulluq aksesuarları. Ehtiyacınıza uyğun məhsulları kəşf edin.",
    deliveryInfo: "Çatdırılma müddəti və ünvanı sifariş təsdiqlənərkən dəqiqləşdirilir.",
  } });
  if (!await db.commissionRule.count()) await db.commissionRule.create({ data: { amountMinor: 200, minimumOrderMinor: 0, holdDays: 7 } });
  for (const [name, slug] of [["Mikrofiber dəsmallar", "mikrofiber-desmallar"], ["Təmizlik fırçaları", "temizlik-fircalari"], ["Salon aksesuarları", "salon-aksesuarlari"], ["Avtomobilə qulluq", "avtomobile-qulluq"]]) {
    await db.productCategory.upsert({ where: { slug }, update: {}, create: { name, slug, featured: true } });
  }
  if (process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
    try { await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET })); }
    catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
      if (process.env.NODE_ENV === "production") throw new Error("Provision the production bucket explicitly.");
      await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
    }
  }
  console.log("Settings, initial categories, commission policy and storage initialized. No products or sales fabricated.");
}
main().finally(() => db.$disconnect());
