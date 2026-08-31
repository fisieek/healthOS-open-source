"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface Ingredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  percentDV: number | null;
  nutrientId: string | null;
  nutrientName: string | null;
}

export interface Supplement {
  id: string;
  name: string;
  company: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  ingredients: Ingredient[];
}

export interface IntakeRecord {
  id: string;
  supplementId: string;
  portion: number;
  takenAt: string;
}

export interface Nutrient {
  id: string;
  slug: string;
  name: string;
  defaultUnit: string;
  rda: number | null;
  upperLimit: number | null;
  category: "VITAMIN" | "MINERAL" | "FATTY_ACID" | "AMINO_ACID" | "HERB" | "PROBIOTIC" | "OTHER";
}

interface Props {
  supplements: Supplement[];
  todayIntakes: IntakeRecord[];
  nutrients: Nutrient[];
}

export function NutrientIntakeSummary({ supplements, todayIntakes, nutrients }: Props) {
  // 1. Obliczanie sumarycznego spożycia dla każdego nutrientu dzisiaj
  const intakeSummary = useMemo(() => {
    const summary: Record<string, { amount: number; percentDV: number; count: number }> = {};
    const supplementsMap = new Map(supplements.map((s) => [s.id, s]));

    for (const intake of todayIntakes) {
      const sup = supplementsMap.get(intake.supplementId);
      if (!sup) continue;

      for (const ing of sup.ingredients) {
        if (!ing.nutrientId || ing.amount == null) continue;

        const nutrientId = ing.nutrientId;
        const totalAmount = ing.amount * intake.portion;
        const totalPercent = (ing.percentDV || 0) * intake.portion;

        if (!summary[nutrientId]) {
          summary[nutrientId] = { amount: 0, percentDV: 0, count: 0 };
        }

        summary[nutrientId].amount += totalAmount;
        summary[nutrientId].percentDV += totalPercent;
        summary[nutrientId].count += 1;
      }
    }
    return summary;
  }, [supplements, todayIntakes]);

  // 2. Mapowanie zsumowanych danych na pełną listę nutrientów z informacjami o normach
  const processedNutrients = useMemo(() => {
    return nutrients.map((n) => {
      const intake = intakeSummary[n.id] || { amount: 0, percentDV: 0, count: 0 };
      const percentOfRda = n.rda && n.rda > 0 ? (intake.amount / n.rda) * 100 : intake.percentDV;
      
      const isOverLimit = n.upperLimit && n.upperLimit > 0 && intake.amount > n.upperLimit;
      const isMet = n.rda && n.rda > 0 ? intake.amount >= n.rda : intake.amount > 0;

      return {
        ...n,
        amountTaken: intake.amount,
        percentOfRda: Math.round(percentOfRda),
        isMet,
        isOverLimit,
        hasIntake: intake.amount > 0
      };
    }).filter((n) => n.hasIntake); // Wyświetlamy tylko te, które dzisiaj przyjęliśmy
  }, [nutrients, intakeSummary]);

  // 3. Grupowanie według kategorii
  const categories = useMemo(() => {
    const groups: Record<string, { label: string; items: typeof processedNutrients }> = {
      VITAMIN: { label: "Witaminy", items: [] },
      MINERAL: { label: "Minerały", items: [] },
      FATTY_ACID: { label: "Kwasy tłuszczowe", items: [] },
      AMINO_ACID: { label: "Aminokwasy", items: [] },
      HERB: { label: "Zioła / Ekstrakty", items: [] },
      PROBIOTIC: { label: "Probiotyki", items: [] },
      OTHER: { label: "Inne składniki", items: [] }
    };

    for (const item of processedNutrients) {
      if (groups[item.category]) {
        groups[item.category].items.push(item);
      } else {
        groups.OTHER.items.push(item);
      }
    }

    // Filtrujemy tylko niepuste kategorie
    return Object.entries(groups)
      .map(([key, group]) => ({ key, ...group }))
      .filter((g) => g.items.length > 0);
  }, [processedNutrients]);

  // 4. Sprawdzamy czy są jakieś ostrzeżenia o przekroczeniu limitów bezpiecznego spożycia
  const warnings = useMemo(() => {
    return processedNutrients.filter((n) => n.isOverLimit);
  }, [processedNutrients]);

  if (todayIntakes.length === 0) {
    return (
      <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden h-full flex flex-col justify-center items-center p-8 text-center border-dashed">
        <FlaskGlassIcon className="h-10 w-10 text-[#8c9282] mb-3 animate-pulse" />
        <CardTitle className="text-sm font-semibold text-[#f1f2ec] mb-1">Dzisiejsze spożycie składników</CardTitle>
        <CardDescription className="text-xs text-[#8c9282] max-w-[280px]">
          Nie zaznaczono dzisiaj żadnych przyjętych suplementów. Kliknij „Wziąłem” przy wybranym suplemencie, aby zobaczyć podsumowanie.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
        <CardTitle className="text-sm font-bold text-[#f1f2ec] flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#bce663]" />
          Dzisiejsze Spożycie Składników
        </CardTitle>
        <CardDescription className="text-xs text-[#8c9282]">
          Podsumowanie mikroskładników z dzisiejszych dawek suplementów
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
        {/* Sekcja Ostrzeżeń */}
        {warnings.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>PRZEKROCZENIE GÓRNEGO LIMITU BEZPIECZEŃSTWA!</span>
            </div>
            <p className="text-[11px] text-[#a0a498]">
              Przyjęte dawki poniższych składników przekraczają zalecany górny limit tolerowanego spożycia (Upper Limit):
            </p>
            <ul className="list-disc list-inside text-xs text-red-300 space-y-0.5">
              {warnings.map((w) => (
                <li key={w.id}>
                  <strong>{w.name}</strong>: {Math.round(w.amountTaken * 10) / 10} {w.defaultUnit} (limit: {w.upperLimit} {w.defaultUnit})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Kategorie mikroskładników */}
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.key} className="space-y-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8c9282] border-b border-[#2e3229]/60 pb-1">
                {category.label}
              </h4>
              <div className="space-y-3">
                {category.items.map((item) => {
                  const progressValue = Math.min(item.percentOfRda || 0, 100);
                  const isOver = item.isOverLimit;
                  
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between text-xs items-baseline">
                        <div className="flex items-center gap-1.5 font-medium text-[#f1f2ec]">
                          <span>{item.name}</span>
                          {item.isMet && !isOver && (
                            <span title="RDA pokryte"><CheckCircle2 className="h-3.5 w-3.5 text-lime-500" /></span>
                          )}
                          {isOver && (
                            <span title="Przekroczono limit UL"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /></span>
                          )}
                        </div>
                        <div className="text-right font-mono text-[11px] text-[#8c9282]">
                          <span className="text-[#f1f2ec] font-semibold">{Math.round(item.amountTaken * 10) / 10}</span>
                          <span> / {item.rda ? `${item.rda} ${item.defaultUnit}` : `— ${item.defaultUnit}`}</span>
                          {item.percentOfRda > 0 && (
                            <span className={`ml-1.5 font-bold ${isOver ? "text-red-400" : item.isMet ? "text-lime-400" : "text-[#8c9282]"}`}>
                              ({item.percentOfRda}%)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Pasek postępu RWS / RDA */}
                      <div className="relative">
                        <Progress 
                          value={progressValue} 
                          className={`h-1.5 bg-[#0d0e0c] rounded-full overflow-hidden ${
                            isOver 
                              ? "[&>div]:bg-red-500" 
                              : item.isMet 
                                ? "[&>div]:bg-lime-400" 
                                : "[&>div]:bg-amber-400"
                          }`}
                        />
                      </div>

                      {/* Notatki o limitach */}
                      <div className="flex justify-between text-[10px] text-[#8c9282] px-0.5">
                        <span>RDA: {item.rda ? `${item.rda} ${item.defaultUnit}` : "brak normy"}</span>
                        {item.upperLimit && (
                          <span className={isOver ? "text-red-400 font-semibold" : ""}>
                            Maks. limit (UL): {item.upperLimit} {item.defaultUnit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FlaskGlassIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M5 2h14" />
      <path d="M5 2v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V2" />
      <path d="M8.5 6v12a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V6" />
      <path d="M11 11h2" />
      <path d="M10 15h4" />
    </svg>
  );
}
