import "dotenv/config";
import { prisma } from "@/lib/db";
import { matchNutrient } from "@/lib/services/nutrients";

async function main() {
  const rawNutrients = await prisma.nutrient.findMany({
    select: { id: true, slug: true, name: true, defaultUnit: true, rda: true, aliases: true },
  });

  const nutrients = rawNutrients.map((n) => ({
    ...n,
    aliases: Array.isArray(n.aliases) ? (n.aliases as string[]) : [],
  }));

  const ingredients = await prisma.supplementIngredient.findMany({
    where: { nutrientId: null },
    select: { id: true, name: true },
  });

  console.log(`Backfilling ${ingredients.length} unmapped ingredients…`);

  let matched = 0;
  for (const ing of ingredients) {
    const hit = matchNutrient(ing.name, nutrients);
    if (hit) {
      await prisma.supplementIngredient.update({
        where: { id: ing.id },
        data: { nutrientId: hit.id },
      });
      matched++;
    }
  }

  console.log(`✓ Matched ${matched}/${ingredients.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
