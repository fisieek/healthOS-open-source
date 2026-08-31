export type MuscleGroup = 'CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'BICEPS' | 'TRICEPS' | 'CORE' | 'CALVES' | 'FOREARMS' | 'CARDIO' | 'PLYO' | 'STRETCHING' | 'OTHER';

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  CHEST: 'Klatka piersiowa',
  BACK: 'Plecy',
  LEGS: 'Uda',
  SHOULDERS: 'Barki',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  CORE: 'Brzuch / Core',
  CALVES: 'Łydki',
  FOREARMS: 'Przedramiona',
  CARDIO: 'Kardio',
  PLYO: 'Pylo',
  STRETCHING: 'Rozciąganie',
  OTHER: 'Inne'
};

const muscleGroupKeywords: Record<Exclude<MuscleGroup, 'OTHER'>, string[]> = {
  CHEST: [
    'bench press', 'chest fly', 'dips', 'wyciskanie leżąc', 'wyciskanie na płaskiej', 
    'pompki', 'push up', 'incline press', 'decline press', 'dumbbell press', 'chest'
  ],
  BACK: [
    'lat pulldown', 'pull up', 'chin up', 'bent over row', 'deadlift', 'martwy ciąg', 
    'cable row', 't-bar row', 'back', 'plecy', 'podciąganie', 'sciaganie drazka', 'ściąganie drążka'
  ],
  LEGS: [
    'squat', 'leg press', 'leg extension', 'leg curl', 'romanian deadlift', 'lunges', 
    'przysiad', 'suwnica', 'prostowanie nóg', 'uginanie nóg', 'wykroki', 'legs', 'quad', 'hamstring', 'glute'
  ],
  SHOULDERS: [
    'overhead press', 'lateral raise', 'face pull', 'front raise', 'shoulder press', 
    'military press', 'barki', 'wznosy', 'wyciskanie żołnierskie', 'deltoid'
  ],
  BICEPS: [
    'bicep curl', 'hammer curl', 'preacher curl', 'ugięcia ramion', 'biceps', 'modlitewnik'
  ],
  TRICEPS: [
    'triceps pushdown', 'skull crusher', 'overhead triceps', 'close grip bench', 
    'triceps', 'francuskie wyciskanie'
  ],
  CORE: [
    'plank', 'crunch', 'leg raise', 'knee raise', 'sit up', 'sit-up', 'ab wheel',
    'brzuch', 'skłony', 'wznosy nóg', 'brzuszki', 'abs', 'hanging raise',
    'captain', 'decline crunch', 'russian twist', 'woodchop', 'dead bug',
    'hollow body', 'v-up', 'flutter kick', 'mountain climber', 'bicycle crunch',
    'toe touch', 'cable crunch', 'pallof'
  ],
  CALVES: [
    'calf raise', 'calf', 'łydki', 'wspięcia na palce', 'wspiecia'
  ],
  FOREARMS: [
    'wrist curl', 'forearm', 'przedramiona', 'przedramię', 'ugięcia nadgarstków', 'chwyt', 'grip'
  ],
  CARDIO: [
    'bieg', 'run', 'running', 'treadmill', 'bieżnia', 'rower', 'bike', 'cycling', 'spinning',
    'orbitrek', 'elliptical', 'rowing', 'wiosłowanie maszynowe', 'skakanka', 'jump rope',
    'cardio', 'aerobik', 'aerobic', 'marsz', 'walking', 'swim', 'pływanie', 'hiit',
    'warm up', 'warm-up', 'rozgrzewka', 'battle ropes', 'battle rope'
  ],
  PLYO: [
    'box jump', 'burpee', 'skoki', 'jump squat', 'jump lunge', 'plyometric', 'plyo',
    'skakanie', 'wyskok', 'depth jump', 'broad jump', 'tuck jump', 'lateral jump'
  ],
  STRETCHING: [
    'rozciąganie', 'stretch', 'stretching', 'joga', 'yoga', 'pilates', 'foam roll',
    'roller', 'mobility', 'mobilność', 'flexibility', 'elastyczność', 'hip flexor',
    'hamstring stretch', 'quad stretch', 'shoulder stretch', 'cool down'
  ]
};

export function getMuscleGroup(exerciseName: string): MuscleGroup {
  const name = exerciseName.toLowerCase();
  
  for (const [group, keywords] of Object.entries(muscleGroupKeywords)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return group as MuscleGroup;
      }
    }
  }
  
  return 'OTHER';
}

export function getMuscleGroupLabel(group: MuscleGroup): string {
  return muscleGroupLabels[group] || 'Inne';
}

